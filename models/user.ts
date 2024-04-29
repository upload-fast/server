import mongoose from 'mongoose'
import { planSchema } from './Plan.js'

const { Schema } = mongoose

const userSchema = new Schema({
	name: String,
	email: String,
	plan: planSchema,
	emailVerified: Boolean,
})

const UserModel = () => mongoose.model('users', userSchema)
export const User = (mongoose.models['users'] || UserModel()) as ReturnType<typeof UserModel>
