import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { Reel } from './reel.model';
import cloudinary from '../../config/cloudinary';
import { logAudit, AuditAction, AuditCategory, AuditTargetType } from '../audit/auditLog.service';
import { logger } from '../../utils/logger';

/* ======================
   HELPER: Delete video from Cloudinary
   
   Videos require resource_type: 'video' for deletion.
====================== */
const deleteVideoFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    // TODO: Replace any with proper type
  } catch (err: any) {
    logger.error(
      `Failed to delete video from Cloudinary publicId=${publicId}: ${err?.message || err}`,
    );
  }
};

/* ======================
   GET CURRENT REEL (Public)
   
   Returns the single active reel populated with property details, or 404 if none exists.
====================== */
export const getCurrentReel = async (req: AuthRequest, res: Response) => {
  try {
    const reel = await Reel.findOne()
      .sort({ createdAt: -1 })
      .populate('propertyId', 'title price priceUnit listingType location specs')
      .lean();

    if (!reel) {
      return res.status(404).json({ message: 'No reel available' });
    }

    return res.json(reel);
    // TODO: Replace any with proper type
  } catch (err: any) {
    logger.error(`Failed to fetch reel: ${err?.message || err}`);
    return res.status(500).json({ message: 'Failed to fetch reel' });
  }
};

/* ======================
   UPLOAD NEW REEL (Admin Only)
   
   1. Accept single video file via multer
   2. If old reel exists → delete from Cloudinary + DB
   3. Save new reel document
   4. Audit log
====================== */
export const uploadReel = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    // TODO: Replace any with proper type
    const videoUrl = (file as any).path;
    const publicId = file.filename;
    const caption = req.body.caption?.trim() || '';
    const propertyId = req.body.propertyId?.trim() || undefined;

    // Delete any existing reel (auto-cleanup)
    const existingReel = await Reel.findOne();
    if (existingReel) {
      await deleteVideoFromCloudinary(existingReel.publicId);
      await existingReel.deleteOne();

      // Audit: Record auto-deletion of old reel
      if (user) {
        logAudit({
          action: AuditAction.REEL_DELETE,
          category: AuditCategory.MEDIA,
          performedBy: user,
          targetType: AuditTargetType.REEL,
          targetId: existingReel._id.toString(),
          targetLabel: 'Previous Hero Reel',
          previousValue: existingReel.publicId,
          newValue: 'Auto-deleted on new upload',
          req,
        });
      }
    }

    // Create new reel document
    const newReel = await Reel.create({
      videoUrl,
      publicId,
      caption,
      propertyId,
      uploadedBy: user?._id,
    });

    // Populate property before returning if propertyId is attached
    const populatedReel = await Reel.findById(newReel._id)
      .populate('propertyId', 'title price priceUnit listingType location specs')
      .lean();

    // Audit: Record new reel upload
    if (user) {
      logAudit({
        action: AuditAction.REEL_UPLOAD,
        category: AuditCategory.MEDIA,
        performedBy: user,
        targetType: AuditTargetType.REEL,
        targetId: newReel._id.toString(),
        targetLabel: caption || 'Hero Reel',
        newValue: publicId,
        req,
      });
    }

    return res.status(201).json(populatedReel || newReel);
    // TODO: Replace any with proper type
  } catch (err: any) {
    logger.error(`Reel upload error: ${err?.message || err}`);
    return res.status(500).json({ message: 'Reel upload failed' });
  }
};

/* ======================
   DELETE CURRENT REEL (Admin Only)
   
   Removes the reel from both Cloudinary and the database.
====================== */
export const deleteReel = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const reel = await Reel.findOne();

    if (!reel) {
      return res.status(404).json({ message: 'No reel to delete' });
    }

    await deleteVideoFromCloudinary(reel.publicId);
    await reel.deleteOne();

    // Audit: Record reel deletion
    if (user) {
      logAudit({
        action: AuditAction.REEL_DELETE,
        category: AuditCategory.MEDIA,
        performedBy: user,
        targetType: AuditTargetType.REEL,
        targetId: reel._id.toString(),
        targetLabel: reel.caption || 'Hero Reel',
        previousValue: reel.publicId,
        newValue: 'Deleted by admin',
        req,
      });
    }

    return res.status(200).json({ message: 'Reel deleted successfully' });
    // TODO: Replace any with proper type
  } catch (err: any) {
    logger.error(`Failed to delete reel: ${err?.message || err}`);
    return res.status(500).json({ message: 'Failed to delete reel' });
  }
};
