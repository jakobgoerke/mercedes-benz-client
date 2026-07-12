# mercedes-benz-client

Unofficial TypeScript client for the Mercedes Me mobile-SDK API (EU region).
Streams live vehicle state over WebSocket + protobuf, including GPS position.

Based on reverse-engineering from [ReneNulschDE/mbapi2020](https://github.com/ReneNulschDE/mbapi2020).

## Install

```sh
yarn add @jakobgoerke/mercedes-benz-client
```

## Authentication

Authentication uses the CIAM/PKCE password flow — the same flow as the Mercedes Me mobile app.

### First-time login (local)

```sh
yarn login
```

This prompts for your Mercedes Me email and password, then writes `auth.json` containing your `deviceId` and `refreshToken`. Keep the `deviceId` stable — Mercedes binds refresh tokens to the device that issued them.

### Long-running services: re-login with email + password

Don't seed a long-lived process from a stored `refreshToken`. Mercedes rotates the refresh token on every use and revokes the previous one — if the process restarts after a rotation, the refresh token baked into your config/secret at deploy time is already dead and the service can never recover on its own.

Instead, keep `deviceId` stable (see above) but call `login()` with the account email/password on startup **and** on an interval well inside a day:

```ts
import { MercedesBenzClient, VehicleEventStream } from '@jakobgoerke/mercedes-benz-client';

const client = new MercedesBenzClient({ deviceId: process.env.MERCEDES_DEVICE_ID });
await client.login(process.env.MERCEDES_EMAIL!, process.env.MERCEDES_PASSWORD!);

setInterval(
  () => client.login(process.env.MERCEDES_EMAIL!, process.env.MERCEDES_PASSWORD!),
  12 * 60 * 60 * 1000,
);
```

Each `login()` call issues a brand-new token pair, so the in-memory refresh token is never more than a few hours old — a restart in between never trips over a rotated-out token. The client still auto-refreshes the access token between logins.

### Using a saved refresh token (short-lived processes / scripts)

```ts
const client = new MercedesBenzClient({
  deviceId: process.env.MERCEDES_DEVICE_ID,
  token: {
    accessToken: '',
    refreshToken: process.env.MERCEDES_REFRESH_TOKEN!,
    expiresAt: 0, // forces immediate refresh on first use
  },
});
```

Fine for a one-shot script that exits shortly after use. Avoid it for anything that's expected to survive a restart days later.

## Usage

### Stream live updates

```ts
const stream = new VehicleEventStream(client);

stream.on('connected', () => console.log('connected'));
stream.on('assignedVehicles', (vins) => console.log('vehicles:', vins));

stream.on('position', (vin, pos) => {
  console.log(vin, pos.latitude, pos.longitude, pos.heading);
});

stream.on('update', (update) => {
  // update.attributes — all vehicle state the app sees (fuel, soc, doors, …)
  // update.fullUpdate — true on the initial state dump after connect
});

await stream.connect();
```

The stream auto-reconnects on disconnect. Call `stream.close()` to stop.

### List vehicles

```ts
const vehicles = await client.getVehicles();
// [{ vin, fin, licensePlate, model, modelYear }]
```

### Manual token refresh

```ts
const token = await client.refresh();
// persist token.refreshToken if you want to update stored credentials
```

Useful for persisting a rotated refresh token back to storage if you're using the saved-refresh-token pattern above. For long-running services, prefer scheduled `login()` calls instead (see above) — they don't depend on the previous refresh token still being valid.

## Development

The WebSocket feed decodes protobuf messages whose schemas are extracted from
`mbapi2020`'s compiled `_pb2.py` files and committed as `src/proto/descriptors.bin`.

To regenerate the binary after an upstream schema update:

```sh
yarn gen:proto
```

Commit the resulting `descriptors.bin`.
