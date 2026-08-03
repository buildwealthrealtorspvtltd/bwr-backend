import mongoose, { Schema, Document } from 'mongoose';

export interface IFavorite extends Document {
  user: mongoose.Types.ObjectId;
  property: mongoose.Types.ObjectId;
  createdAt: Date;
}

const favoriteSchema = new Schema<IFavorite>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    property: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

/* ======================
   UNIQUE CONSTRAINT
====================== */
favoriteSchema.index({ user: 1, property: 1 }, { unique: true });

export const Favorite = mongoose.model<IFavorite>('Favorite', favoriteSchema);
