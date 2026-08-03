import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import cloudinary from '../../config/cloudinary';
import { env } from '../../config/env';

export const getUploadSignature = (req: AuthRequest, res: Response) => {
  try {
    const { folder = 'properties' } = req.query;

    // Validate folder to prevent arbitrary uploads
    const allowedFolders = ['properties', 'properties/documents'];
    if (!allowedFolders.includes(folder as string)) {
      return res.status(400).json({ message: 'Invalid upload folder' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      env.CLOUDINARY_API_SECRET,
    );

    return res.json({
      signature,
      timestamp,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      folder,
    });
  } catch (error: any) {
    console.error('Signature Generation Error:', error);
    return res.status(500).json({ message: 'Failed to generate upload signature' });
  }
};
