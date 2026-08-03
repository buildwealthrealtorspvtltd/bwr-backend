import nodemailer from 'nodemailer';
import { env } from '../config/env';

interface SendEmailOptions {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// Utility to escape HTML and prevent Email Injection / XSS
const escapeHtml = (unsafe: string) => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// HIGH-004: Create a singleton transporter instead of recreating it on every request
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.SMTP_EMAIL,
    pass: env.SMTP_PASSWORD,
  },
});

export const sendContactEmail = async (options: SendEmailOptions) => {
  // Define the email options
  const mailOptions = {
    from: `"Build Wealth Realtors" <${env.SMTP_EMAIL}>`,
    to: env.RECEIVER_EMAIL, // Send it to the admin/business owner
    replyTo: options.email, // If you click "reply", it goes to the visitor
    subject: `New Contact Inquiry: ${escapeHtml(options.subject)}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #520606; border-bottom: 2px solid #520606; padding-bottom: 10px;">New Contact Form Submission</h2>
        
        <p><strong>Name:</strong> ${escapeHtml(options.name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(options.email)}">${escapeHtml(options.email)}</a></p>
        <p><strong>Phone:</strong> ${options.phone ? `<a href="tel:${escapeHtml(options.phone)}">${escapeHtml(options.phone)}</a>` : 'Not provided'}</p>
        <p><strong>Subject:</strong> ${escapeHtml(options.subject)}</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin-top: 0; font-weight: bold; color: #333;">Message:</p>
          <p style="white-space: pre-wrap; color: #555;">${escapeHtml(options.message)}</p>
        </div>
        
        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
          This email was sent automatically from the Build Wealth Realtors website contact form.
        </p>
      </div>
    `,
  };

  // 3. Send the email
  await transporter.sendMail(mailOptions);
};

export interface SendInquiryEmailOptions {
  name: string;
  email: string;
  phone: string;
  message: string;
  propertyName: string;
  agentEmail: string;
}

export const sendInquiryEmail = async (options: SendInquiryEmailOptions) => {
  const mailOptions = {
    from: `"Build Wealth Realtors" <${env.SMTP_EMAIL}>`,
    to: [env.RECEIVER_EMAIL, options.agentEmail].filter(Boolean).join(', '),
    replyTo: options.email,
    subject: `New Property Lead: ${escapeHtml(options.propertyName)}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #520606; border-bottom: 2px solid #520606; padding-bottom: 10px;">New Property Inquiry</h2>
        
        <p><strong>Property:</strong> ${escapeHtml(options.propertyName)}</p>
        <p><strong>Lead Name:</strong> ${escapeHtml(options.name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(options.email)}">${escapeHtml(options.email)}</a></p>
        <p><strong>Phone:</strong> <a href="tel:${escapeHtml(options.phone)}">${escapeHtml(options.phone)}</a></p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin-top: 0; font-weight: bold; color: #333;">Message:</p>
          <p style="white-space: pre-wrap; color: #555;">${escapeHtml(options.message || 'No message provided.')}</p>
        </div>
        
        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
          This email was sent automatically from the Build Wealth Realtors website.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
