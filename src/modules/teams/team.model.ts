import mongoose, { Schema, Document } from 'mongoose';

export interface ITeamMember extends Document {
  name: string;
  designation: string;
  department: string[];
  photo?: {
    url: string;
    publicId: string;
  };
  isActive: boolean;
  order: number;
}

const TeamMemberSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    designation: { type: String, required: true },
    department: { type: [String], required: true },
    photo: {
      url: { type: String },
      publicId: { type: String },
    },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const TeamMember = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);
