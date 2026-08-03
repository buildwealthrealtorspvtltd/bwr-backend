import { Response } from 'express';
import { env } from '../../config/env';

// 1. Define the rules ONCE — uses validated env instead of raw process.env (HIGH-006)
const cookieOptions = {
  httpOnly: true,
  path: '/', // ⚠️ CRITICAL: Must be "/" for the entire site
  secure: true,
  sameSite: 'none' as const,
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  // Set Access Token (15 min)
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });

  // Set Refresh Token (7 days)
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookies = (res: Response) => {
  // 2. Clear cookies using the EXACT SAME options
  res.cookie('accessToken', '', {
    ...cookieOptions,
    maxAge: 0, // Expire immediately
  });

  res.cookie('refreshToken', '', {
    ...cookieOptions,
    maxAge: 0,
  });
};
