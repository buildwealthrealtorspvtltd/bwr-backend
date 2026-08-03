import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '../modules/users/user.model';

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== UserRole.ADMIN) {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
};

export const isAgent = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== UserRole.AGENT) {
    return res.status(403).json({ message: 'Agent access only' });
  }
  next();
};

export const isAgentOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role !== UserRole.AGENT && role !== UserRole.ADMIN) {
    return res.status(403).json({ message: 'Agent or Admin access only' });
  }
  next();
};
