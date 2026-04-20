# mercedes-benz-client

Unofficial TypeScript client for the Mercedes Me mobile-SDK API (EU region).
Streams live vehicle state over WebSocket + protobuf, including GPS position.

Based on reverse-engineering from [ReneNulschDE/mbapi2020](https://github.com/ReneNulschDE/mbapi2020).

## Install

```sh
yarn add @jakobgoerke/mercedes-benz-client
```

## Usage

```ts
import { MercedesBenzClient, VehicleEventStream } from '@jakobgoerke/mercedes-benz-client';

const client = new MercedesBenzClient({ deviceId: 'persist-this' });

// Step 1 — Mercedes emails a 6-digit PIN.
const challenge = await client.requestLoginPin('me@example.com');

// Step 2 — exchange PIN for tokens.
const token = await client.completeLogin(challenge, '123456');
// persist `token` (accessToken + refreshToken + expiresAt) somewhere.

// List vehicles.
const vehicles = await client.getVehicles();

// Stream live updates.
const stream = new VehicleEventStream(client);
stream.on('position', (vin, pos) => {
  console.log(vin, pos.latitude, pos.longitude);
});
stream.on('update', (update) => {
  // update.attributes contains everything the app sees — fuel, soc, doors, etc.
});
await stream.connect();
```

## Development

The WebSocket feed decodes protobuf messages whose schemas are extracted from
`mbapi2020`'s compiled `_pb2.py` files and committed as `src/proto/descriptors.bin`.

To regenerate the binary after an upstream schema update:

```sh
yarn gen:proto
```

Commit the resulting `descriptors.bin`.