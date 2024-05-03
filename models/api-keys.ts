import mongoose, { Types } from 'mongoose'
import { connectToDb } from '../utils/db.js'

const { Schema } = mongoose

export const KeySchema = new Schema(
	{
		value: { type: String, unique: true, required: true },
		user_id: { type: mongoose.SchemaTypes.ObjectId, index: true },
		active: { type: Boolean, default: false },
	},
	{ timestamps: true }
)

const KeyModel = () => mongoose.model('api-keys', KeySchema)
export const Key = (mongoose.models['api-keys'] || KeyModel()) as ReturnType<typeof KeyModel>
