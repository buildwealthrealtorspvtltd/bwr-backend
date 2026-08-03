import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { User, UserRole, AuthProvider } from '../users/user.model';
import { setAuthCookies } from './auth.cookies';
import { generateAccessToken, generateRefreshToken } from './auth.tokens';
import { saveRefreshToken } from './auth.session';
import { env } from '../../config/env';
import crypto from 'crypto';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'No credential provided' });
    }

    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.name) {
      return res.status(400).json({ message: 'Invalid Google token payload' });
    }

    const { email, name } = payload;

    // Check if user exists
    let user = await User.findOne({ email }).select('+isActive');

    // Reject deactivated accounts (same guard as regular login)
    if (user && !user.isActive) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    if (!user) {
      // Create new user
      // Generate random secure placeholder for password Since Google Users don't need one
      const randomPassword = crypto.randomBytes(32).toString('hex');

      user = await User.create({
        name,
        email,
        password: randomPassword,
        role: UserRole.USER,
        authProvider: AuthProvider.GOOGLE,
      });
    }

    // Generate tokens (Same as standard login)
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), refreshToken);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      message: 'Google login successful',
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (error: any) {
    console.error('Google Auth Error:', error);
    return res.status(500).json({ message: 'Google authentication failed' });
  }
};
