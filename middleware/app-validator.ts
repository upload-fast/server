import { H3Event, createError } from 'h3'
import { App } from '../models/app.js'

export async function validateAppMiddleware(event: H3Event) {
    const appName = event.headers.get('x-app-name')

    if (!appName) {
        throw createError({
            status: 400,
            statusMessage: 'App name is required',
        })
    }

    const user = event.context.user._doc


    const app = await App.findOne({
        name: appName,
        userId: user._id
    })

    if (!app) {
        throw createError({
            status: 404,
            statusMessage: 'App not found or unauthorized',
        })
    }

    // Add app to context for route handlers
    event.context.app = app

    return event
} 