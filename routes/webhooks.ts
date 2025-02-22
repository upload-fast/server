import { createHmac, timingSafeEqual } from 'crypto'
import { createError, defineEventHandler, readRawBody } from 'h3'
import { App } from '../models/app.js'
import { LemonSqueezyWebhookBody } from '../types/lemon-squeezy.js'
import { UFLRouter } from './index.js'

UFLRouter.post('/sync', defineEventHandler(async (event) => {
    // Verify webhook signature
    const rawBody = await readRawBody(event)
    if (!rawBody) throw createError({ status: 400, message: 'No body provided' })

    const signature = event.headers.get('x-signature')
    if (!signature) throw createError({ status: 400, message: 'No signature provided' })

    const hmac = createHmac('sha256', process.env.WEBHOOK_SECRET!)
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8')
    const signatureBuffer = Buffer.from(signature, 'utf8')

    if (!timingSafeEqual(Buffer.from(digest), signatureBuffer)) {
        throw createError({ status: 400, message: 'Invalid signature' })
    }

    const payload = JSON.parse(rawBody.toString()) as LemonSqueezyWebhookBody
    const { user_id, app_name } = payload.meta.custom_data
    const eventName = payload.meta.event_name

    // Find the app
    const app = await App.findOne({ name: app_name, userId: user_id })

    if (!app) {
        throw createError({ status: 404, message: 'App not found' })
    }

    switch (eventName) {
        case 'subscription_updated': {
            const planType = payload.data.attributes.variant_name
            const status = payload.data.attributes.status

            if (status === 'active' || status === 'on_trial') {
                await app.switchAppPlan(planType)
            } else if (status === 'expired') {
                await app.switchAppPlan('Trial')
            }
            break
        }

        case 'subscription_created':
        case 'order_created': {
            const planType = payload.data.attributes.variant_name
            await app.switchAppPlan(planType)
            break
        }
    }

    return { success: true }
})) 