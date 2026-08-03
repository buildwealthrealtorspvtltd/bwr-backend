import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.SMTP_EMAIL,
    pass: env.SMTP_PASSWORD,
  },
});

export const sendOTPEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: `"Build Wealth Realtors" <${env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Email Verification OTP - Build Wealth Realtors',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #520606; margin: 0; font-size: 26px; tracking: tight;">Build Wealth Realtors</h2>
          <p style="color: #888888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 5px 0 0 0;">Exclusive Premium Properties</p>
        </div>
        
        <div style="border-top: 3px solid #520606; padding-top: 30px;">
          <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-top: 0;">Hello,</p>
          <p style="font-size: 15px; color: #555555; line-height: 1.6;">Thank you for registering with Build Wealth Realtors. Please verify your email address to secure your account. Use the 6-digit One-Time Password (OTP) below:</p>
          
          <div style="background-color: #f9f9ff; border: 1px solid rgba(82, 6, 6, 0.08); border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #520606; letter-spacing: 6px; font-family: 'Courier New', Courier, monospace;">${otp}</span>
          </div>
          
          <p style="font-size: 13px; color: #888888; line-height: 1.6; margin-bottom: 0;">This OTP code is highly confidential and valid for only <strong>5 minutes</strong>. If you did not initiate this registration request, please ignore this email or contact our support team.</p>
        </div>
        
        <div style="border-top: 1px solid #eeeeee; margin-top: 40px; padding-top: 20px; text-align: center; font-size: 12px; color: #aaaaaa;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Build Wealth Realtors Pvt. Ltd. Siliguri, WB, India.</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; color: #520606; text-transform: uppercase; letter-spacing: 1px;">CREDAI & NAR India Member</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Nodemailer Send Mail Error:', error);
    // eslint-disable-next-line preserve-caught-error
    throw new Error('Failed to send verification email. Please try again.');
  }
};

export const sendResetOTPEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: `"Build Wealth Realtors" <${env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Reset Password OTP - Build Wealth Realtors',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #520606; margin: 0; font-size: 26px; tracking: tight;">Build Wealth Realtors</h2>
          <p style="color: #888888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 5px 0 0 0;">Exclusive Premium Properties</p>
        </div>
        
        <div style="border-top: 3px solid #520606; padding-top: 30px;">
          <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-top: 0;">Hello,</p>
          <p style="font-size: 15px; color: #555555; line-height: 1.6;">We received a request to reset the password for your Build Wealth Realtors account. Use the 6-digit One-Time Password (OTP) below to authorize this password reset:</p>
          
          <div style="background-color: #fcf9f9; border: 1px solid rgba(82, 6, 6, 0.08); border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #520606; letter-spacing: 6px; font-family: 'Courier New', Courier, monospace;">${otp}</span>
          </div>
          
          <p style="font-size: 13px; color: #888888; line-height: 1.6; margin-bottom: 0;">This OTP code is highly confidential and valid for only <strong>5 minutes</strong>. If you did not request a password reset, please ignore this email immediately and secure your account if necessary.</p>
        </div>
        
        <div style="border-top: 1px solid #eeeeee; margin-top: 40px; padding-top: 20px; text-align: center; font-size: 12px; color: #aaaaaa;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Build Wealth Realtors Pvt. Ltd. Siliguri, WB, India.</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; color: #520606; text-transform: uppercase; letter-spacing: 1px;">CREDAI & NAR India Member</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Nodemailer Send Password Reset OTP Error:', error);
    // eslint-disable-next-line preserve-caught-error
    throw new Error('Failed to send password reset code. Please try again.');
  }
};

export const sendPasswordChangeNotificationEmail = async (email: string) => {
  const mailOptions = {
    from: `"Build Wealth Realtors Security" <${env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Security Alert: Your Password Was Changed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #520606; margin: 0; font-size: 26px; tracking: tight;">Build Wealth Realtors</h2>
        </div>
        
        <div style="border-top: 3px solid #520606; padding-top: 30px;">
          <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-top: 0;">Hello,</p>
          <p style="font-size: 15px; color: #555555; line-height: 1.6;">This is an automated notification to inform you that the password for your Build Wealth Realtors account was recently changed.</p>
          
          <div style="background-color: #fcf9f9; border-left: 4px solid #520606; padding: 15px; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #333;"><strong>When:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p style="font-size: 14px; color: #d32f2f; font-weight: bold; line-height: 1.6;">If you did not make this change, please contact our support team immediately to secure your account.</p>
        </div>
      </div>
    `,
  };

  try {
    // Fire and forget
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Nodemailer Send Password Change Notification Error:', error);
  }
};
