import { H3Event, createError, getRequestHeader } from 'h3'
import { Key } from '../models/api-keys'
import { User } from '../models/user'

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

	if (!event.context.key && !event.context.user) {
		const user = await User.findById(existingKey.user_id).exec()
		event.context.key = existingKey
		event.context.user = user
	}
}
