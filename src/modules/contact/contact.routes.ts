import { Router } from 'express';
import { submitContactForm } from './contact.controller';
import { contactLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

/* Public Contact Form Endpoint — CRIT-004: Rate-limited to prevent abuse */
router.post('/', contactLimiter, submitContactForm);

export default router;
