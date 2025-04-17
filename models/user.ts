import mongoose, { Document, Schema, Types } from 'mongoose'
import { planSchema } from './plan.js'
import { compareSync, hashSync } from 'bcrypt'

export interface IUser extends Document {
  _id: Types.ObjectId;
  githubId?: string;
  email: string;
  name: string;
  avatar?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  
  comparePassword(candidatePassword: string): boolean;
}

const UserSchema = new Schema<IUser>(
  {
    githubId: {
      type: String,
      sparse: true,  
    },
    email: {
      type: String, 
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
    password: {
      type: String,
      select: false,  
    },
    accessToken: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
)

// Index 
UserSchema.index({ email: 1 })

// Hash password before saving
UserSchema.pre('save', function(next) {
  const user = this
  
  // Only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next()
  
  try {
    // Generate a salt and hash
    user.password = hashSync(user.password as string, 10)
    next()
  } catch (error) {
    next(error as Error)
  }
})

//compare password
UserSchema.methods.comparePassword = function(candidatePassword: string): boolean {
  return compareSync(candidatePassword, this.password)
}

const UserModel = () => mongoose.model<IUser>('User', UserSchema)
export const User = (mongoose.models['User'] || UserModel()) as ReturnType<typeof UserModel>