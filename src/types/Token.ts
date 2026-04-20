import { z } from 'zod';

export const TokenResponseSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
  })
  .transform(({ access_token, refresh_token, expires_in }) => ({
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: Date.now() + expires_in * 1000,
  }));

export type Token = z.infer<typeof TokenResponseSchema>;
