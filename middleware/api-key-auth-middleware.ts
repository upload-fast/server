import { H3Event, appendCorsHeaders, createError, getRequestHeader } from 'h3'
import { Key } from '../models/api-keys.js'
import { User } from '../models/user.js'
import { hashString } from '../lib/hash-helpers.js'
import { App } from '../models/app.js'

export default async function Handler(event: H3Event) {
	// handle cors
	appendCorsHeaders(event, {
		origin: '*',
		allowHeaders: '*',
		methods: '*',
	})

	const excludedPaths = ['/api-key', '/app']

	if (!excludedPaths.includes(event.path)) {
		const apikey = getRequestHeader(event, 'api-key') || getRequestHeader(event, 'x-api-key')
		if (!apikey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'No API key provided in request',
			})
		}

		const existingKey = await Key.findOne({ value: apikey.startsWith('ufl_') ? hashString(apikey) : apikey })

		if (!existingKey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Invalid API key',
			})
		}

		const app = await App.findById(existingKey.app_id).exec()
		if (!app) {
			throw createError({
				statusCode: 404,
				statusMessage: 'App not found',
			})
		}

		if (!app?.plan?.active) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Inactive plan, please activate your plan',
			})
		}

		if (!event.context.key && !event.context.user) {
			const user = await User.findById(existingKey.user_id).exec()
			event.context.key = existingKey
			event.context.user = user
		}
	}

}
