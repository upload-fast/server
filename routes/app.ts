import { DeleteObjectCommand, DeleteObjectCommandInput } from "@aws-sdk/client-s3"
import vine, { errors } from "@vinejs/vine"
import { createError, defineEventHandler, getRouterParams, readBody, setResponseStatus } from "h3"
import { readUploadFastApp } from "../lib/read-app.js"
import { R2 } from "../lib/s3-client.js"
import { Key } from "../models/api-keys.js"
import { App } from "../models/app.js"
import { UFile } from "../models/file.js"
import { User } from "../models/user.js"
import { UFLRouter } from "./index.js"
import { Infer } from "@vinejs/vine/types"

const createAppEndpointBodySchema = vine.object({
    name: vine.string().minLength(1).maxLength(100),
    description: vine.string().maxLength(255).nullable(),
    user_id: vine.string(),
    plan: vine.string().nullable(),
})

// CREATE A NEW APP
UFLRouter.post(
    '/app',
    defineEventHandler(async (event) => {
        const body: Infer<typeof createAppEndpointBodySchema> = await readBody(event)
        try {
            await vine.validate({ schema: createAppEndpointBodySchema, data: body })
            const user = await User.findById(body.user_id).exec()

            if (!user) {
                throw createError({
                    status: 404,
                    statusMessage: 'User not found',
                })
            }

            // Check if app name already exists for this user
            const existingApp = await App.findOne({
                name: body.name,
                userId: user._id
            })

            if (existingApp) {
                throw createError({
                    status: 400,
                    statusMessage: 'An app with this name already exists',
                })
            }

            const userAppsCount = await App.countDocuments({
                userId: user._id
            })

            if (userAppsCount >= 5) {
                throw createError({
                    status: 403,
                    statusMessage: 'You have reached the maximum number of apps allowed (5)',
                })
            }

            // Create new app with default Trial plan
            const newApp = await App.create({
                name: body.name,
                description: body.description || '',
                userId: user._id,
                plan: {
                    active: false,
                    plan_type: 'Trial',
                    paid: false,
                },
                storageMetrics: {
                    totalUsed: 0,
                    filesCount: 0,
                    monthlyUploads: 0,
                    lastCalculated: new Date()
                }
            })

            setResponseStatus(event, 201)
            return {
                message: 'App created successfully',
                app: {
                    id: newApp._id,
                    name: newApp.name,
                    description: newApp.description,
                    plan: {
                        type: newApp.plan.plan_type,
                        storageCap: newApp.plan.storageCap,
                        uploadCap: newApp.plan.uploadCap
                    },
                    created_at: newApp.createdAt
                }
            }

        } catch (e: any) {
            if (e instanceof errors.E_VALIDATION_ERROR) {
                throw createError({
                    status: 400,
                    statusMessage: "Validation error on request body",
                })
            }
            // Check if error is from Mongoose unique constraint
            if (e.code === 11000) {
                throw createError({
                    status: 400,
                    statusMessage: 'An app with this name already exists',
                })
            }

            throw createError({
                status: 500,
                statusMessage: 'Failed to create app - ' + e.message,
            })
        }
    })
)

// GET USER'S APPS
UFLRouter.get(
    '/app',
    defineEventHandler(async (event) => {
        const body = await readBody(event)
        const { user_id } = body

        if (!body || !user_id || typeof user_id !== 'string') {
            throw createError({
                status: 400,
                statusMessage: 'User ID is required and must be a string'
            })
        }

        try {
            const apps = await App.find({ userId: user_id }, {
                name: 1,
                description: 1,
                'plan.plan_type': 1,
                'plan.storageCap': 1,
                'plan.uploadCap': 1,
                storageMetrics: 1,
                createdAt: 1
            }).sort({ createdAt: -1 })

            return {
                apps: apps.map((app: { _id: any; name: any; description: any; plan: { plan_type: any; storageCap: any; uploadCap: any }; storageMetrics: { totalUsed: any; filesCount: any; monthlyUploads: any }; createdAt: any }) => ({
                    id: app._id,
                    name: app.name,
                    description: app.description,
                    plan: {
                        type: app.plan.plan_type,
                        storageCap: app.plan.storageCap,
                        uploadCap: app.plan.uploadCap
                    },
                    storage: {
                        used: app.storageMetrics.totalUsed,
                        filesCount: app.storageMetrics.filesCount,
                        monthlyUploads: app.storageMetrics.monthlyUploads
                    },
                    created_at: app.createdAt
                }))
            }
        } catch (e: any) {
            throw createError({
                status: 500,
                statusMessage: 'Failed to fetch apps - ' + e.message,
            })
        }
    })
)

// DELETE APP
UFLRouter.delete(
    '/app',
    defineEventHandler(async (event) => {
        const { app, user_id } = await readUploadFastApp(event)

        try {
            // Delete all files associated with this app
            const files = await UFile.find({ app_id: app._id })

            // Delete files from storage
            await Promise.all(files.map(async (file) => {
                const params: DeleteObjectCommandInput = {
                    Bucket: 'root',
                    Key: file.file_name!,
                }
                const command = new DeleteObjectCommand(params)
                await R2.send(command)
            }))

            // Delete all records
            await Promise.all([
                UFile.deleteMany({ app_id: app._id }),
                Key.deleteMany({ app_id: app._id }),
                App.findByIdAndDelete(app._id)
            ])

            return {
                message: 'App and all associated data deleted successfully'
            }
        } catch (e: any) {
            throw createError({
                status: 500,
                statusMessage: 'Failed to delete app - ' + e.message,
            })
        }
    })
)

// GET APP FILES
UFLRouter.get(
    '/app/:id/files',
    defineEventHandler(async (event) => {
        const { id } = getRouterParams(event)

        const app = await App.findById(id)

        if (!app) {
            throw createError({
                status: 404,
                statusMessage: 'App not found',
            })
        }

        const files = await UFile.find({ app_id: app._id })

        return files
    })
)