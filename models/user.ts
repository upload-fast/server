import mongoose from 'mongoose'
import { planSchema } from './plan.js'

const { Schema } = mongoose

const userSchema = new Schema({
	name: String,
	email: String,
	emailVerified: Boolean,
})

const UserModel = () => mongoose.model('users', userSchema)
export const User = (mongoose.models['users'] || UserModel()) as ReturnType<typeof UserModel>
