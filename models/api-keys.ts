import mongoose from 'mongoose'

const { Schema } = mongoose

const keySchema = new Schema(
	{
		value: {
			type: String,
			required: true,
			unique: true
		},
		user_id: {
			type: Schema.Types.ObjectId,
			ref: 'users',
			required: true
		},
		app_id: {
			type: Schema.Types.ObjectId,
			ref: 'apps',
			required: true
		},
		active: {
			type: Boolean,
			default: true
		}
	},
	{
		timestamps: true
	}
)

// Create a compound index to ensure uniqueness of keys per app
keySchema.index({ app_id: 1, value: 1 }, { unique: true })

const KeyModel = () => mongoose.model('api-keys', keySchema)
export const Key = (mongoose.models['api-keys'] || KeyModel()) as ReturnType<typeof KeyModel>
