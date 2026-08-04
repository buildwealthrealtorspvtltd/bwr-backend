import { Request, Response } from 'express';
import crypto from 'crypto';
import { User, UserRole, AuthProvider } from '../users/user.model';
import {
  registerSchema,
  loginSchema,
  forgotPasswordOTPSchema,
  verifyForgotPasswordOTPSchema,
  resetPasswordSchema,
} from './auth.schemas';
import { setAuthCookies, clearAuthCookies } from './auth.cookies';
import { generateAccessToken, generateRefreshToken } from './auth.tokens';
import { saveRefreshToken, removeRefreshToken } from './auth.session';
import { compareRefreshToken } from './auth.hash';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { OTP } from './otp.model';
import {
  sendOTPEmail,
  sendResetOTPEmail,
  sendPasswordChangeNotificationEmail,
} from '../../utils/email';
import { logAudit, AuditAction, AuditCategory, AuditTargetType } from '../audit/auditLog.service';

/* ======================
   REGISTER (USER ONLY)
====================== */
export const registerUser = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parsed.error });
    }

    const { name, email, password, phone, emailVerificationSignature } = parsed.data;

    // 1. Verify the secure signature JWT to prove this email was verified via OTP
    try {
      const decodedSignature = jwt.verify(
        emailVerificationSignature,
        env.EMAIL_VERIFICATION_SECRET,
      ) as {
        email: string;
        verified: boolean;
      };

      if (
        decodedSignature.email.toLowerCase() !== email.toLowerCase() ||
        !decodedSignature.verified
      ) {
        return res
          .status(400)
          .json({ message: 'Email verification signature is invalid for this email address' });
      }
    } catch {
      return res
        .status(400)
        .json({ message: 'Email verification has expired or is invalid. Please verify again.' });
    }

    // 2. Prevent unique key index duplicate conflicts in MongoDB
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ message: 'User already exists with this email address' });
      } else {
        return res.status(400).json({ message: 'User already exists with this mobile number' });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: UserRole.USER,
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), refreshToken);
    setAuthCookies(res, accessToken, refreshToken, req);

    return res.status(201).json({
      message: 'Registered successfully',
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ((error as { code: number }).code === 11000 ||
        (error as { name?: string }).name === 'MongoServerError')
    ) {
      return res.status(400).json({ message: 'User already exists with this email or mobile' });
    }
    const message = error instanceof Error ? error.message : 'Registration failed';
    return res.status(500).json({ message });
  }
};

/* ======================
   LOGIN
====================== */
export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select('+password +isActive');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Audit: Record failed login attempt
      logAudit({
        action: AuditAction.LOGIN_FAILED,
        category: AuditCategory.AUTH,
        performedBy: user,
        targetType: AuditTargetType.USER,
        targetId: user._id.toString(),
        targetLabel: user.email,
        req,
        details: 'Incorrect password',
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), refreshToken);
    setAuthCookies(res, accessToken, refreshToken, req);

    // Audit: Record successful login
    logAudit({
      action: AuditAction.LOGIN_SUCCESS,
      category: AuditCategory.AUTH,
      performedBy: user,
      targetType: AuditTargetType.USER,
      targetId: user._id.toString(),
      targetLabel: user.email,
      newValue: user.role,
      req,
    });

    return res.json({
      message: 'Login successful',
      user: { id: user._id, name: user.name, role: user.role },
      accessToken,
    });
  } catch {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

/* ======================
   REFRESH TOKEN
====================== */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Verify using the REFRESH secret (not access secret)
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      userId: string;
      role: UserRole;
    };

    const user = await User.findById(decoded.userId).select('+refreshToken +isActive');

    if (!user || !user.isActive || !user.refreshToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const isValid = await compareRefreshToken(token, user.refreshToken);
    if (!isValid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Rotate tokens
    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const newRefreshToken = generateRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), newRefreshToken);
    setAuthCookies(res, newAccessToken, newRefreshToken, req);

    return res.json({ message: 'Token refreshed' });
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

/* ======================
   LOGOUT
====================== */
export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
        // Audit: Record logout
        const logoutUser = await User.findById(decoded.userId).select('name email role');
        if (logoutUser) {
          logAudit({
            action: AuditAction.LOGOUT,
            category: AuditCategory.AUTH,
            performedBy: logoutUser,
            targetType: AuditTargetType.USER,
            targetId: logoutUser._id.toString(),
            targetLabel: logoutUser.email,
            req,
          });
        }
        await removeRefreshToken(decoded.userId);
      } catch {
        // Token expired/invalid — still clear cookies below
      }
    }
  } catch {
    // DB error — still clear cookies
  }

  clearAuthCookies(res, req);
  return res.status(200).json({ message: 'Logged out successfully' });
};

/* ======================
   SEND EMAIL OTP
====================== */
export const sendVerificationOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Generate cryptographically secure 6-digit numeric OTP code
    const code = crypto.randomInt(100000, 999999).toString();

    // Remove existing OTPs and create a new one (triggers pre-save hashing hook)
    await OTP.deleteMany({ email: email.toLowerCase() });
    await OTP.create({
      email: email.toLowerCase(),
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send using nodemailer Google Workspace transporter
    await sendOTPEmail(email, code);

    if (env.NODE_ENV === 'development') {
      console.log(`[DEV OTP]: The OTP for ${email} is ${code}`);
    }

    return res.status(200).json({ message: 'Verification OTP sent successfully!' });
  } catch (error: unknown) {
    console.error('Send OTP Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send OTP code';
    return res.status(500).json({ message });
  }
};

/* ======================
   VERIFY EMAIL OTP
====================== */
export const verifyVerificationOTP = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const record = await OTP.findOne({ email: email.toLowerCase() });
    if (!record || !(await record.compareCode(code))) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Immediately remove from DB after positive validation to avoid reuse
    await OTP.deleteOne({ email: email.toLowerCase() });

    // Generate secure email verification signature JWT token (expires in 15 mins)
    const emailVerificationSignature = jwt.sign(
      { email: email.toLowerCase(), verified: true },
      env.EMAIL_VERIFICATION_SECRET,
      { expiresIn: '15m' },
    );

    return res.status(200).json({
      message: 'Email verified successfully!',
      emailVerificationSignature,
    });
  } catch (error: unknown) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({ message: 'Verification transaction failed' });
  }
};

/* ======================
   FORGOT PASSWORD - SEND OTP
====================== */
export const sendForgotPasswordOTP = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid email address', errors: parsed.error });
    }

    const { email } = parsed.data;

    // Check if the user actually exists
    // SECURITY: Always return the same success message to prevent email enumeration (CRIT-010)
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(200)
        .json({ message: 'If an account exists with this email, a reset OTP will be sent.' });
    }

    // Block Google OAuth users from using email/password reset flow
    if (user.authProvider === AuthProvider.GOOGLE) {
      // SECURITY: Return same message to prevent enumeration
      return res
        .status(200)
        .json({ message: 'If an account exists with this email, a reset OTP will be sent.' });
    }

    // Generate cryptographically secure 6-digit numeric OTP code
    const code = crypto.randomInt(100000, 999999).toString();

    // Remove existing OTPs and create a new one (triggers pre-save hashing hook)
    await OTP.deleteMany({ email: email.toLowerCase() });
    await OTP.create({
      email: email.toLowerCase(),
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send via Google Workspace SMTP using Nodemailer
    await sendResetOTPEmail(email, code);

    if (env.NODE_ENV === 'development') {
      console.log(`[DEV RESET OTP]: The OTP for ${email} is ${code}`);
    }

    return res
      .status(200)
      .json({ message: 'If an account exists with this email, a reset OTP will be sent.' });
  } catch (error: unknown) {
    console.error('Forgot Password Send OTP Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send OTP code';
    return res.status(500).json({ message });
  }
};

/* ======================
   FORGOT PASSWORD - VERIFY OTP
====================== */
export const verifyForgotPasswordOTP = async (req: Request, res: Response) => {
  try {
    const parsed = verifyForgotPasswordOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid validation details', errors: parsed.error });
    }

    const { email, code } = parsed.data;

    const record = await OTP.findOne({ email: email.toLowerCase() });
    if (!record || !(await record.compareCode(code))) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Remove from DB immediately to prevent reuse
    await OTP.deleteOne({ email: email.toLowerCase() });

    // Generate a short-lived secure JWT signature authorizing the password change
    const passwordResetSignature = jwt.sign(
      { email: email.toLowerCase(), purpose: 'password_reset' },
      env.PASSWORD_RESET_SECRET,
      { expiresIn: '15m' },
    );

    return res.status(200).json({
      message: 'OTP verified successfully!',
      passwordResetSignature,
    });
  } catch (error: unknown) {
    console.error('Forgot Password Verify OTP Error:', error);
    return res.status(500).json({ message: 'Verification transaction failed' });
  }
};

/* ======================
   FORGOT PASSWORD - RESET PASSWORD
====================== */
export const forgotPasswordReset = async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid reset payload details', errors: parsed.error });
    }

    const { email, newPassword, passwordResetSignature } = parsed.data;

    // Verify JWT reset signature token
    try {
      const decoded = jwt.verify(passwordResetSignature, env.PASSWORD_RESET_SECRET) as {
        email: string;
        purpose: string;
      };

      if (
        decoded.email.toLowerCase() !== email.toLowerCase() ||
        decoded.purpose !== 'password_reset'
      ) {
        return res
          .status(400)
          .json({ message: 'Password reset transaction authorization is invalid' });
      }
    } catch {
      return res
        .status(400)
        .json({ message: 'Password reset authorization has expired or is invalid' });
    }

    // Retrieve full user record
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User record not found' });
    }

    // Modify password property and save document.
    // This strictly triggers the pre-save bcrypt hashing hook inside user.model.ts!
    user.password = newPassword;
    await user.save();

    // Security: Invalidate all sessions by clearing refresh token
    user.refreshToken = undefined;
    await User.findByIdAndUpdate(user._id, { $unset: { refreshToken: 1 } });

    // Send security notification email
    await sendPasswordChangeNotificationEmail(user.email).catch(console.error);

    // Audit: Record password reset
    logAudit({
      action: AuditAction.PASSWORD_RESET,
      category: AuditCategory.AUTH,
      performedBy: user,
      targetType: AuditTargetType.USER,
      targetId: user._id.toString(),
      targetLabel: user.email,
      req,
      details: 'Password reset via forgot-password flow',
    });

    return res.status(200).json({ message: 'Password has been successfully updated!' });
  } catch (error: unknown) {
    console.error('Password Reset Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update password';
    return res.status(500).json({ message });
  }
};
