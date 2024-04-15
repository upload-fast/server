import mongoose from 'mongoose'
import 'dotenv/config'

export const connectToDb = async () => {
	try {
		await mongoose.connect(process.env.MONGOOSE_URI!, { dbName: 'Uploadflare' })
		console.log('Connected')
	} catch (e) {
		console.log(e)
	}
}
