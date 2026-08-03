import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    if (file.mimetype === 'application/pdf') {
      return {
        folder: 'properties/documents',
        resource_type: 'raw',
        format: 'pdf',
      };
    } else if (req.baseUrl && req.baseUrl.includes('team-members')) {
      return {
        folder: 'team_members',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      };
    } else {
      return {
        folder: 'properties',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      };
    }
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // HIGH-015: Validate MIME type to prevent malicious uploads (e.g. .exe disguised as .jpg)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, WebP, and PDF are allowed.'));
    }
  },
});
