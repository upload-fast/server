import mongoose, { Types } from 'mongoose'
import { connectToDb } from '../lib/db.js'

const { Schema } = mongoose

export const KeySchema = new Schema(
	{
		value: { type: String, unique: true, required: true },
		user_id: { type: mongoose.SchemaTypes.ObjectId, index: true },
		active: { type: Boolean, default: false },
		name: { type: String, unique: true },
	},
	{ timestamps: true }
)

const KeyModel = () => mongoose.model('api-keys', KeySchema)
export const Key = (mongoose.models['api-keys'] || KeyModel()) as ReturnType<typeof KeyModel>
