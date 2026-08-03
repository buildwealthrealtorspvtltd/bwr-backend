import cloudinary from '../../config/cloudinary';

export const uploadImageToCloudinary = async (buffer: Buffer, folder = 'properties') => {
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (error, result) => {
        if (error || !result) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      })
      .end(buffer);
  });
};

export const deleteImageFromCloudinary = async (publicId: string) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    console.error('Failed to delete image from Cloudinary (Missing or Network Issue):', publicId);
  }
};

export const uploadDocumentToCloudinary = async (
  buffer: Buffer,
  folder = 'properties/documents',
) => {
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'auto' }, (error, result) => {
        if (error || !result) {
          return reject(error);
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      })
      .end(buffer);
  });
};
