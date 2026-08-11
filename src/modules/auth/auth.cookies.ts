import { Request, Response } from 'express';

/**
 * Dynamic Origin-Aware Cookie Configuration Strategy
 * 
 * 1. LOCAL DEV (http://localhost:3000 or http://127.0.0.1:3000):
 *    Sets `secure: false` & `sameSite: 'lax'`.
 *    Prevents modern browsers (Chrome/Edge) from discarding cookies over unencrypted HTTP.
 * 
 * 2. PRODUCTION HOSTING (https://buildwealthrealtors.com):
 *    Sets `secure: true` & `sameSite: 'none'`.
 *    Guarantees IETF RFC 6265bis cross-site HttpOnly cookie compliance over HTTPS.
 */
export const getCookieOptions = (req?: Request) => {
  const origin = req?.headers?.origin || req?.headers?.referer || '';
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

  if (isLocalhost) {
    return {
      httpOnly: true,
      path: '/',
      secure: false,
      sameSite: 'lax' as const,
    };
  }

  // Production (buildwealthrealtors.com & api.buildwealthrealtors.com)
  // Shared domain allows cPanel Next.js proxy.ts and Render Express backend to share session cookies seamlessly
  return {
    httpOnly: true,
    path: '/',
    secure: true,
    sameSite: 'none' as const,
    domain: '.buildwealthrealtors.com',
  };
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  req?: Request,
) => {
  const options = getCookieOptions(req);

  res.cookie('accessToken', accessToken, {
    ...options,
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refreshToken', refreshToken, {
    ...options,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearAuthCookies = (res: Response, req?: Request) => {
  const options = getCookieOptions(req);

  res.cookie('accessToken', '', {
    ...options,
    maxAge: 0,
  });

  res.cookie('refreshToken', '', {
    ...options,
    maxAge: 0,
  });
};
