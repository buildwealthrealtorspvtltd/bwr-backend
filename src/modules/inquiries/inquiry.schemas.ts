import { z } from 'zod';

export const createInquirySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  message: z.string().optional(),
});
