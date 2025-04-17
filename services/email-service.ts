import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()


export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port:  587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  })

  private static readonly FROM_EMAIL = process.env.EMAIL_FROM || 'no-reply@uploadfast.dev'
  private static readonly FRONTEND_URL = process.env.FRONTEND_DOMAIN || 'uploadfast.dev'
  private static readonly BACKEND_URL = process.env.BACKEND_URL || 'https://server.uploadfast.dev'

//send email verification
  static async sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
    const verificationUrl = `${this.BACKEND_URL}/api/auth/email/verify/${token}`
    
    try {
      await this.transporter.sendMail({
        from: `"UploadFast" <${this.FROM_EMAIL}>`,
        to,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>Thank you for registering with UploadFast. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <p>Best regards,<br>The UploadFast Team</p>
          </div>
        `,
      })
      return true
    } catch (error) {
      console.error('Error sending verification email:', error)
      return false
    }
  }

//send password rest email
  static async sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `https://${this.FRONTEND_URL}/reset-password?token=${token}`
    
    try {
      await this.transporter.sendMail({
        from: `"UploadFast" <${this.FROM_EMAIL}>`,
        to,
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>You requested to reset your password. Please click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p>${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
            <p>Best regards,<br>The UploadFast Team</p>
          </div>
        `,
      })
      return true
    } catch (error) {
      console.error('Error sending password reset email:', error)
      return false
    }
  }

//welcome email after reg
  static async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"UploadFast" <${this.FROM_EMAIL}>`,
        to,
        subject: 'Welcome to UploadFast',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to UploadFast, ${name}!</h2>
            <p>Thank you for joining UploadFast. We're excited to help you manage and share your files efficiently.</p>
            <p>Here are some quick tips to get started:</p>
            <ul>
              <li>Create your first app to start organizing your files</li>
              <li>Generate an API key to upload files programmatically</li>
              <li>Explore our documentation to learn more about our features</li>
            </ul>
            <p>If you have any questions or need assistance, feel free to contact our support team.</p>
            <p>Best regards,<br>The UploadFast Team</p>
          </div>
        `,
      })
      return true
    } catch (error) {
      console.error('Error sending welcome email:', error)
      return false
    }
  }
}