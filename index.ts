import { createApp } from 'h3'
import { UFLRouter } from './routes'
import { Key } from './models/api-keys'
import Handler from './utils/apiKeyAuth'

export const app = createApp({
	onRequest: Handler,
})

app.use(UFLRouter)
