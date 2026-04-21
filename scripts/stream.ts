/**
 * Connect to the Mercedes Me WebSocket stream using credentials from auth.json.
 * Run: `yarn stream`
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { MercedesBenzClient, VehicleEventStream } from '../src';

const AUTH_FILE = path.resolve(__dirname, '..', 'auth.json');

async function main() {
  const auth = JSON.parse(await fs.readFile(AUTH_FILE, 'utf8'));

  const client = new MercedesBenzClient({
    deviceId: auth.deviceId,
    token: {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt,
    },
  });

  const stream = new VehicleEventStream(client);

  stream.on('connected', () => console.log('connected'));
  stream.on('disconnected', (reason) => console.log('disconnected:', reason));
  stream.on('error', (err) => console.error('error:', err.message));
  stream.on('assignedVehicles', (vins) => console.log('vehicles:', vins));
  stream.on('position', (vin, pos) => {
    console.log(`position [${vin}]`, {
      lat: pos.latitude,
      lng: pos.longitude,
      heading: pos.heading,
      at: pos.timestamp.toISOString(),
    });
  });
  stream.on('update', (update) => {
    console.log(`update [${update.vin}] full=${update.fullUpdate}`, JSON.stringify(update, null, 2));
  });

  await stream.connect();
  console.log('streaming... Ctrl+C to stop');

  process.on('SIGINT', () => {
    stream.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
