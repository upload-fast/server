import 'dotenv/config'
import { createApp } from 'h3'
import { UFLRouter } from './routes/index.js'
import { Key } from './models/api-keys.js'
import Handler from './utils/apiKeyAuth.js'
import { createServer } from 'node:http'
import { toNodeListener } from 'h3'
import { connectToDb } from './utils/db.js'

export const app = createApp({
	onRequest: Handler,
	onError: (error) => {
		console.error(error)
	},
})

app.use(UFLRouter)

// Hehe
async function startServer() {
	try {
		await connectToDb()
		console.log('Connected to the database')
	} catch (err) {
		console.error('Failed to connect to the database:', err)
	}

	createServer(toNodeListener(app))
		.listen(process.env.PORT || 3000)
		.on('listening', () => console.log(`Running on ${process.env.PORT || 3000}`))
}

startServer()
