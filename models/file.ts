import mongoose, { Types, Schema } from 'mongoose'

export const fileSchema = new Schema(
	{
		file_name: String,
		file_type: String,
		file_size: Number,
		bucket: String,
		url: String,
		app_id: { type: Schema.Types.ObjectId, ref: 'apps', required: true },
	},
	{
		timestamps: true,
	}
)

const FileModel = () => mongoose.model('files', fileSchema)
export const UFile = (mongoose.models['files'] || FileModel()) as ReturnType<typeof FileModel>
