import { MercedesBenzClient } from '../src';
import { AuthenticationError } from '../src/errors';

describe('MercedesBenzClient', () => {
  it('requires a token before issuing authenticated requests', async () => {
    const client = new MercedesBenzClient();
    await expect(client.getValidToken()).rejects.toThrow(AuthenticationError);
  });

  it('returns a cached, non-expired token without refreshing', async () => {
    const token = {
      accessToken: 'fresh',
      refreshToken: 'r',
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    const client = new MercedesBenzClient({ token });
    const got = await client.getValidToken();
    expect(got.accessToken).toBe('fresh');
  });

  it('preserves deviceId across calls', () => {
    const client = new MercedesBenzClient({ deviceId: 'stable-id' });
    expect(client.getDeviceId()).toBe('stable-id');
  });
});
