import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { MercedesBenzClient } from '../src';
import { AuthenticationError } from '../src/errors';
import mockAxios from './__mocks__/axios';

describe('MercedesBenzClient', () => {
  afterEach(() => jest.clearAllMocks());

  it('completes login and caches a token', async () => {
    mockApiResponse({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      token_type: 'Bearer',
      expires_in: 3600,
    });

    const client = new MercedesBenzClient({ deviceId: 'device-xyz' });
    const token = await client.completeLogin({ email: 'me@example.com', nonce: 'nonce-1' }, '1234');

    expect(token.accessToken).toBe('access-123');
    expect(token.refreshToken).toBe('refresh-456');
    expect(token.expiresAt).toBeGreaterThan(Date.now());
    expect(mockAxios.post).toHaveBeenCalledWith('/as/token.oauth2', expect.stringContaining('grant_type=password'), expect.any(Object));
  });

  it('throws AuthenticationError when token exchange fails', async () => {
    jest.mocked(mockAxios.post).mockResolvedValueOnce(axiosResponse({ error: 'invalid_grant' }, 400));

    const client = new MercedesBenzClient();
    await expect(client.completeLogin({ email: 'me@example.com', nonce: 'n' }, 'bad')).rejects.toThrow(AuthenticationError);
  });

  it('refreshes an expired token using the refresh grant', async () => {
    mockApiResponse({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 3600 });

    const client = new MercedesBenzClient({
      token: { accessToken: 'old', refreshToken: 'old-refresh', expiresAt: Date.now() - 1000 },
    });
    const token = await client.getValidToken();

    expect(token.accessToken).toBe('new-access');
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/as/token.oauth2',
      expect.stringContaining('grant_type=refresh_token'),
      expect.any(Object),
    );
  });

  it('refuses to issue requests before login', async () => {
    const client = new MercedesBenzClient();
    await expect(client.getValidToken()).rejects.toThrow(AuthenticationError);
  });

  const axiosResponse = <T>(data: T, status = 200): AxiosResponse<T> => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  });

  const mockApiResponse = <T>(data: T, status = 200) => {
    jest.mocked(mockAxios.post).mockImplementationOnce(() => Promise.resolve(axiosResponse(data, status)));
  };
});
