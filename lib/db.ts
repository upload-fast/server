import mongoose from 'mongoose'
import 'dotenv/config'
let cachedConnection: typeof mongoose | null = null

export const connectToDb = async () => {
	try {
		if (process.env.NODE_ENV !== 'production') {
			if (cachedConnection && mongoose.connection.readyState === 1) {
				console.log('Using cached test db connection')
				return cachedConnection
			}
			cachedConnection = await mongoose.connect(process.env.MONGO_URI!, { dbName: 'uploadfast-test' })
			console.log('Connected to test db!')
			return cachedConnection
		}

		await mongoose.connect(process.env.MONGO_URI!, { dbName: 'Uploadfast' })
		console.log('Connected to db!')
	} catch (e) {
		console.log(e)
	}
}

export const disconnectFromDb = async () => {
	try {
		await mongoose.disconnect()
		console.log('Disconnected from database')
		if (cachedConnection) {
			cachedConnection = null
		}
	} catch (e) {
		console.error('Error disconnecting from database:', e)
	}
}


