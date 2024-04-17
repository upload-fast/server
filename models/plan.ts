import mongoose, { Types } from 'mongoose'

const { Schema } = mongoose

const planSchema = new Schema({
	active: Boolean,
	plan_type: {
		type: String,
		enum: ['Trial', 'Tier 1', 'Tier 2'],
	},
	totalStorage: Number,
	storageCap: Number,
	paidPlan: { type: Boolean, default: false },
})
