import mongoose from 'mongoose'

const { Schema } = mongoose

const fileSchema = new Schema({
	file_name: String,
	file_type: String,
	file_size: Number,
	fast_id: mongoose.Types.ObjectId,
	bucket: String,
	url: String,
})
