import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { upload } from '../../middlewares/multer.middleware';
import {
  uploadPropertyImages,
  removePropertyImage,
  setCoverImage,
} from './property.media.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAgentOrAdmin } from '../../middlewares/role.middleware';

const router = Router();

// Wrap multer array upload to catch limits / errors gracefully
const safeUploadArray = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.array('images', 12);
  handler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer Array Error:', err.code, err.message);
      return res.status(400).json({ message: `Upload error: ${err.message}`, field: err.field });
    }
    if (err) {
      console.error('Upload Array Error:', err.message);
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
};

router.post('/:id/images', authenticate, isAgentOrAdmin, safeUploadArray, uploadPropertyImages);

// Enforce wildcard matching (*), allowing directory/slashes inside Cloudinary public IDs
router.patch('/:id/images/*publicId/set-cover', authenticate, isAgentOrAdmin, setCoverImage);

router.delete('/:id/images/*publicId', authenticate, isAgentOrAdmin, removePropertyImage);

export default router;
