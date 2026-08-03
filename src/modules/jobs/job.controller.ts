import { Request, Response } from 'express';
import { Job } from './job.model';
import { z } from 'zod';

const jobSchema = z.object({
  title: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  type: z.enum(['Full-time', 'Part-time', 'Contract', 'Internship']).optional(),
  experience: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  isActive: z.boolean().optional(),
});

// GET ALL JOBS (Public - only active)
export const getAllJobs = async (req: Request, res: Response) => {
  try {
    const filter = { isActive: true };
    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch {
    res.status(500).json({ message: 'Failed to fetch jobs' });
  }
};

// GET ALL JOBS (Admin - all jobs)
export const getAllJobsAdmin = async (req: Request, res: Response) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch {
    res.status(500).json({ message: 'Failed to fetch jobs' });
  }
};

// CREATE JOB (Admin)
export const createJob = async (req: Request, res: Response) => {
  try {
    const parsed = jobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid job data', errors: parsed.error.format() });
    }
    const job = new Job(parsed.data);
    await job.save();
    res.status(201).json(job);
  } catch {
    res.status(500).json({ message: 'Failed to create job' });
  }
};

// UPDATE JOB (Admin)
export const updateJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = jobSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid job data', errors: parsed.error.format() });
    }
    const job = await Job.findByIdAndUpdate(id, parsed.data, { new: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json(job);
  } catch {
    res.status(500).json({ message: 'Failed to update job' });
  }
};

// DELETE JOB (Admin)
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndDelete(id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json({ message: 'Job deleted successfully' });
  } catch {
    res.status(500).json({ message: 'Failed to delete job' });
  }
};

// GET JOB BY ID (Public/Admin)
export const getJobById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await Job.findOne({ _id: id, isActive: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json(job);
  } catch {
    res.status(500).json({ message: 'Failed to fetch job' });
  }
};
