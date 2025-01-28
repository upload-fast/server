import mongoose from 'mongoose'
import 'dotenv/config'

export const connectToDb = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URI!, { dbName: 'Uploadfast' })
		console.log('Connected to db!')
	} catch (e) {
		console.log(e)
	}
}
