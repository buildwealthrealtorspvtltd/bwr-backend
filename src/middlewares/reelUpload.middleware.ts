import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

/* ======================
   REEL VIDEO UPLOAD MIDDLEWARE

   Separate multer instance for video uploads.
   - Uploads to Cloudinary folder: 'reels'
   - resource_type: 'video'
   - Max file size: 300 MB
   - Allowed: mp4, webm, quicktime (mov)
====================== */
const reelStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async () => ({
    folder: 'reels',
    resource_type: 'video',
    allowed_formats: ['mp4', 'webm', 'mov'],
  }),
});

export const reelUpload = multer({
  storage: reelStorage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, and MOV videos are allowed.'));
    }
  },
});
