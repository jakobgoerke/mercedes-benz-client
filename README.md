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

### Using saved credentials

```ts
import { MercedesBenzClient, VehicleEventStream } from '@jakobgoerke/mercedes-benz-client';

const client = new MercedesBenzClient({
  deviceId: process.env.MERCEDES_DEVICE_ID,
  token: {
    accessToken: '',
    refreshToken: process.env.MERCEDES_REFRESH_TOKEN!,
    expiresAt: 0, // forces immediate refresh on first use
  },
});
```

The client automatically refreshes the access token before it expires. You only need `deviceId` and `refreshToken` long-term.

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

Refresh tokens stay valid indefinitely as long as the cluster uses them regularly (they reset on each use). Re-run `yarn login` only if the token is revoked (password change, 90+ days of inactivity).

## Development

The WebSocket feed decodes protobuf messages whose schemas are extracted from
`mbapi2020`'s compiled `_pb2.py` files and committed as `src/proto/descriptors.bin`.

To regenerate the binary after an upstream schema update:

```sh
yarn gen:proto
```

Commit the resulting `descriptors.bin`.
