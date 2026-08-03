import dns from 'dns';
if (process.env.NODE_ENV !== 'production') {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

/**
 * CRITICAL FIX FOR cPanel / Phusion Passenger / LiteSpeed:
 *
 * Passenger expects the Node.js process to bind to a port IMMEDIATELY.
 * If `connectDB()` takes time (MongoDB Atlas DNS, retries, IP whitelist),
 * Passenger times out and returns 503 Service Unavailable.
 *
 * Solution: Start HTTP listener FIRST, then connect DB in background.
 * The /api/health endpoint will report DB status without blocking startup.
 */
const port = env.PORT || '5000';

const server = app.listen(port, () => {
  console.log(`🚀 BWR Backend listening on port ${port} (${env.NODE_ENV})`);
  console.log(`📍 Process ID: ${process.pid}`);
  console.log(`📍 Node.js: ${process.version}`);
  console.log(`📍 Working directory: ${process.cwd()}`);
});

// Connect to MongoDB in background — does NOT block Passenger startup
connectDB()
  .then(() => {
    console.log('✅ MongoDB connection established after server start');
  })
  .catch((err: unknown) => {
    console.error('❌ MongoDB connection failed after retries:', err);
    // Don't exit — let the health endpoint report degraded status
    // Passenger will keep the process alive and DB may reconnect
  });

/* ======================
   PROCESS CRASH HANDLERS
   Prevent silent crashes in production
====================== */
process.on('unhandledRejection', (reason: unknown) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  // Log but don't exit in production — let Passenger manage restarts
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});
