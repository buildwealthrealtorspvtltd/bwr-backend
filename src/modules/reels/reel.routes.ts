import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { reelUpload } from '../../middlewares/reelUpload.middleware';
import { getCurrentReel, uploadReel, deleteReel } from './reel.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { uploadReelSchema } from './reel.schema';
import { logger } from '../../utils/logger';

const router = Router();

// Wrap multer single upload to catch limits / errors gracefully
const safeReelUpload = (req: Request, res: Response, next: NextFunction) => {
  const handler = reelUpload.single('reel');
  handler(req, res, (err: Error | multer.MulterError | unknown) => {
    if (err instanceof multer.MulterError) {
      logger.error(`Multer Reel Error: ${err.code} ${err.message}`);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(400)
          .json({ success: false, message: 'Video file too large. Maximum size is 300 MB.' });
      }
      return res
        .status(400)
        .json({ success: false, message: `Upload error: ${err.message}`, field: err.field });
    }
    if (err) {
      logger.error(`Reel Upload Error: ${(err as Error).message || err}`);
      return res
        .status(400)
        .json({ success: false, message: (err as Error).message || 'File upload error' });
    }
    next();
  });
};

// Public: Get the current active reel
router.get('/current', getCurrentReel);

// Admin only: Upload a new reel (replaces old one)
router.post(
  '/',
  authenticate,
  isAdmin,
  safeReelUpload,
  validateRequest({ body: uploadReelSchema }),
  uploadReel,
);

// Admin only: Delete the current reel
router.delete('/', authenticate, isAdmin, deleteReel);

export default router;
