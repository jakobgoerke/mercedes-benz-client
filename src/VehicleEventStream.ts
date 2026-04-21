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
  WS_URL,
} from './constants';
import { MercedesBenzClient } from './MercedesBenzClient';
import { ClientMessage, PushMessage, VEPUpdate } from './proto';
import type { AttributeValue, Position, VehicleUpdate } from './types';

/**
 * Keys in the VEP attribute map that encode GPS position. These are the
 * Mercedes app's own field names — seen in mbapi2020 and confirmed against
 * live traffic from the EU backend.
 */
const POSITION_LAT_KEY = 'positionLat';
const POSITION_LONG_KEY = 'positionLong';
const POSITION_HEADING_KEY = 'positionHeading';

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

  constructor(private readonly client: MercedesBenzClient) {
    super();
  }

  public async connect(): Promise<void> {
    this.closedByUser = false;
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
      this.emit('connected');
      this.startPing();
    });
    ws.on('message', (data) => this.handleMessage(data as Buffer));
    ws.on('error', (err) => this.emit('error', err));
    ws.on('close', (code, reason) => {
      this.clearPing();
      const reasonStr = reason.length ? reason.toString() : `code=${code}`;
      this.emit('disconnected', reasonStr);
      if (!this.closedByUser) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open().catch((err) => this.emit('error', err as Error));
    }, WS_RECONNECT_DELAY_MS);
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
    let push: ReturnType<typeof PushMessage.decode>;
    try {
      push = PushMessage.decode(data);
    } catch (err) {
      this.emit('error', err as Error);
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: dynamic protobuf message
    const msg = push as any;

    if (msg.assigned_vehicles) {
      const vins: string[] = msg.assigned_vehicles.vins ?? [];
      this.emit('assignedVehicles', vins);
      this.send(hexToBytes('ba0100'));
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
      this.send(hexToBytes('aa0100'));
      return;
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: vep is a decoded protobuf message
  private emitVepUpdate(vin: string, vep: any): void {
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

// biome-ignore lint/suspicious/noExplicitAny: status is a decoded protobuf message
function extractAttributeValue(status: any): AttributeValue {
  if (!status) return null;
  if (status.nil_value) return null;
  if (status.double_value !== undefined && status.double_value !== 0) return status.double_value;
  if (status.int_value !== undefined && status.int_value !== 0) return Number(status.int_value);
  if (status.bool_value !== undefined) return Boolean(status.bool_value);
  if (status.string_value) return String(status.string_value);
  if (status.double_value === 0) return 0;
  if (status.int_value === 0) return 0;
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Silence unused warning while keeping import for type references in future expansion.
void VEPUpdate;
