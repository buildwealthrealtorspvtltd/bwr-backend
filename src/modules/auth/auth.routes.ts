import { Router } from 'express';
import {
  registerUser,
  login,
  refreshToken,
  logout,
  sendVerificationOTP,
  verifyVerificationOTP,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  forgotPasswordReset,
} from './auth.controller';
import { googleAuth } from './google.controller';
import { optionalAuthenticate, AuthRequest } from '../../middlewares/auth.middleware';
import { authLimiter } from '../../middlewares/rateLimiter.middleware';
import { User, UserRole } from '../users/user.model';
import { env } from '../../config/env';

const router = Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/send-otp', authLimiter, sendVerificationOTP);
router.post('/verify-otp', authLimiter, verifyVerificationOTP);

// Forgot Password flows
router.post('/forgot-password-otp', authLimiter, sendForgotPasswordOTP);
router.post('/forgot-password-verify', authLimiter, verifyForgotPasswordOTP);
router.post('/forgot-password-reset', authLimiter, forgotPasswordReset);

// GET /api/v1/auth/me — returns current user from JWT cookie (or null if guest)
router.get('/me', optionalAuthenticate, (req, res) => {
  const authReq = req as AuthRequest;
  const user = authReq.user;

  if (!user) {
    return res.json({ user: null });
  }

  // user is narrowed to IUser here — no longer possibly undefined
  const { _id, name, email, role } = user;

  return res.json({
    user: { id: _id, name, email, role },
  });
});

// ─── DEV-ONLY: Promote admin email to ADMIN role ─────────────────────────────
// Hit GET /api/v1/auth/seed-admin once in development to ensure the admin
// Gmail account has role:ADMIN in MongoDB. Safe: does nothing in production.
if (env.NODE_ENV === 'development') {
  router.get('/seed-admin', async (_req, res) => {
    try {
      const email = 'it.buildwealthrealtors@gmail.com';
      const user = await User.findOneAndUpdate(
        { email },
        { role: UserRole.ADMIN, isActive: true },
        { new: true },
      );

      if (user) {
        return res.json({
          success: true,
          message: `✅ ${user.name} (${user.email}) is now ADMIN.`,
        });
      } else {
        return res.json({
          success: false,
          message: `⚠️ No user found with email: ${email}. Sign in with Google first, then call this route again.`,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

export default router;
