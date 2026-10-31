import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { MercedesBenzClient } from '../src';
import { LOGIN_BASE_URL } from '../src/constants';
import { AuthenticationError } from '../src/errors';

// Every axios.create() returns one shared stub; the real isAxiosError and
// AxiosHeaders stay so the client's error handling and headers work as usual.
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const instance = {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { ...actual, __esModule: true, default: { ...actual.default, create: jest.fn(() => instance), __instance: instance } };
});
// biome-ignore lint/suspicious/noExplicitAny: test-only handle on the stub above
const mockAxios = (axios as any).__instance;

/** Scripts one successful pass through the CIAM/PKCE login flow. */
function mockLoginFlow() {
  mockAxios.get
    .mockResolvedValueOnce({ status: 302, headers: { location: '/ciam/auth/login?resume=/as/abc/resume/as/authorization.ping' } })
    .mockResolvedValueOnce({ status: 200, headers: {} });
  mockAxios.post
    .mockResolvedValueOnce({ status: 200, data: {} }) // user agent info
    .mockResolvedValueOnce({ status: 200, data: {} }) // username
    .mockResolvedValueOnce({ status: 200, data: { result: 'RESUME2OIDCP', token: 'pre-login' } }) // password
    .mockResolvedValueOnce({ status: 302, headers: { location: 'rismycar://login-callback?code=abc' } }) // resume
    .mockResolvedValueOnce({ status: 200, data: { access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 3600 } });
}

/** The cookie interceptors of the jar client created most recently (the login's). */
function lastJarInterceptors() {
  const request = mockAxios.interceptors.request.use as jest.Mock;
  const response = mockAxios.interceptors.response.use as jest.Mock;
  return {
    request: request.mock.calls.at(-1)?.[0] as (c: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>,
    response: response.mock.calls.at(-1)?.[0] as (r: unknown) => Promise<unknown>,
  };
}

describe('MercedesBenzClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts every login from a fresh cookie jar, so a live SSO session cannot short-circuit it', async () => {
    const client = new MercedesBenzClient({ deviceId: 'stable-id' });
    const authorizeUrl = `${LOGIN_BASE_URL}/as/authorization.oauth2`;

    mockLoginFlow();
    await client.login('me@example.com', 'secret');
    // The first login's SSO session cookie lands in its jar.
    await lastJarInterceptors().response({
      headers: { 'set-cookie': ['PF=sso-session; Path=/'] },
      config: { url: authorizeUrl },
    });

    mockLoginFlow();
    await client.login('me@example.com', 'secret');
    const config = await lastJarInterceptors().request({ url: authorizeUrl, headers: new AxiosHeaders() });

    const cookie = String(config.headers.get('Cookie'));
    expect(cookie).toContain('CIAM.DEVICE=stable-id');
    expect(cookie).not.toContain('PF=sso-session');
  });

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
