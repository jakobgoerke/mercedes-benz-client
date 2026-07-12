import { MercedesBenzClient } from '../src/MercedesBenzClient';
import { PushMessage, VehicleAttributeStatus, VEPUpdatesByVIN } from '../src/proto';
import { VehicleEventStream } from '../src/VehicleEventStream';
import type { VehicleUpdate } from '../src/types';

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
