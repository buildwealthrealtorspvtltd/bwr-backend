import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import { globalLimiter } from './middlewares/rateLimiter.middleware';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import propertyRoutes from './modules/properties/property.routes';
import propertyMediaRoutes from './modules/properties/property.media.routes';
import propertyReadRoutes from './modules/properties/property.read.routes';
import cloudinarySignRoutes from './modules/properties/cloudinary.sign.routes';
import inquiryRoutes from './modules/inquiries/inquiry.routes';
import favoriteRoutes from './modules/favorites/favorite.routes';
import teamRoutes from './modules/teams/team.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import userRoutes from './modules/users/user.routes';
import jobRoutes from './modules/jobs/job.routes';
import contactRoutes from './modules/contact/contact.routes';
import auditRoutes from './modules/audit/auditLog.routes';
import reelRoutes from './modules/reels/reel.routes';

const app = express();

// Trust the first proxy (e.g., Next.js SSR server or Nginx) to get the real client IP for rate limiting
app.set('trust proxy', 1);

// CORS — robust multi-origin support using CLIENT_URL from .env
const rawClientUrl = env.CLIENT_URL.replace(/\/$/, '');
const allowedOrigins = [
  rawClientUrl,
  rawClientUrl.replace('https://', 'https://www.'),
  rawClientUrl.replace('http://', 'http://www.'),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-side rendering SSR)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.some((o) => origin.startsWith(o))
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

// Security Middleware
app.use(helmet());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parser limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Fix Express 5 read-only req.query for older middlewares
app.use((req: Request, res: Response, next: NextFunction) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

// Data Sanitization & Compression
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

// Global Rate Limiting
app.use('/api', globalLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/properties/upload-signature', cloudinarySignRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/properties', propertyMediaRoutes);
app.use('/api/v1/properties', propertyReadRoutes);
app.use('/api/v1/inquiries', inquiryRoutes);
app.use('/api/v1/favorites', favoriteRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/team-members', teamRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/reels', reelRoutes);

// Health check endpoint — MUST return 200 to prevent Passenger/LiteSpeed 503 false positives
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  // ALWAYS return 200 — Passenger kills the process on non-200 health responses
  res.status(200).json({
    success: true,
    status: dbStatus === 1 ? 'healthy' : 'starting',
    db: statusMap[dbStatus] || 'unknown',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    node: process.version,
    pid: process.pid,
  });
});

// Global Error Handler
// TODO: Replace any with proper type
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.url}:`, err);

  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(', ');
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Handle MongoDB Duplicate Key Error
  if (err.code === 11000) {
    status = 400;
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'unknown field';
    message = `Duplicate field value entered for ${field}`;
  }

  // Handle Zod Error
  if (err.name === 'ZodError') {
    status = 400;
    message = err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
  }

  if (env.NODE_ENV === 'production' && status === 500) {
    message = 'Internal Server Error';
  }

  res.status(status).json({ success: false, message });
});

export default app;
