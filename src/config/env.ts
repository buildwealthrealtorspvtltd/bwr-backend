import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  CLIENT_URL: z.string().min(1, 'CLIENT_URL is required'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  SMTP_EMAIL: z.string().min(1, 'SMTP_EMAIL is required'),
  SMTP_PASSWORD: z.string().min(1, 'SMTP_PASSWORD is required'),
  RECEIVER_EMAIL: z.string().min(1, 'RECEIVER_EMAIL is required'),
  EMAIL_VERIFICATION_SECRET: z.string().optional(),
  PASSWORD_RESET_SECRET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('='.repeat(60));
  console.error('❌ BWR Backend: Invalid environment variables!');
  console.error('='.repeat(60));
  console.error('Missing or invalid keys:');
  const formatted = parsedEnv.error.format();
  for (const [key, value] of Object.entries(formatted)) {
    if (key === '_errors') continue;
    // TODO: Replace any with proper type
    const errors = (value as any)?._errors;
    if (errors && errors.length > 0) {
      console.error(`  ❌ ${key}: ${errors.join(', ')}`);
    }
  }
  console.error('='.repeat(60));
  console.error('Ensure .env file exists in the application root directory');
  console.error('Current working directory:', process.cwd());
  console.error('='.repeat(60));
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  EMAIL_VERIFICATION_SECRET:
    parsedEnv.data.EMAIL_VERIFICATION_SECRET || `${parsedEnv.data.JWT_SECRET}_email_verify`,
  PASSWORD_RESET_SECRET:
    parsedEnv.data.PASSWORD_RESET_SECRET || `${parsedEnv.data.JWT_SECRET}_password_reset`,
};
