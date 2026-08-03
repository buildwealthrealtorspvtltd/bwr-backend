import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';
import {
  getAllJobs,
  getAllJobsAdmin,
  createJob,
  updateJob,
  deleteJob,
  getJobById,
} from './job.controller';

const router = Router();

// PUBLIC: Get all active jobs
router.get('/', getAllJobs);

// ADMIN ONLY: CRUD — ⚠️ /admin/all MUST be above /:id to prevent route shadowing
router.get('/admin/all', authenticate, isAdmin, getAllJobsAdmin);
router.post('/', authenticate, isAdmin, createJob);
router.patch('/:id', authenticate, isAdmin, updateJob);
router.delete('/:id', authenticate, isAdmin, deleteJob);

// PUBLIC: Get job by ID — wildcard /:id MUST be LAST
router.get('/:id', getJobById);

export default router;
