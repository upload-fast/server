import mongoose, { Document, Schema } from 'mongoose'
import { planSchema } from './plan.js'

export interface IUser extends Document {
	githubId: string
	email: string
	name: string
	avatar?: string
	accessToken?: string
	refreshToken?: string
	createdAt: Date
	updatedAt: Date
}

const UserSchema = new Schema<IUser>(
	{
		githubId: {
			type: String,
			required: true,
			unique: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		name: {
			type: String,
			required: true,
		},
		avatar: {
			type: String,
		},
		accessToken: {
			type: String,
		},
		refreshToken: {
			type: String,
		},
	},
	{ timestamps: true }
)

const UserModel = () => mongoose.model('User', UserSchema)
export const User = (mongoose.models['User'] || UserModel()) as ReturnType<typeof UserModel>
