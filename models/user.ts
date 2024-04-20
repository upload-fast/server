import mongoose from 'mongoose'
import { planSchema } from './Plan.js'

const { Schema } = mongoose

const userSchema = new Schema({
	firstName: String,
	lastName: String,
	githubUserName: String,
	email: String,
	plan: planSchema,
})

const UserModel = () => mongoose.model('users', userSchema)
export const User = (mongoose.models['users'] || UserModel()) as ReturnType<typeof UserModel>
