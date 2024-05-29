import { H3Event, appendCorsHeaders, createError, getRequestHeader } from 'h3'
import { Key } from '../models/api-keys.js'
import { User } from '../models/user.js'

export default async function Handler(event: H3Event) {
	// handle cors
	appendCorsHeaders(event, {
		origin: '*',
		allowHeaders: '*',
		methods: '*',
	})

	// Disable Auth Check if the request is for creating API Keys
	if (event.path !== '/api-key') {
		const apikey = getRequestHeader(event, 'api-key')
		if (!apikey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'No API key provided in request',
			})
		}
		const existingKey = await Key.findOne({ value: apikey })

		if (!existingKey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Invalid API key',
			})
		}

		if (!existingKey.active) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Inactive API key, activate your api key',
			})
		}

		if (!event.context.key && !event.context.user) {
			const user = await User.findById(existingKey.user_id).exec()
			event.context.key = existingKey
			event.context.user = user
		}
	}
}
