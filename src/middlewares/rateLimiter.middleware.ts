import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Global limiter: 300 requests per 15 mins per IP (10000 in dev) to allow rapid filtering bursts
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 10000 : 300,
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth limiter: 10 requests per 15 mins per IP (1000 in dev)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 1000 : 10,
  message: { message: 'Too many login attempts from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write limiter: 20 requests per 15 mins per IP
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 1000 : 20,
  message: { message: 'Too many write requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Contact limiter: 5 requests per 15 mins per IP
export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 100 : 5,
  message: { message: 'Too many contact requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
