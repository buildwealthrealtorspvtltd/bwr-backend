import { Inquiry } from './inquiry.model';

export const canSendInquiry = async (propertyId: string, email: string): Promise<boolean> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const count = await Inquiry.countDocuments({
    property: propertyId,
    email,
    createdAt: { $gte: oneHourAgo },
  });

  return count < 3;
};
