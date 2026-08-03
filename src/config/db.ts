import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env';

if (env.NODE_ENV !== 'production') {
  dns.setDefaultResultOrder('ipv4first');
}

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

export const connectDB = async () => {
  let retries = 0;

  const attemptConnection = async (): Promise<void> => {
    try {
      await mongoose.connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000, // 10s timeout — generous for Atlas cold starts
        socketTimeoutMS: 45000,
        family: 4, // Force IPv4 to avoid Node.js IPv6 DNS issues
        maxPoolSize: env.NODE_ENV === 'production' ? 100 : 10,
        minPoolSize: env.NODE_ENV === 'production' ? 10 : 2,
        heartbeatFrequencyMS: 10000, // Check connection health frequently
      });
      console.log('✅ MongoDB connected with pooling');

      // Reset retries on successful connection
      retries = 0;
    } catch (error: any) {
      console.error(
        `❌ MongoDB connection failed (Attempt ${retries + 1}/${MAX_RETRIES}):`,
        error.message,
      );
      retries++;

      if (retries >= MAX_RETRIES) {
        console.error('❌ Maximum MongoDB connection retries reached.');
        console.error('⚠️ Server will stay alive — /api/health will report degraded status.');
        console.error('❌ Last error:', error.message);
        // DO NOT call process.exit() — Passenger will return 503 if we do
        throw error;
      }
      console.log(`⏳ Retrying MongoDB connection in ${RETRY_INTERVAL_MS / 1000} seconds...`);
      await new Promise((res) => setTimeout(res, RETRY_INTERVAL_MS));
      return attemptConnection();
    }
  };

  // Connection event monitoring for runtime drops
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Mongoose will automatically attempt to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected successfully.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
    // Note: Do NOT exit here. Mongoose auto-reconnects on runtime errors.
  });

  await attemptConnection();
};
