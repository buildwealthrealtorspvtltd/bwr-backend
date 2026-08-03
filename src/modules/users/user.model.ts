import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export enum UserRole {
  USER = 'USER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  authProvider: AuthProvider;
  isActive: boolean;
  phone?: string;
  refreshToken?: string;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allow null/undefined for Google OAuth users
    },
    authProvider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL,
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  { timestamps: true },
);

/* ======================
   PASSWORD HASHING
====================== */
userSchema.pre('save', async function () {
  // If password is not modified, just return (promises handle the rest)
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 10);
});

/* ======================
   PASSWORD COMPARISON
====================== */
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
