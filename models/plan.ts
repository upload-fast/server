import mongoose, { Types } from 'mongoose'

const { Schema } = mongoose

export const planSchema = new Schema({
	active: Boolean,
	plan_type: {
		type: String,
		enum: ['Trial', 'Tier 1', 'Tier 2'],
	},
	totalStorage: Number,
	storageCap: Number,
	paid: { type: Boolean, default: false },
})
