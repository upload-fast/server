import mongoose from 'mongoose'
import { connectToDb } from '../utils/db.js'

const { Schema } = mongoose

const KeySchema = new Schema(
	{
		value: { type: String, unique: true, required: true },
		user_id: mongoose.Types.ObjectId,
		active: Boolean,
	},
	{ timestamps: true }
)

const KeyModel = () => mongoose.model('api-keys', KeySchema)
export const Key = (mongoose.models['api-keys'] || KeyModel()) as ReturnType<typeof KeyModel>
