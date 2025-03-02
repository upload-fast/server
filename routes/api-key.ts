import { defineEventHandler, readBody, setResponseStatus } from "h3"
import { createError } from "h3"
import { Key } from "../models/api-keys.js"
import { UFLRouter } from "./index.js"
import { readUploadFastApp } from "../lib/read-app.js"
import { hashString } from "../lib/hash-helpers.js"
import { generateRandomString } from "../lib/custom-uuid.js"

// CREATE A NEW API KEY
UFLRouter.post(
    '/api-key',
    defineEventHandler(async (event) => {
        const { app, user_id } = await readUploadFastApp(event)

        try {
            const noOfKeys = await Key.countDocuments({
                user_id: user_id,
                app_id: app._id
            })

            if (noOfKeys >= 3) {
                throw createError({
                    status: 400,
                    message: 'Api Key Limit Exceeded',
                    statusMessage: 'Could not create API key - Limit Exceeded (3)',
                })
            }

            const key = generateRandomString({ length: 20, withPrefix: true })

            await Key.create({ value: hashString(key), user_id: user_id, app_id: app._id })

            setResponseStatus(event, 201, 'Created API key successfully')
            return {
                success: true,
                message: 'Created API key successfully',
                payload: key,
            }

        } catch (e) {
            throw createError({
                status: 500,
                message: 'Could not create api key',
                statusMessage: 'Server Error',
            })
        }
    })
)

// DELETE AN API KEY
UFLRouter.delete(
    '/api-key',
    defineEventHandler(async (event) => {
        const { app, user_id } = await readUploadFastApp(event)
        const body = await readBody(event)

        try {
            const { apiKey } = body

            const deletedKey = await Key.findOneAndDelete({
                value: apiKey.startsWith('ufl') ? hashString(apiKey) : apiKey,
                user_id,
                app_id: app._id
            })
            if (!deletedKey) {
                throw new Error('API key not found')
            }

            return { message: 'API key deleted successfully' }
        } catch (e: unknown) {
            if (e instanceof Error && e.message === 'API key not found') {
                throw createError({
                    status: 404,
                    statusMessage: 'API key not found',
                })
            }
            throw createError({
                status: 500,
                statusMessage: 'Failed to delete key',
            })
        }
    })
)
