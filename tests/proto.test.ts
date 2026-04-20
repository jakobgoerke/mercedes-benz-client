import { ClientMessage, PushMessage, VEPUpdatesByVIN, VehicleAttributeStatus } from '../src/proto';

describe('proto descriptors', () => {
  it('roundtrips a VEPUpdatesByVIN PushMessage with position attributes', () => {
    const vin = 'WDD1234567890ABCD';
    const lat = 48.137154;
    const lng = 11.576124;

    const makeStatus = (value: number) =>
      VehicleAttributeStatus.create({
        timestamp_in_ms: 1_700_000_000_000,
        double_value: value,
        status: 0,
      });

    const innerUpdate = {
      sequence_number: 42,
      vin,
      full_update: true,
      emit_timestamp_in_ms: 1_700_000_000_000,
      attributes: {
        positionLat: makeStatus(lat),
        positionLong: makeStatus(lng),
      },
    };

    const byVin = VEPUpdatesByVIN.create({
      sequence_number: 42,
      updates: { [vin]: innerUpdate },
    });

    const msg = PushMessage.create({ vepUpdates: byVin });
    const bytes = PushMessage.encode(msg).finish();

    // biome-ignore lint/suspicious/noExplicitAny: decoded dynamic message
    const decoded = PushMessage.decode(bytes) as any;
    expect(decoded.vepUpdates.sequence_number).toBe(42);
    const update = decoded.vepUpdates.updates[vin];
    expect(update.vin).toBe(vin);
    expect(update.attributes.positionLat.double_value).toBeCloseTo(lat);
    expect(update.attributes.positionLong.double_value).toBeCloseTo(lng);
  });

  it('can build an ack ClientMessage', () => {
    const msg = ClientMessage.create({ acknowledge_vep_updates_by_vin: { sequence_number: 1 } });
    const bytes = ClientMessage.encode(msg).finish();
    expect(bytes.length).toBeGreaterThan(0);

    // biome-ignore lint/suspicious/noExplicitAny: decoded dynamic message
    const decoded = ClientMessage.decode(bytes) as any;
    expect(decoded.acknowledge_vep_updates_by_vin.sequence_number).toBe(1);
  });
});
