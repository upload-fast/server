import { createApp, createError, getRequestHeader } from 'h3'
import { UFLRouter } from './routes'
import { Key } from './models/api-keys'

export const app = createApp({
	onRequest: async (event) => {
		const apikey = getRequestHeader(event, 'api-key')
		if (!apikey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'No API key provided',
			})
		}

		try {
			const existingKey = await Key.findOne({ value: apikey })

			if (!existingKey) {
				throw createError({
					statusCode: 401,
					statusMessage: 'Invalid API key',
				})
			}
			event.context.key = existingKey
		} catch (e) {
			throw createError({
				statusCode: 500,
				statusMessage: 'Internal Server Error',
			})
		}
	},
})

app.use(UFLRouter)

// send()
