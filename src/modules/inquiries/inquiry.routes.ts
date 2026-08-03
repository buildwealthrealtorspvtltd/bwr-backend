import { Router } from 'express';
import { createInquiry } from './inquiry.controller';
import {
  getAgentInquiries,
  getAllInquiriesAdmin,
  markAdminInquiriesRead,
} from './inquiry.read.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin, isAgentOrAdmin } from '../../middlewares/role.middleware';
import { writeLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

/* Public — CRIT-003: Rate-limited to prevent spam/DoS */
router.post('/', writeLimiter, createInquiry);

/* Agent */
router.get('/agent', authenticate, isAgentOrAdmin, getAgentInquiries);

/* Admin */
router.get('/admin', authenticate, isAdmin, getAllInquiriesAdmin);
router.patch('/admin/mark-read', authenticate, isAdmin, markAdminInquiriesRead);

export default router;
