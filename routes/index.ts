import { DeleteObjectCommand, DeleteObjectCommandInput } from '@aws-sdk/client-s3'
import { createError, createRouter, defineEventHandler, getRouterParams, readBody, setResponseStatus } from 'h3'
import { vars } from '../consts.js'
import { addHashToFileName, generateRandomString } from '../lib/custom-uuid.js'
import { calcFileSizeInKB } from '../lib/file-size.js'
import { hashString } from '../lib/hash-helpers.js'
import { readUploadFastApp } from '../lib/read-app.js'
import { readFiles } from '../lib/read-files.js'
import { R2 } from '../lib/s3-client.js'
import { UploadToR2 } from '../lib/upload-with-s3-client.js'
import { Key } from '../models/api-keys.js'
import { App, IApp } from '../models/app.js'
import { UFile } from '../models/file.js'
import { User } from '../models/user.js'
import { FileValidationService } from '../services/file-validation-service.js'

export const UFLRouter = createRouter()

// API KEY MANAGEMENT
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



UFLRouter.post(
	'/file',
	defineEventHandler(async (event) => {
		const app = event.context.app as IApp
		const data = await readFiles(event, { multiples: true })

		try {
			// Validate all files before processing any of them
			await Promise.all(
				data.files.map(file =>
					FileValidationService.validateFile(file, app.plan.plan_type as 'Trial' | 'Tier 1' | 'Tier 2')
				)
			)

			// Validate total storage for all files
			const totalUploadSize = data.files.reduce((sum, file) =>
				sum + calcFileSizeInKB(file.size!), 0
			)

			// Check storage limit for the entire batch
			await app.validateStorageLimit(totalUploadSize)

			const uploadResponse = await Promise.all(
				data.files.map(async (file) => {
					const { mimetype, originalFilename, size } = file
					const isImage = mimetype?.startsWith('image/')!

					const fileHash = generateRandomString({ length: 4, withPrefix: false })
					const fileKey = addHashToFileName(originalFilename!, fileHash)
					const fileUrl = encodeURI(vars.R2URL + `/${fileKey}`)

					await UploadToR2({ file, fileKey, isImage, bucket: 'root', event })

					const fileSize = calcFileSizeInKB(size!)

					// Create file record and update storage metrics
					await Promise.all([
						UFile.create({
							file_name: fileKey,
							file_size: fileSize,
							file_type: mimetype,
							bucket: 'root',
							url: fileUrl,
							app_id: app?._id || (() => {
								throw createError({
									status: 500,
									statusMessage: 'Invalid app ID - app context is missing'
								})
							})()
						}),
						app.updateStorage(fileSize)
					])
					return {
						file_name: fileKey,
						file_size: fileSize,
						file_type: mimetype,
						bucket: 'root',
						url: fileUrl,
					}
				})
			)

			setResponseStatus(event, 200, 'Files Uploaded')
			return uploadResponse

		} catch (e: any) {
			// Clean up any partially uploaded files if needed
			setResponseStatus(event, e.status || 500, e.statusMessage || 'Error uploading files')
			return {
				error: true,
				message: e.statusMessage || 'Error uploading files',
				details: e.message
			}
		}
	})
)

UFLRouter.delete(
	'/file',
	defineEventHandler(async (event) => {
		try {
			const app = event.context.app

			const body = await readBody(event)

			if (!body || !body.file_url) {
				throw createError({
					status: 400,
					statusMessage: 'No URL provided in body',
				})
			}

			const file = await UFile.findOne({
				url: body.file_url,
				app_id: app._id
			})

			console.log(file)

			if (!file) {
				throw createError({
					status: 404,
					statusMessage: 'File not found in this app',
				})
			}

			// Delete file from storage
			const params: DeleteObjectCommandInput = {
				Bucket: 'root',
				Key: file.file_name!,
			}

			const command = new DeleteObjectCommand(params)
			await R2.send(command)
			await UFile.findByIdAndDelete(file._id).exec()
			// Update storage metrics
			await app.updateStorage(-file.file_size!)

			setResponseStatus(event, 200)
			return { message: 'File deleted successfully' }
		} catch (e: any) {
			throw e
		}
	})
)

// APP MANAGEMENT
UFLRouter.post(
	'/app',
	defineEventHandler(async (event) => {
		const body = await readBody(event)

		// Validate request body
		if (!body || !body.name || typeof body.name !== 'string') {
			throw createError({
				status: 400,
				statusMessage: 'App name is required and must be a string',
			})
		}

		// Validate app name format (alphanumeric, hyphens, underscores)
		const nameRegex = /^[a-zA-Z0-9-_]+$/
		if (!nameRegex.test(body.name)) {
			throw createError({
				status: 400,
				statusMessage: 'App name can only contain letters, numbers, hyphens, and underscores',
			})
		}

		try {

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

			// Check user's app limit (e.g., 5 apps for free tier)
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

// Get user's apps
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

// Delete app
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