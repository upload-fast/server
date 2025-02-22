import { createError, readBody, H3Event } from 'h3'
import { App } from '../models/app.js'


export async function readUploadFastApp(event: H3Event) {
    const body = await readBody(event)

    if (!body || !body.user_id || !body.app_name || typeof body.user_id !== 'string' || typeof body.app_name !== 'string') {
        throw createError({
            status: 400,
            message: 'User ID and app name are required and must be strings',
            statusMessage: 'Missing or invalid required information'
        })
    }

    const app = await App.findOne({
        name: body.app_name,
        userId: body.user_id
    })


    if (!app) {
        throw createError({
            status: 404,
            statusMessage: 'App not found or unauthorized'
        })
    }

    return { app, user_id: body.user_id }
}
