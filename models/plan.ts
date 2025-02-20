import mongoose from 'mongoose'

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
				const GB_IN_KB = 2 ** 20 // 1GB in kilobytes
				//@ts-expect-error
				switch (this.plan_type) {
					case 'Trial':
						return GB_IN_KB // 1GB storage
					case 'Tier 1':
						return 15 * GB_IN_KB // 15GB storage
					case 'Tier 2':
						return 120 * GB_IN_KB // 120GB storage
					default:
						return GB_IN_KB // Default 1GB storage
				}
			},
		},
		storageUsed: Number,
		paid: { type: Boolean, default: false },
		name: String,
		uploadCap: {
			type: Number,
			default: function (this) {
				//@ts-expect-error
				switch (this.plan_type) {
					case 'Quick Fix':
						return 500
					case 'Tier 1':
						return 5000
					case 'Tier 2':
						return 10 ** 3
					default:
						return 500
				}
			},
		},
	},
	{
		timestamps: true,
	}
)
