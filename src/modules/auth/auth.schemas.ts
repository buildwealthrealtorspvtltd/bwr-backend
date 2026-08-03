import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
  phone: z.string().min(10).max(15),
  emailVerificationSignature: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordOTPSchema = z.object({
  email: z.string().email(),
});

export const verifyForgotPasswordOTPSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z
    .string()
    .min(8)
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
  passwordResetSignature: z.string().min(1),
});
