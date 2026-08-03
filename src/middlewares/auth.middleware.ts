import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser } from '../modules/users/user.model';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token;

    // 1. Check Authorization Header (Bearer Token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 2. Check Cookies
    else if (req.cookies && (req.cookies.token || req.cookies.accessToken)) {
      token = req.cookies.token || req.cookies.accessToken;
    }

    // 3. If no token found
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: Please login again' });
    }

    // 4. Verify Token
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      role?: string;
    };

    // 5. Find User
    const user = await User.findById(decoded.userId).select('+role +isActive');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 6. Attach to Request
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
};

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && (req.cookies.token || req.cookies.accessToken)) {
      token = req.cookies.token || req.cookies.accessToken;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      role?: string;
    };

    const user = await User.findById(decoded.userId).select('+role +isActive');

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch {
    // If token is invalid, just proceed as guest (user = undefined)
    next();
  }
};
