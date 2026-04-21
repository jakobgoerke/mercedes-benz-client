/**
 * Interactive login. Drives the Mercedes Me CIAM/PKCE password flow and writes
 * `auth.json` containing the credentials your cluster will need long-term.
 *
 * Run: `yarn login`
 *
 * Security:
 *   `auth.json` is gitignored. Do NOT commit it. The refresh token in this file
 *   is a bearer credential for your Mercedes Me account.
 *
 * Cluster handoff:
 *   The two fields that MUST make it into a k8s Secret are `deviceId` and
 *   `refreshToken`. `accessToken` will expire within an hour; `expiresAt` is
 *   informational. Reuse the same `deviceId` forever — MB binds refresh
 *   tokens to the device that issued them.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline/promises';

import { MercedesBenzClient } from '../src';

const AUTH_FILE = path.resolve(__dirname, '..', 'auth.json');

interface SavedAuth {
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  savedAt: string;
}

async function main() {
  const rl = readline.createInterface({ input, output });

  const existing = await readExisting();
  const deviceId = existing?.deviceId ?? randomUUID();
  console.log(existing ? `Reusing deviceId from existing auth.json: ${deviceId}` : `Fresh deviceId: ${deviceId}`);

  const email = (await rl.question('Mercedes Me email: ')).trim();
  const password = (await rl.question('Password (will be visible): ')).trim();
  rl.close();

  const client = new MercedesBenzClient({ deviceId });
  console.log('Logging in...');
  const token = await client.login(email, password);

  const saved: SavedAuth = {
    deviceId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    savedAt: new Date().toISOString(),
  };
  await fs.writeFile(AUTH_FILE, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 });

  console.log(`\n✓ wrote ${path.relative(process.cwd(), AUTH_FILE)}`);
  console.log(`  access token expires ${new Date(token.expiresAt).toISOString()}`);
  console.log('\nFor the cluster, you need these two values:');
  console.log(`  deviceId     = ${deviceId}`);
  console.log(`  refreshToken = ${token.refreshToken.slice(0, 12)}... (see auth.json)`);
}

async function readExisting(): Promise<SavedAuth | undefined> {
  try {
    return JSON.parse(await fs.readFile(AUTH_FILE, 'utf8')) as SavedAuth;
  } catch {
    return undefined;
  }
}

main().catch((err) => {
  console.error('\nlogin failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
