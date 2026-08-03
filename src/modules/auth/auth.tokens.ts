import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UserRole } from '../users/user.model';

interface TokenPayload {
  userId: string;
  role: UserRole;
}

export const generateAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

export const generateRefreshToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};
