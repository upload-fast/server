import mongoose, { Types } from 'mongoose'

const { Schema } = mongoose

export const planSchema = new Schema(
	{
		active: Boolean,
		plan_type: {
			type: mongoose.SchemaTypes.String,
			required: true,
		},
		storageCap: {
			type: Number,
			default: function (this) {
				//@ts-expect-error
				switch (this.plan_type) {
					case 'Trial':
						return 512000
					case 'Tier 1':
						return 5242880
					case 'Tier 2':
						return 10485760
					default:
						return '512000'
				}
			},
		},
		storageUsed: Number,
		paid: { type: Boolean, default: false },
		name: String,
	},
	{
		timestamps: true,
	}
)
