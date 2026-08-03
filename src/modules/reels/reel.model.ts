import mongoose, { Schema, Document } from 'mongoose';

/* ======================
   REEL INTERFACE
====================== */
export interface IReel extends Document {
  videoUrl: string;
  publicId: string;
  thumbnailUrl?: string;
  caption?: string;
  propertyId?: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/* ======================
   REEL SCHEMA
   
   Design: Only one reel document exists at a time.
   When a new reel is uploaded, the old one is deleted
   from both the database and Cloudinary to save storage.
====================== */
const reelSchema = new Schema<IReel>(
  {
    videoUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    caption: {
      type: String,
      maxlength: 200,
      trim: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

export const Reel = mongoose.model<IReel>('Reel', reelSchema);
