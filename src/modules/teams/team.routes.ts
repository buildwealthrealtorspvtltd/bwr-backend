import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';
import { upload } from '../../middlewares/multer.middleware';
import {
  createTeamMember,
  deleteTeamMember,
  getAllTeamMembers,
  getAllTeamMembersAdmin,
  getTeamMemberById,
  updateTeamMember,
} from './team.controller';

const router = Router();

// Public routes
router.get('/', getAllTeamMembers);

// Protected Admin routes — ⚠️ MUST be above /:id to prevent route shadowing
router.get('/admin/all', authenticate, isAdmin, getAllTeamMembersAdmin);

// Wrap multer single upload to catch errors gracefully
const safeUploadSingle = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.single('photo');
  handler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
};

router.post('/', authenticate, isAdmin, safeUploadSingle, createTeamMember);
router.put('/:id', authenticate, isAdmin, safeUploadSingle, updateTeamMember);
router.delete('/:id', authenticate, isAdmin, deleteTeamMember);

// Public: Get by ID — wildcard /:id MUST be LAST
router.get('/:id', getTeamMemberById);

export default router;
