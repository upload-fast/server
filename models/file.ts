import mongoose, { Types, Schema } from 'mongoose'

export const fileSchema = new Schema(
	{
		file_name: String,
		file_type: String,
		file_size: Number,
		plan_id: Schema.Types.ObjectId,
		bucket: String,
		url: String,
		appId: Schema.Types.ObjectId,
	},
	{
		timestamps: true,
	}
)

const FileModel = () => mongoose.model('files', fileSchema)
export const UFile = (mongoose.models['files'] || FileModel()) as ReturnType<typeof FileModel>
