import { H3Event, appendCorsHeaders, createError, getRequestHeader } from 'h3'
import { hashString } from '../lib/hash-helpers.js'
import { Key } from '../models/api-keys.js'
import { App } from '../models/app.js'
import { User } from '../models/user.js'
import { AppCache, KeyCache, UserCache } from '../services/cache-service.js'

export default async function Handler(event: H3Event) {
	// handle cors
	appendCorsHeaders(event, {
		origin: '*',
		allowHeaders: '*',
		methods: '*',
	})

	const excludedPaths = ['/api-key', '/app', '/api/auth']

	// Check if the path starts with any of the excluded paths
	if (!excludedPaths.some(path => event.path.startsWith(path))) {
		const apikey = getRequestHeader(event, 'api-key') || getRequestHeader(event, 'x-api-key')
		if (!apikey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'No API key provided in request',
			})
		}

		const existingKey = await KeyCache.getOrSet({
			key: apikey,
			ttl: 60 * 60 * 24 * 10,
			factory: async () => {
				return await Key.findOne({ value: apikey.startsWith('ufl_') ? hashString(apikey) : apikey })
			},
		})

		if (!existingKey) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Invalid API key',
			})
		}

		const app = await AppCache.getOrSet({
			key: `${existingKey.app_id}`,
			ttl: 60 * 60 * 24 * 10,
			factory: async () => {
				return await App.findById(existingKey.app_id).exec()
			},
		})

		if (!app) {
			throw createError({
				statusCode: 404,
				statusMessage: 'App for this API key not found',
			})
		}

		if (!app?.plan?.active) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Inactive plan, please activate your plan',
			})
		}

		if (!event.context.user) {
			const user = await UserCache.getOrSet({
				key: `${app.userId}`,
				ttl: 60 * 60 * 24 * 2,
				factory: async () => {
					return await User.findById(app.userId).exec()
				},
			})
			event.context.key = existingKey
			event.context.user = user
			event.context.app = app
		}
	}

}
