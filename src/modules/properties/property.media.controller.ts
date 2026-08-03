import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { Property, IProperty } from './property.model';
import { deleteImageFromCloudinary } from './property.media';
import { UserRole } from '../users/user.model';
import { logAudit, AuditAction, AuditCategory, AuditTargetType } from '../audit/auditLog.service';

/* ======================
   RBAC Helper: Check if user can modify this property's media
====================== */
const canModifyPropertyMedia = (user: AuthRequest['user'], property: IProperty): boolean => {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.USER) return false;

  // Agent: must be owner or assigned
  return (
    property.uploadedBy?.toString() === user._id.toString() ||
    property.assignedAgent?.toString() === user._id.toString()
  );
};

/* ======================
   UPLOAD IMAGES
====================== */
export const uploadPropertyImages = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const property = await Property.findById(id);
    if (!property || property.isDeleted) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (!canModifyPropertyMedia(user, property as unknown as IProperty)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No images provided' });
    }

    if (property.images.length + files.length > 12) {
      return res.status(400).json({ message: 'Maximum 12 images allowed' });
    }

    for (const file of files) {
      property.images.push({ url: (file as any).path, publicId: file.filename });
    }

    await property.save();

    // Audit: Record image upload
    if (req.user) {
      logAudit({
        action: AuditAction.MEDIA_UPLOAD,
        category: AuditCategory.MEDIA,
        performedBy: req.user,
        targetType: AuditTargetType.PROPERTY,
        targetId: id as string,
        targetLabel: property.title,
        newValue: `${files.length} image(s) uploaded`,
        req,
      });
    }

    return res.json(property.images);
  } catch {
    return res.status(500).json({ message: 'Image upload failed' });
  }
};

/* ======================
   REMOVE IMAGE
====================== */
export const removePropertyImage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawPublicId = req.params.publicId;
    const publicId = Array.isArray(rawPublicId) ? rawPublicId.join('/') : rawPublicId;
    const user = req.user;

    const property = await Property.findById(id);
    if (!property || property.isDeleted) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (!canModifyPropertyMedia(user, property as unknown as IProperty)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const image = property.images.find((img) => img.publicId === publicId);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    await deleteImageFromCloudinary(publicId as string);

    property.images = property.images.filter((img) => img.publicId !== publicId);

    await property.save();

    // Audit: Record image deletion
    if (req.user) {
      logAudit({
        action: AuditAction.MEDIA_DELETE,
        category: AuditCategory.MEDIA,
        performedBy: req.user,
        targetType: AuditTargetType.PROPERTY,
        targetId: id as string,
        targetLabel: property.title,
        previousValue: `Image: ${publicId}`,
        newValue: 'Deleted',
        req,
      });
    }

    return res.json(property.images);
  } catch {
    return res.status(500).json({ message: 'Image removal failed' });
  }
};

/* ======================
   SET COVER IMAGE
====================== */
export const setCoverImage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawPublicId = req.params.publicId;
    const publicId = Array.isArray(rawPublicId) ? rawPublicId.join('/') : rawPublicId;
    const user = req.user;

    const property = await Property.findById(id);
    if (!property || property.isDeleted) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (!canModifyPropertyMedia(user, property as unknown as IProperty)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const index = property.images.findIndex((img) => img.publicId === publicId);

    if (index === -1) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Move selected image to index 0
    const [coverImage] = property.images.splice(index, 1);
    property.images.unshift(coverImage);

    await property.save();
    return res.json(property.images);
  } catch {
    return res.status(500).json({ message: 'Failed to set cover image' });
  }
};
