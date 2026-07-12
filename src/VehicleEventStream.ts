import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

import {
  APPLICATION_NAME,
  APPLICATION_VERSION,
  OS_NAME,
  OS_VERSION,
  SDK_VERSION,
  USER_AGENT,
  WS_PING_INTERVAL_MS,
  WS_RECONNECT_DELAY_MS,
  WS_RECONNECT_JITTER,
  WS_RECONNECT_MAX_DELAY_MS,
  WS_URL,
} from './constants';
import { MercedesBenzClient } from './MercedesBenzClient';
import { ClientMessage, type DecodedAttributeStatus, type DecodedPushMessage, type DecodedVEPUpdate, PushMessage } from './proto';
import type { AttributeValue, Position, VehicleUpdate } from './types';

/**
 * Keys in the VEP attribute map that encode GPS position. These are the
 * Mercedes app's own field names — seen in mbapi2020 and confirmed against
 * live traffic from the EU backend.
 */
const POSITION_LAT_KEY = 'positionLat';
const POSITION_LONG_KEY = 'positionLong';
const POSITION_HEADING_KEY = 'positionHeading';

const WS_CLOSE_CODES: Record<number, string> = {
  1000: 'normal closure',
  1001: 'going away',
  1002: 'protocol error',
  1003: 'unsupported data',
  1006: 'abnormal closure (no close frame)',
  1007: 'invalid frame payload',
  1008: 'policy violation',
  1009: 'message too big',
  1011: 'server error',
  1012: 'service restart',
  1013: 'try again later',
  1014: 'bad gateway',
};

export type VehicleEventStreamEvents = {
  connected: () => void;
  disconnected: (reason: string) => void;
  error: (err: Error) => void;
  update: (update: VehicleUpdate) => void;
  position: (vin: string, position: Position) => void;
  assignedVehicles: (vins: string[]) => void;
} & Record<string, (...args: never[]) => void>;

type TypedEventEmitter<M extends Record<string, (...args: never[]) => void>> = {
  on<E extends keyof M>(event: E, listener: M[E]): TypedEventEmitter<M>;
  off<E extends keyof M>(event: E, listener: M[E]): TypedEventEmitter<M>;
  emit<E extends keyof M>(event: E, ...args: Parameters<M[E]>): boolean;
};

export class VehicleEventStream extends (EventEmitter as new () => TypedEventEmitter<VehicleEventStreamEvents>) {
  private ws: WebSocket | undefined;
  private pingTimer: NodeJS.Timeout | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private closedByUser = false;
  private reconnectAttempts = 0;

  constructor(private readonly client: MercedesBenzClient) {
    super();
  }

  public async connect(): Promise<void> {
    this.closedByUser = false;
    this.reconnectAttempts = 0;
    await this.open();
  }

  public close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.clearPing();
    this.ws?.close();
    this.ws = undefined;
  }

  private async open(): Promise<void> {
    const token = await this.client.getValidToken();
    const sessionId = randomUUID();

    const ws = new WebSocket(WS_URL, {
      headers: {
        Authorization: token.accessToken,
        'APP-SESSION-ID': sessionId,
        'OUTPUT-FORMAT': 'PROTO',
        'X-SessionId': sessionId,
        'X-TrackingId': randomUUID(),
        'X-Locale': 'de-DE',
        'User-Agent': USER_AGENT,
        'X-ApplicationName': APPLICATION_NAME,
        'ris-application-version': APPLICATION_VERSION,
        'ris-sdk-version': SDK_VERSION,
        'ris-os-name': OS_NAME,
        'ris-os-version': OS_VERSION,
      },
    });
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startPing();
    });
    ws.on('message', (data) => this.handleMessage(data as Buffer));
    ws.on('error', (err) => this.emit('error', err));
    ws.on('unexpected-response', (_req, res) => {
      const retryAfter = res.headers['retry-after'];
      let retryMs: number | undefined;
      if (retryAfter) {
        const seconds = Number(retryAfter);
        retryMs = Number.isFinite(seconds) ? seconds * 1000 : new Date(retryAfter).getTime() - Date.now();
      }
      const msg = `WebSocket rejected: HTTP ${res.statusCode}${retryMs !== undefined ? ` — retry in ${Math.ceil(retryMs / 1000)}s` : ''}`;
      this.emit('error', new Error(msg));
      res.resume();
      if (!this.closedByUser) this.scheduleReconnect(retryMs);
    });
    ws.on('close', (code, reason) => {
      this.clearPing();
      const reasonStr = reason.length ? `code=${code} reason=${reason.toString()}` : `code=${code} (${WS_CLOSE_CODES[code] ?? 'unknown'})`;
      this.emit('disconnected', reasonStr);
      if (!this.closedByUser) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(minDelayMs?: number): void {
    if (this.reconnectTimer) return;
    const base = WS_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts;
    const capped = Math.min(base, WS_RECONNECT_MAX_DELAY_MS);
    const jittered = capped * (1 + WS_RECONNECT_JITTER * (Math.random() * 2 - 1));
    const delay = Math.max(jittered, minDelayMs ?? 0);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open().catch((err) => this.emit('error', err as Error));
    }, delay);
  }

  private startPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      try {
        this.ws?.ping();
      } catch (err) {
        this.emit('error', err as Error);
      }
    }, WS_PING_INTERVAL_MS);
  }

  private clearPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  private handleMessage(data: Buffer): void {
    let msg: DecodedPushMessage;
    try {
      // protobufjs decodes against a schema loaded at runtime, so there's no
      // generated type to decode into — this is the one place we assert the
      // shape instead of deriving it from the type system.
      msg = PushMessage.decode(data) as unknown as DecodedPushMessage;
    } catch (err) {
      this.emit('error', err as Error);
      return;
    }

    if (msg.assigned_vehicles) {
      const vins: string[] = msg.assigned_vehicles.vins ?? [];
      this.emit('assignedVehicles', vins);
      this.sendAck('acknowledge_assigned_vehicles', {});
      return;
    }

    if (msg.vepUpdates) {
      const { sequence_number, updates } = msg.vepUpdates;
      for (const [vin, update] of Object.entries(updates ?? {})) {
        this.emitVepUpdate(vin, update);
      }
      this.sendAck('acknowledge_vep_updates_by_vin', { sequence_number });
      return;
    }

    if (msg.vepUpdate) {
      this.emitVepUpdate(msg.vepUpdate.vin, msg.vepUpdate);
      return;
    }

    if (msg.apptwin_command_status_updates_by_vin) {
      this.sendAck('acknowledge_apptwin_command_status_update_by_vin', {
        sequence_number: msg.apptwin_command_status_updates_by_vin.sequence_number,
      });
      return;
    }

    if (msg.service_status_updates) {
      this.sendAck('acknowledge_service_status_updates_by_vin', {
        sequence_number: msg.service_status_updates.sequence_number,
      });
      return;
    }

    if (msg.apptwin_pending_command_request) {
      this.sendAck('apptwin_pending_commands_response', {});
      return;
    }
  }

  private emitVepUpdate(vin: string, vep: DecodedVEPUpdate): void {
    const attributes: Record<string, AttributeValue> = {};
    for (const [key, status] of Object.entries(vep.attributes ?? {})) {
      attributes[key] = extractAttributeValue(status);
    }

    const emittedAt = new Date(Number(vep.emit_timestamp_in_ms ?? vep.emit_timestamp ?? Date.now()));
    const latitude = attributes[POSITION_LAT_KEY];
    const longitude = attributes[POSITION_LONG_KEY];
    const heading = attributes[POSITION_HEADING_KEY];

    let position: Position | undefined;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      position = {
        latitude,
        longitude,
        heading: typeof heading === 'number' ? heading : undefined,
        timestamp: emittedAt,
      };
    }

    const update: VehicleUpdate = {
      vin,
      fullUpdate: Boolean(vep.full_update),
      emittedAt,
      attributes,
      position,
    };

    this.emit('update', update);
    if (position) this.emit('position', vin, position);
  }

  private sendAck(oneofField: string, payload: Record<string, unknown>): void {
    const msg = ClientMessage.create({ [oneofField]: payload });
    const bytes = ClientMessage.encode(msg).finish();
    this.send(bytes);
  }

  private send(bytes: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(bytes);
  }
}

function extractAttributeValue(status: DecodedAttributeStatus | undefined): AttributeValue {
  if (!status) return null;

  // `attribute_type` is protobufjs' virtual discriminator for the
  // `oneof attribute_type` — it names whichever of the 73 known value
  // fields (int_value, bool_value, ..., park_collision_activation_status,
  // temperature_points_value, ...) was actually sent on the wire.
  const which = status.attribute_type;
  if (!which || which === 'nil_value') return null;

  const value = status[which];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value as AttributeValue;

  // int64 fields (e.g. int_value) decode to a Long-like object rather than
  // a plain number; the remaining oneof cases are nested messages
  // (schedules, histograms, tariff tables, ...) with a `toJSON` — surface
  // those as plain objects instead of silently discarding them.
  const wrapped = value as { toNumber?: () => number; toJSON?: () => Record<string, unknown> };
  if (typeof wrapped.toNumber === 'function') return wrapped.toNumber();
  if (typeof wrapped.toJSON === 'function') return wrapped.toJSON();
  return value as Record<string, unknown>;
}
