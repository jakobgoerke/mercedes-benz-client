import { MercedesBenzClient } from '../src/MercedesBenzClient';
import { PushMessage, VEPUpdatesByVIN, VehicleAttributeStatus, VehicleStatusUpdate, VehicleStatusUpdates } from '../src/proto';
import type { VehicleUpdate } from '../src/types';
import { VehicleEventStream } from '../src/VehicleEventStream';

function pushBufferFor(vin: string, attributes: Record<string, unknown>): Buffer {
  const encodedAttributes: Record<string, ReturnType<typeof VehicleAttributeStatus.create>> = {};
  for (const [key, fields] of Object.entries(attributes)) {
    encodedAttributes[key] = VehicleAttributeStatus.create({ timestamp_in_ms: 1_700_000_000_000, ...(fields as object) });
  }

  const byVin = VEPUpdatesByVIN.create({
    sequence_number: 1,
    updates: {
      [vin]: {
        sequence_number: 1,
        vin,
        full_update: false,
        emit_timestamp_in_ms: 1_700_000_000_000,
        attributes: encodedAttributes,
      },
    },
  });

  const msg = PushMessage.create({ vepUpdates: byVin });
  return Buffer.from(PushMessage.encode(msg).finish());
}

function decodeAttributes(attributes: Record<string, unknown>): VehicleUpdate['attributes'] {
  const stream = new VehicleEventStream(new MercedesBenzClient());
  let update: VehicleUpdate | undefined;
  stream.on('update', (u) => {
    update = u;
  });

  // biome-ignore lint/suspicious/noExplicitAny: exercising the private message handler directly
  (stream as any).handleMessage(pushBufferFor('WDD1234567890ABCD', attributes));

  if (!update) throw new Error('no update emitted');
  return update.attributes;
}

function vehicleStatusPushBufferFor(vin: string, fields: Record<string, unknown>, fullUpdate = false): Buffer {
  // `fromObject` (unlike `create`) recursively converts each plain
  // `{ value: ... }` field into its actual `*Attribute` sub-message type,
  // so callers don't need to know each attribute's specific wrapper type.
  const status = VehicleStatusUpdate.fromObject({ fin_or_vin: vin, full_update: fullUpdate, ...fields });
  const wrapper = VehicleStatusUpdates.fromObject({ sequence_number: 1, vehicle_status_updates: { [vin]: status } });
  const msg = PushMessage.create({ vehicle_status_updates: wrapper });
  return Buffer.from(PushMessage.encode(msg).finish());
}

function decodeVehicleStatusUpdate(fields: Record<string, unknown>, fullUpdate = false): VehicleUpdate {
  const stream = new VehicleEventStream(new MercedesBenzClient());
  let update: VehicleUpdate | undefined;
  stream.on('update', (u) => {
    update = u;
  });

  // biome-ignore lint/suspicious/noExplicitAny: exercising the private message handler directly
  (stream as any).handleMessage(vehicleStatusPushBufferFor('WDD1234567890ABCD', fields, fullUpdate));

  if (!update) throw new Error('no update emitted');
  return update;
}

describe('VehicleEventStream attribute decoding', () => {
  it('decodes int_value, including a literal zero', () => {
    const attrs = decodeAttributes({ doorlockstatusvehicle: { int_value: 0 } });
    expect(attrs.doorlockstatusvehicle).toBe(0);
  });

  it('decodes bool_value and string_value', () => {
    const attrs = decodeAttributes({ chargingactive: { bool_value: true }, someLabel: { string_value: 'hello' } });
    expect(attrs.chargingactive).toBe(true);
    expect(attrs.someLabel).toBe('hello');
  });

  it('maps nil_value to null', () => {
    const attrs = decodeAttributes({ soc: { nil_value: true } });
    expect(attrs.soc).toBeNull();
  });

  it('decodes enum-typed oneof members instead of dropping them', () => {
    const attrs = decodeAttributes({ parkCollisionActivationStatus: { park_collision_activation_status: 2 } });
    expect(attrs.parkCollisionActivationStatus).toBe(2);
  });

  it('surfaces structured (message-typed) oneof members as objects instead of null', () => {
    const attrs = decodeAttributes({
      temperaturePoints: { temperature_points_value: { temperature_points: [{ temperature: 21 }] } },
    });
    expect(attrs.temperaturePoints).toEqual({ temperature_points: [{ temperature: 21 }] });
  });

  it('returns null when no oneof member is set', () => {
    const attrs = decodeAttributes({ vtime: {} });
    expect(attrs.vtime).toBeNull();
  });
});

describe('VehicleEventStream vehicle_status_updates decoding', () => {
  it('decodes ignitionstate off the VehicleStatusUpdate channel', () => {
    const update = decodeVehicleStatusUpdate({ ignitionstate: { value: 4 } });
    expect(update.attributes.ignitionstate).toBe(4);
  });

  it('decodes an int64 field (odo) without leaving a Long object behind', () => {
    const update = decodeVehicleStatusUpdate({ odo: { value: 123456 } });
    expect(update.attributes.odo).toBe(123456);
  });

  it('only includes attributes actually present on the wire', () => {
    const update = decodeVehicleStatusUpdate({ ignitionstate: { value: 1 } });
    expect(Object.keys(update.attributes)).toEqual(['ignitionstate']);
  });

  it('carries full_update through to VehicleUpdate.fullUpdate', () => {
    const update = decodeVehicleStatusUpdate({ ignitionstate: { value: 4 } }, true);
    expect(update.fullUpdate).toBe(true);
  });

  it('builds a position from position_lat/position_long and emits a position event', () => {
    const stream = new VehicleEventStream(new MercedesBenzClient());
    let position: unknown;
    stream.on('position', (_vin, pos) => {
      position = pos;
    });

    const buf = vehicleStatusPushBufferFor('WDD1234567890ABCD', {
      position_lat: { value: 48.1 },
      position_long: { value: 11.5 },
      position_heading: { value: 90 },
    });
    // biome-ignore lint/suspicious/noExplicitAny: exercising the private message handler directly
    (stream as any).handleMessage(buf);

    expect(position).toMatchObject({ latitude: 48.1, longitude: 11.5, heading: 90 });
  });
});
