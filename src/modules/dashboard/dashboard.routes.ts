import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin, isAgentOrAdmin } from '../../middlewares/role.middleware';
import {
  getAdminDashboardStats,
  getPendingProperties,
  reviewProperty,
  promoteUserToAgent,
  demoteAgentToUser,
} from './admin.dashboard.controller';
import { getAllPropertiesAdmin } from '../properties/property.read.controller';
import { getAgentDashboardStats } from './agent.dashboard.controller';

const router = Router();

/* Admin Routes */
router.get('/admin', authenticate, isAdmin, getAdminDashboardStats);
router.get('/admin/pending', authenticate, isAdmin, getPendingProperties);
router.post('/admin/review', authenticate, isAdmin, reviewProperty);
router.get('/admin/properties', authenticate, isAdmin, getAllPropertiesAdmin);
router.post('/admin/promote', authenticate, isAdmin, promoteUserToAgent);
router.post('/admin/demote', authenticate, isAdmin, demoteAgentToUser);

/* Agent Routes */
router.get('/agent', authenticate, isAgentOrAdmin, getAgentDashboardStats);

export default router;
