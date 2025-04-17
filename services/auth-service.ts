import { createError } from 'h3'
import { User } from '../models/user.js'
import { Session } from '../models/session.js'
import crypto from 'node:crypto'
import { generateRandomString } from '../lib/custom-uuid.js'
import mongoose from 'mongoose'
import { EmailService } from './email-service.js'

export class AuthService {
  private static readonly SESSION_DURATION_DAYS = 35

//register user with email and password
  static async registerUser(userData: {
    email: string
    password: string
    name: string
  }): Promise<{ user: any; sessionId: string }> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email.toLowerCase() })
    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Email already registered',
      })
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Create new user
    const user = await User.create({
      email: userData.email.toLowerCase(),
      password: userData.password,
      name: userData.name,
      verificationToken,
      isEmailVerified: false,
    })

    // Create user session
    const sessionId = await this.createSession(user._id)

    // Send verification email
    try {
      await EmailService.sendVerificationEmail(
        user.email,
        user.name,
        verificationToken
      )
      
      // Send welcome email
      await EmailService.sendWelcomeEmail(user.email, user.name)
    } catch (error) {
      console.error('Failed to send verification email:', error)
      // We'll continue even if email sending fails, but log the error
    }

    // Prepare user object without sesnsitive fields
    const sanitizedUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
    }

    return { user: sanitizedUser, sessionId }
  }

//login with email and password
  static async loginWithEmailPassword(email: string, password: string): Promise<{ user: any; sessionId: string }> {
    // Find user with password field included 
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password',
      })
    }

    // Verify password
    const isPasswordValid = user.comparePassword(password)
    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password',
      })
    }

    // Create session
    const sessionId = await this.createSession(user._id)
    
    // Prepare sanitized user object
    const sanitizedUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
    }

    return { user: sanitizedUser, sessionId }
  }

//create a user session
  static async createSession(userId: mongoose.Types.ObjectId): Promise<string> {
    const sessionId = generateRandomString({ length: 32, withPrefix: false })
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_DURATION_DAYS)

    await Session.create({
      userId,
      sessionId,
      expiresAt,
    })

    return sessionId
  }

 //validate a session
  static async validateSession(sessionId: string): Promise<mongoose.Types.ObjectId | null> {
    const session = await Session.findOne({ sessionId })
    if (!session) return null
    return session.userId
  }

//delete a session
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await Session.deleteOne({ sessionId })
      return true
    } catch (error) {
      return false
    }
  }

//delete al sessions for a user
  static async deleteAllSessions(userId: mongoose.Types.ObjectId): Promise<boolean> {
    try {
      await Session.deleteMany({ userId })
      return true
    } catch (error) {
      return false
    }
  }

//request password reset
  static async requestPasswordReset(email: string): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
      })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')

    // Save hashed token to user
    user.passwordResetToken = hashedToken
    user.passwordResetExpires = new Date(Date.now() + 3600000) // 1 hour
    await user.save()
    
    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      )
    } catch (error) {
      console.error('Failed to send password reset email:', error)
      // Continue even if email sending fails, but log the error
    }

    return resetToken
  }

//reset password
  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Hash the token from the URL
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    // Find user with this token and valid expiry
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password')

    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid or expired token',
      })
    }

    // Update password and clear reset fields
    user.password = newPassword
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()
    
    // Delete all existing sessions for this user
    await this.deleteAllSessions(user._id)
    
    return true
  }

//verify email  
  static async verifyEmail(token: string): Promise<boolean> {
    const user = await User.findOne({ verificationToken: token })
    
    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid verification token',
      })
    }

    user.isEmailVerified = true
    user.verificationToken = undefined
    await user.save()
    
    return true
  }
}