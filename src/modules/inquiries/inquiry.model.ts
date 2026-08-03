import mongoose, { Schema, Document } from 'mongoose';

export interface IInquiry extends Document {
  property: mongoose.Types.ObjectId;
  agent: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  message?: string;
  source: 'FORM' | 'WHATSAPP' | 'CALL';
  isRead: boolean;
  createdAt: Date;
}

const inquirySchema = new Schema<IInquiry>(
  {
    property: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },

    agent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      enum: ['FORM', 'WHATSAPP', 'CALL'],
      default: 'FORM',
      index: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const Inquiry = mongoose.model<IInquiry>('Inquiry', inquirySchema);
