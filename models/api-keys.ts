import mongoose from 'mongoose'

const { Schema } = mongoose

const KeySchema = new Schema(
	{
		value: { type: String, unique: true },
		user_id: mongoose.Types.ObjectId,
	},
	{ timestamps: true }
)

export const Key = mongoose.model('api-keys', KeySchema)
