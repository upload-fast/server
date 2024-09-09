import { H3Event, appendCorsHeaders, createError, getRequestHeader } from 'h3'
import { Key } from '../models/api-keys.js'
import { User } from '../models/user.js'
import { hashString } from './hashing.js'

export default async function Handler(event: H3Event) {
	// handle cors
	appendCorsHeaders(event, {
		origin: '*',
		allowHeaders: '*',
		methods: '*',
	})

	const excludedPaths = ['/api-key', '/upgrade']

	// Don't run this code block if path is in the excludePaths.
	if (!excludedPaths.includes(event.path)) {
		const apikey = getRequestHeader(event, 'api-key')
		if (!apikey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'No API key provided in request',
			})
		}

		let existingKey =
			(await Key.findOne({ value: apikey })) ?? (await Key.findOne({ value: hashString(apikey) }))

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
