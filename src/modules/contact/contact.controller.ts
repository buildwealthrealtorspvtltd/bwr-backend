import { Request, Response } from 'express';
import { z } from 'zod';
import { sendContactEmail } from '../../utils/sendEmail';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
});

export const submitContactForm = async (req: Request, res: Response) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Contact Form Validation Failed:', parsed.error.format());
      return res.status(400).json({ message: 'Invalid input', errors: parsed.error.format() });
    }

    const { name, email, phone, subject, message } = parsed.data;

    // Send the email asynchronously in the background (fire and forget)
    // This allows the frontend to receive a success response instantly
    sendContactEmail({
      name,
      email,
      phone,
      subject,
      message,
    }).catch((emailError) => {
      console.error('Background Email Sending Failed:', emailError.message || emailError);
    });

    return res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error: any) {
    console.error('Failed to send contact email. Nodemailer Error:', error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
      errorDetail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
