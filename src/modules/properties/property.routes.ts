import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin, isAgentOrAdmin } from '../../middlewares/role.middleware';
import { globalLimiter, writeLimiter } from '../../middlewares/rateLimiter.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { z } from 'zod';
import {
  createProperty,
  updateProperty,
  deleteProperty,
  approveProperty,
  assignAgent,
  trackWhatsAppClick,
} from './property.controller';

const router = Router();

/* ==================================================
   WRITE ROUTES (Create, Update, Delete, Approve, Assign, Tracking)
================================================== */

// TRACK WHATSAPP CLICK
router.post(
  '/:id/whatsapp-click',
  optionalAuthenticate,
  globalLimiter,
  validateRequest({
    params: z.object({ id: z.string().min(1) }),
    body: z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        message: z.string().optional(),
      })
      .optional(),
  }),
  trackWhatsAppClick,
);

// CREATE PROPERTY
router.post('/', authenticate, writeLimiter, createProperty);

// UPDATE PROPERTY
router.patch('/:id', authenticate, isAgentOrAdmin, updateProperty);

// DELETE PROPERTY
router.delete('/:id', authenticate, isAgentOrAdmin, deleteProperty);

// APPROVE PROPERTY (Admin Only)
router.patch('/:id/approve', authenticate, isAdmin, approveProperty);

// ASSIGN AGENT (Admin Only)
router.patch('/:id/assign-agent', authenticate, isAdmin, assignAgent);

export default router;
