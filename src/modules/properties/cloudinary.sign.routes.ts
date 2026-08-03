import { Router } from 'express';
import { getUploadSignature } from './cloudinary.sign.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAgentOrAdmin } from '../../middlewares/role.middleware';

const router = Router();

router.get('/', authenticate, isAgentOrAdmin, getUploadSignature);

export default router;
