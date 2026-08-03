import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Inquiry } from './inquiry.model';
import { Property } from '../properties/property.model';
import { PropertyStatus } from '../properties/property.enums';
import { canSendInquiry } from './inquiry.spam';
import { createInquirySchema } from './inquiry.schemas';
import { User } from '../users/user.model';
import { sendInquiryEmail } from '../../utils/sendEmail';

/* ======================
   CREATE INQUIRY
====================== */
export const createInquiry = async (req: Request, res: Response) => {
  try {
    // 1. Validate Input
    const parsed = createInquirySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parsed.error.format() });
    }

    const { propertyId, name, email, phone, message } = parsed.data;

    // Validate if propertyId is a valid mongoose ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({ message: 'Invalid property ID format' });
    }

    // 2. Find Property
    const property = await Property.findOne({
      _id: propertyId,
      status: PropertyStatus.APPROVED,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // 3. Spam Check
    const allowed = await canSendInquiry(propertyId, email);
    if (!allowed) {
      return res.status(429).json({
        message: 'Too many inquiries. Please try later.',
      });
    }

    // 4. Route to Agent
    const agentId = property.assignedAgent || property.uploadedBy;

    const inquiry = await Inquiry.create({
      property: property._id,
      agent: agentId,
      name,
      email,
      phone,
      message,
    });

    // 5. Send Notification Email (Fire-and-forget for lightning fast response)
    (async () => {
      try {
        const agent = await User.findById(agentId).select('email');
        const agentEmail = agent ? agent.email : '';
        await sendInquiryEmail({
          name,
          email,
          phone,
          message: message || '',
          propertyName: property.title,
          agentEmail,
        });
      } catch (emailError) {
        console.error('Failed to send inquiry email:', emailError);
      }
    })();

    return res.status(201).json({
      message: 'Inquiry submitted',
      inquiryId: inquiry._id,
    });
  } catch {
    return res.status(500).json({ message: 'Inquiry failed' });
  }
};
