import { createHash, randomBytes, randomUUID } from 'node:crypto';
import axios, { type AxiosInstance, type CreateAxiosDefaults, isAxiosError } from 'axios';
import { Cookie, CookieJar } from 'tough-cookie';

import {
  APPLICATION_NAME,
  APPLICATION_VERSION,
  CIAM_USER_AGENT,
  LOGIN_APP_ID,
  LOGIN_BASE_URL,
  OAUTH_REDIRECT_URI,
  OAUTH_SCOPE,
  OS_NAME,
  OS_VERSION,
  REST_BASE_URL,
  SDK_VERSION,
  TOKEN_REFRESH_SKEW_SECONDS,
  USER_AGENT,
} from './constants';
import { AuthenticationError } from './errors';
import { type Token, TokenResponseSchema, type Vehicle, VehicleSchema } from './types';

export interface MercedesBenzClientOptions {
  /** Existing token from a previous login. Triggers a refresh on first request if expired. */
  token?: Token;
  /** Persistent device identifier. Keep this stable across sessions — MB binds tokens to it. */
  deviceId?: string;
}

export class MercedesBenzClient {
  private readonly deviceId: string;
  private readonly rest: AxiosInstance;
  private readonly jar: CookieJar;
  private readonly sessionId = randomUUID();
  private token: Token | undefined;
  private refreshing: Promise<Token> | undefined;

  constructor(options: MercedesBenzClientOptions = {}) {
    this.deviceId = options.deviceId ?? randomUUID();
    this.token = options.token;

    this.jar = new CookieJar();
    // CIAM.DEVICE identifies the device to the login backend across the 6-step
    // OAuth dance. mbapi2020 seeds this into the jar up-front — the CIAM
    // endpoints reject requests that don't carry it.
    this.jar.setCookieSync(
      new Cookie({ key: 'CIAM.DEVICE', value: this.deviceId, domain: 'id.mercedes-benz.com', path: '/' }),
      LOGIN_BASE_URL,
    );

    this.rest = makeJarClient(this.jar, { baseURL: REST_BASE_URL, timeout: 10_000, headers: this.apiHeaders() });
    this.rest.interceptors.request.use(async (config) => {
      const token = await this.getValidToken();
      config.headers.set('Authorization', `Bearer ${token.accessToken}`);
      config.headers.set('X-Trackingid', randomUUID());
      return config;
    });
  }

  /**
   * Logs in using Mercedes Me email + password via the CIAM/PKCE flow. No PIN
   * email — this is what the current mobile app uses. Caches and returns the
   * resulting tokens.
   */
  public async login(email: string, password: string): Promise<Token> {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest().toString('base64url');

    const authClient = makeJarClient(this.jar, { timeout: 10_000 });

    try {
      const resumePath = await this.getAuthorizationResume(codeChallenge);
      await this.sendUserAgentInfo(authClient);
      await this.submitUsername(authClient, email);
      const preLoginToken = await this.submitPassword(authClient, email, password);
      const code = await this.resumeAuthorization(authClient, resumePath, preLoginToken);
      const token = await this.exchangeCodeForTokens(authClient, code, codeVerifier);
      this.token = token;
      return token;
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      if (isAxiosError(err)) {
        throw new AuthenticationError(`login failed at ${err.config?.url}: status=${err.response?.status} body=${JSON.stringify(err.response?.data)}`);
      }
      throw err;
    }
  }

  private async getAuthorizationResume(codeChallenge: string): Promise<string> {
    // Must follow redirects manually so that Set-Cookie headers from every
    // intermediate hop are stored in the jar. axios collapses all redirects
    // into one response, losing intermediate cookies that PingFederate needs
    // to see at the resume step.
    const params = new URLSearchParams({
      client_id: LOGIN_APP_ID,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: OAUTH_SCOPE,
    });
    const headers = {
      'user-agent': CIAM_USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'de-DE,de;q=0.9',
    };

    let url = `${LOGIN_BASE_URL}/as/authorization.oauth2?${params.toString()}`;
    for (let i = 0; i < 10; i++) {
      const cookie = await this.jar.getCookieString(url);
      const res = await axios.get(url, {
        headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
        maxRedirects: 0,
        validateStatus: (s) => s < 400,
      });
      const setCookie = res.headers['set-cookie'];
      if (Array.isArray(setCookie)) {
        await Promise.all(setCookie.map((c) => this.jar.setCookie(c, url).catch(() => undefined)));
      }
      if (res.status === 301 || res.status === 302) {
        url = new URL(res.headers.location, url).toString();
        continue;
      }
      const finalUrl = new URL(url);
      const resume = finalUrl.searchParams.get('resume');
      if (!resume) throw new AuthenticationError('resume param missing from authorization response');
      return resume;
    }
    throw new AuthenticationError('too many redirects in authorization flow');
  }

  private ciamHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      origin: LOGIN_BASE_URL,
      referer: `${LOGIN_BASE_URL}/ciam/auth/login`,
      'accept-language': 'de-DE,de;q=0.9',
      'user-agent': CIAM_USER_AGENT,
      ...extra,
    };
  }

  private async sendUserAgentInfo(client: AxiosInstance): Promise<void> {
    await client.post(
      `${LOGIN_BASE_URL}/ciam/auth/ua`,
      { browserName: 'Mobile Safari', browserVersion: '15.6.6', osName: 'iOS' },
      { headers: this.ciamHeaders({ accept: '*/*' }), validateStatus: () => true },
    );
  }

  private async submitUsername(client: AxiosInstance, email: string): Promise<void> {
    const res = await client.post(
      `${LOGIN_BASE_URL}/ciam/auth/login/user`,
      { username: email },
      { headers: this.ciamHeaders(), validateStatus: () => true },
    );
    if (res.status >= 400) throw new AuthenticationError(`username rejected [status=${res.status}]`);
  }

  private async submitPassword(client: AxiosInstance, email: string, password: string): Promise<string> {
    const rid = randomBytes(24).toString('base64url');
    const res = await client.post(
      `${LOGIN_BASE_URL}/ciam/auth/login/pass`,
      { username: email, password, rememberMe: false, rid },
      { headers: this.ciamHeaders(), validateStatus: () => true },
    );
    if (res.status >= 400) throw new AuthenticationError(`password rejected [status=${res.status}]`);

    const data = res.data as { result?: string; token?: string; homeCountry?: string; consentCountry?: string };
    if (data.result === 'GOTO_LOGIN_OTP') throw new AuthenticationError('2FA required — not supported by this client');
    if (data.result === 'GOTO_LOGIN_LEGAL_TEXTS') {
      throw new AuthenticationError('legal consent required — accept in the MB app and retry');
    }
    if (data.result !== 'RESUME2OIDCP' || !data.token) {
      throw new AuthenticationError(`unexpected login result: ${JSON.stringify(data)}`);
    }
    return data.token;
  }

  private async resumeAuthorization(client: AxiosInstance, resumePath: string, preLoginToken: string): Promise<string> {
    const res = await client.post(
      `${LOGIN_BASE_URL}${resumePath}`,
      new URLSearchParams({ token: preLoginToken }).toString(),
      {
        headers: this.ciamHeaders({
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'content-type': 'application/x-www-form-urlencoded',
        } as Record<string, string>),
        maxRedirects: 0,
        validateStatus: (s) => s === 301 || s === 302,
      },
    );
    const location = res.headers.location;
    if (!location || !location.startsWith('rismycar://')) {
      throw new AuthenticationError(`expected rismycar redirect, got: ${location}`);
    }
    const code = new URL(location).searchParams.get('code');
    if (!code) throw new AuthenticationError('authorization code missing from redirect');
    return code;
  }

  private async exchangeCodeForTokens(client: AxiosInstance, code: string, codeVerifier: string): Promise<Token> {
    const body = new URLSearchParams({
      client_id: LOGIN_APP_ID,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: OAUTH_REDIRECT_URI,
    });
    const res = await client.post(`${LOGIN_BASE_URL}/as/token.oauth2`, body.toString(), {
      headers: { ...this.apiHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: () => true,
    });
    if (res.status !== 200) throw new AuthenticationError(`token exchange failed [status=${res.status}] body=${JSON.stringify(res.data)}`);
    return TokenResponseSchema.parse(res.data);
  }

  public async getValidToken(): Promise<Token> {
    if (!this.token) throw new AuthenticationError('not authenticated; call login first');
    if (this.token.expiresAt - Date.now() > TOKEN_REFRESH_SKEW_SECONDS * 1000) return this.token;
    return this.refresh();
  }

  public async refresh(): Promise<Token> {
    if (!this.token) throw new AuthenticationError('no refresh token available');
    if (this.refreshing) return this.refreshing;

    const refreshToken = this.token.refreshToken;
    this.refreshing = (async () => {
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
      const res = await axios.post(`${LOGIN_BASE_URL}/as/token.oauth2`, body.toString(), {
        headers: {
          ...this.apiHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
          Stage: 'prod',
          'X-Device-Id': this.deviceId,
          'X-Request-Id': randomUUID(),
        },
        validateStatus: () => true,
      });
      if (res.status !== 200) throw new AuthenticationError(`refresh failed [status=${res.status}]`);
      // MB doesn't always rotate refresh_token; fall back to the old one.
      const parsed = TokenResponseSchema.parse({ ...res.data, refresh_token: res.data.refresh_token ?? refreshToken });
      this.token = parsed;
      return parsed;
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = undefined;
    }
  }

  public getToken(): Token | undefined {
    return this.token;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public async getVehicles(): Promise<Vehicle[]> {
    const res = await this.rest.get<{ assignedVehicles?: unknown[] } | unknown[]>('/v2/vehicles');
    const raw = Array.isArray(res.data) ? res.data : (res.data.assignedVehicles ?? []);
    return raw.map((v) => VehicleSchema.parse(v));
  }

  private apiHeaders(): Record<string, string> {
    return {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-GB',
      'X-Locale': 'en-GB',
      'X-Sessionid': this.sessionId,
      'X-Applicationname': APPLICATION_NAME,
      'Ris-Application-Version': APPLICATION_VERSION,
      'Ris-Sdk-Version': SDK_VERSION,
      'Ris-Os-Name': OS_NAME,
      'Ris-Os-Version': OS_VERSION,
    };
  }
}

/**
 * Attaches tough-cookie jar semantics to an axios instance: outbound requests
 * get a Cookie header built from the jar for that URL; inbound responses
 * have Set-Cookie stored back into the jar.
 */
function makeJarClient(jar: CookieJar, config: CreateAxiosDefaults): AxiosInstance {
  const instance = axios.create(config);
  instance.interceptors.request.use(async (c) => {
    const url = new URL(c.url ?? '', c.baseURL).toString();
    const cookie = await jar.getCookieString(url);
    if (cookie) c.headers.set('Cookie', cookie);
    return c;
  });
  instance.interceptors.response.use(async (r) => {
    const setCookie = r.headers['set-cookie'];
    const url = new URL(r.config.url ?? '', r.config.baseURL).toString();
    if (Array.isArray(setCookie)) {
      await Promise.all(setCookie.map((c) => jar.setCookie(c, url).catch(() => undefined)));
    }
    return r;
  });
  return instance;
}
