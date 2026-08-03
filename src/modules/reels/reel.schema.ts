import { z } from 'zod';

export const uploadReelSchema = z.object({
  caption: z.string().max(200, 'Caption cannot exceed 200 characters').optional(),
  propertyId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID')
    .optional()
    .or(z.literal('')),
});

export type UploadReelInput = z.infer<typeof uploadReelSchema>;
