import { createApp } from 'h3'
import { UFLRouter } from './routes/index.js'
import Handler from './utils/apiKeyAuth.js'
import { createServer } from 'node:http'
import { toNodeListener } from 'h3'
import { connectToDb } from './utils/db.js'
import 'dotenv/config'

export const app = createApp({
	onRequest: Handler,
	onError: (error) => {
		console.error(error)
	},
})

app.use(UFLRouter)

// Production function call
async function startServer() {
	try {
		await connectToDb()
	} catch (err) {
		console.error('Failed to connect to the database:', err)
	}

	createServer(toNodeListener(app))
		.listen(process.env.PORT || 3000)
		.on('listening', () => console.log(`Running on ${process.env.PORT || 3000}`))
}

if (process.env.NODE_ENV === 'production') {
	startServer()
} else {
	connectToDb()
}
