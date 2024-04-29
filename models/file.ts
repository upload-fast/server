import mongoose from 'mongoose'

const { Schema } = mongoose

export const fileSchema = new Schema(
	{
		file_name: String,
		file_type: String,
		file_size: Number,
		plan_id: mongoose.Types.ObjectId,
		bucket: String,
		url: String,
	},
	{
		timestamps: true,
	}
)

const FileModel = () => mongoose.model('files', fileSchema)
export const UFile = (mongoose.models['files'] || FileModel()) as ReturnType<typeof FileModel>
