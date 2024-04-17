import { H3Event, createError, getRequestHeader } from 'h3'
import { Key } from '../models/api-keys'

export default async function Handler(event: H3Event) {
	const apikey = getRequestHeader(event, 'api-key')
	if (!apikey) {
		throw createError({
			statusCode: 401,
			statusMessage: 'No API key provided',
		})
	}

	const existingKey = await Key.findOne({ value: apikey })

	if (!existingKey) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Invalid API key',
		})
	}
	event.context.key = existingKey
}
