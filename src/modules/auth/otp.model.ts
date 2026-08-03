import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IOTP extends Document {
  email: string;
  code: string;
  expiresAt: Date;
  compareCode(candidateCode: string): Promise<boolean>;
}

const otpSchema = new Schema<IOTP>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete when this date is reached
    },
  },
  { timestamps: true },
);

otpSchema.pre('save', async function () {
  if (!this.isModified('code')) return;
  const salt = await bcrypt.genSalt(10);
  this.code = await bcrypt.hash(this.code, salt);
});

otpSchema.methods.compareCode = async function (candidateCode: string) {
  return bcrypt.compare(candidateCode, this.code);
};

export const OTP = mongoose.model<IOTP>('OTP', otpSchema);
