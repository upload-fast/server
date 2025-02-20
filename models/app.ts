import mongoose, { Schema, Document, Types } from 'mongoose'

interface IApp extends Document {
	id: Types.ObjectId
	name: string
	description: string
	planId: string
	createdAt: Date
	updatedAt: Date
}

const AppSchema: Schema = new Schema<IApp>(
	{
		name: { type: String, required: true },
		description: String,
		planId: Schema.Types.ObjectId,
	},
	{
		timestamps: true,
	}
)

const UserApp = mongoose.model<IApp>('apps', AppSchema)
export default UserApp
