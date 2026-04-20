import { randomUUID } from 'node:crypto';
import axios, { type AxiosInstance, isAxiosError } from 'axios';

import {
  APPLICATION_NAME,
  APPLICATION_VERSION,
  DEFAULT_COUNTRY_CODE,
  LOGIN_APP_ID,
  LOGIN_BASE_URL,
  OS_NAME,
  OS_VERSION,
  REST_BASE_URL,
  SDK_VERSION,
  TOKEN_REFRESH_SKEW_SECONDS,
  USER_AGENT,
} from './constants';
import { AuthenticationError } from './errors';
import { type Token, TokenResponseSchema, type Vehicle, VehicleSchema } from './types';

export interface LoginChallenge {
  email: string;
  nonce: string;
}

export interface MercedesBenzClientOptions {
  /** Existing token from a previous login. Triggers a refresh on first request if expired. */
  token?: Token;
  /** Persistent device identifier. Keep this stable across sessions; Mercedes ties devices to tokens. */
  deviceId?: string;
  /** ISO country code sent with login requests. Defaults to EN. */
  countryCode?: string;
}

export class MercedesBenzClient {
  private readonly deviceId: string;
  private readonly countryCode: string;
  private readonly rest: AxiosInstance;
  private readonly login: AxiosInstance;
  private token: Token | undefined;
  private refreshing: Promise<Token> | undefined;

  constructor(options: MercedesBenzClientOptions = {}) {
    this.deviceId = options.deviceId ?? randomUUID();
    this.countryCode = options.countryCode ?? DEFAULT_COUNTRY_CODE;
    this.token = options.token;

    this.rest = axios.create({
      baseURL: REST_BASE_URL,
      timeout: 10_000,
      headers: this.buildCommonHeaders(),
    });
    this.rest.interceptors.request.use(async (config) => {
      const token = await this.getValidToken();
      config.headers.set('Authorization', `Bearer ${token.accessToken}`);
      config.headers.set('X-SessionId', randomUUID());
      config.headers.set('X-TrackingId', randomUUID());
      return config;
    });

    this.login = axios.create({
      baseURL: LOGIN_BASE_URL,
      timeout: 10_000,
    });
  }

  /**
   * Step 1 of login. Mercedes emails a PIN to the user. Keep the returned
   * {email, nonce} — you need the nonce to redeem the PIN.
   */
  public async requestLoginPin(email: string): Promise<LoginChallenge> {
    const nonce = randomUUID();
    try {
      await this.rest.post(
        '/v1/login',
        { emailOrPhoneNumber: email, countryCode: this.countryCode, nonce },
        {
          // Login step doesn't require auth.
          transformRequest: [
            (data, headers) => {
              headers.delete('Authorization');
              return JSON.stringify(data);
            },
          ],
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) throw new AuthenticationError('login rejected');
      throw err;
    }
    return { email, nonce };
  }

  /**
   * Step 2 of login. Exchanges {email, nonce, pin} for an access+refresh token.
   * The returned token is cached internally and returned to the caller so it can be persisted.
   */
  public async completeLogin(challenge: LoginChallenge, pin: string): Promise<Token> {
    const body = new URLSearchParams({
      client_id: LOGIN_APP_ID,
      grant_type: 'password',
      username: challenge.email,
      password: `${challenge.nonce}:${pin}`,
    });

    const res = await this.login.post('/as/token.oauth2', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Stage: 'prod',
        'X-Device-Id': this.deviceId,
        'X-Request-Id': randomUUID(),
      },
      validateStatus: () => true,
    });
    if (res.status !== 200) throw new AuthenticationError(`token exchange failed [status=${res.status}]`);

    const token = TokenResponseSchema.parse(res.data);
    this.token = token;
    return token;
  }

  /** Returns the current token after refreshing if it is within the skew window. */
  public async getValidToken(): Promise<Token> {
    if (!this.token) throw new AuthenticationError('not authenticated; call completeLogin first');
    const expiresInMs = this.token.expiresAt - Date.now();
    if (expiresInMs > TOKEN_REFRESH_SKEW_SECONDS * 1000) return this.token;
    return this.refresh();
  }

  public async refresh(): Promise<Token> {
    if (!this.token) throw new AuthenticationError('no refresh token available');
    if (this.refreshing) return this.refreshing;

    const refreshToken = this.token.refreshToken;
    this.refreshing = (async () => {
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
      const res = await this.login.post('/as/token.oauth2', body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Stage: 'prod',
          'X-Device-Id': this.deviceId,
          'X-Request-Id': randomUUID(),
        },
        validateStatus: () => true,
      });
      if (res.status !== 200) throw new AuthenticationError(`refresh failed [status=${res.status}]`);
      const token = TokenResponseSchema.parse(res.data);
      this.token = token;
      return token;
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

  private buildCommonHeaders(): Record<string, string> {
    return {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      'X-ApplicationName': APPLICATION_NAME,
      'ris-application-version': APPLICATION_VERSION,
      'ris-sdk-version': SDK_VERSION,
      'ris-os-name': OS_NAME,
      'ris-os-version': OS_VERSION,
      'X-Locale': 'en-DE',
      'X-Device-Id': this.deviceId,
    };
  }
}
