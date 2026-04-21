export const LOGIN_BASE_URL = 'https://id.mercedes-benz.com';
export const REST_BASE_URL = 'https://bff.emea-prod.mobilesdk.mercedes-benz.com';
export const WS_URL = 'wss://websocket.emea-prod.mobilesdk.mercedes-benz.com/v2/ws';

export const LOGIN_APP_ID = '62778dc4-1de3-44f4-af95-115f06a3a008';
export const APPLICATION_NAME = 'mycar-store-ece';
export const APPLICATION_VERSION = '1.65.1 (3174)';
export const SDK_VERSION = '4.4.2';
export const OS_NAME = 'ios';
export const OS_VERSION = '26.3';
export const USER_AGENT = 'Mercedes-Benz/3044 CFNetwork/3860.400.22 Darwin/25.3.0';
/** UA string sent to the CIAM web login — matches what mbapi2020 uses. */
export const CIAM_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1';

export const OAUTH_REDIRECT_URI = 'rismycar://login-callback';
export const OAUTH_SCOPE = 'email profile ciam-uid phone openid offline_access';

/** Seconds before expiry at which the client proactively refreshes the access token. */
export const TOKEN_REFRESH_SKEW_SECONDS = 60;

/** Milliseconds between WebSocket pings. */
export const WS_PING_INTERVAL_MS = 30_000;

/** Milliseconds to wait before reconnecting after a WebSocket close. */
export const WS_RECONNECT_DELAY_MS = 15_000;
