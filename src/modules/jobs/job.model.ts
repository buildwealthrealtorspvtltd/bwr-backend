import mongoose, { Schema, Document } from 'mongoose';

export enum JobType {
  FULL_TIME = 'Full-time',
  PART_TIME = 'Part-time',
  CONTRACT = 'Contract',
  INTERNSHIP = 'Internship',
}

export interface IJob extends Document {
  title: string;
  location: string;
  type: JobType;
  experience: string;
  description: string;
  isActive: boolean;
  postedDate: Date;
}

const JobSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, enum: Object.values(JobType), default: JobType.FULL_TIME },
    experience: { type: String, required: true }, // e.g., "1-3 years"
    description: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    postedDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Job = mongoose.model<IJob>('Job', JobSchema);
