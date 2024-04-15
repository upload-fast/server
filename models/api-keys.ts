import mongoose from 'mongoose'
import { connectToDb } from '../utils/db'

const { Schema } = mongoose

connectToDb()
const KeySchema = new Schema(
	{
		value: { type: String, unique: true, required: true },
		user_id: mongoose.Types.ObjectId,
	},
	{ timestamps: true }
)

const KeyModel = () => mongoose.model('api-keys', KeySchema)
export const Key = (mongoose.models['api-keys'] || KeyModel()) as ReturnType<typeof KeyModel>
