import { DeleteObjectCommand, DeleteObjectCommandInput } from '@aws-sdk/client-s3'
import { createError, createRouter, defineEventHandler, readBody, setResponseStatus, useBase } from 'h3'
import { vars } from '../consts.js'
import { addHashToFileName, generateRandomString } from '../lib/custom-uuid.js'
import { calcFileSizeInKB } from '../lib/file-size.js'
import { readFiles } from '../lib/read-files.js'
import { R2 } from '../lib/s3-client.js'
import { UploadToR2 } from '../lib/upload-with-s3-client.js'
import { IApp } from '../models/app.js'
import { UFile } from '../models/file.js'
import { FileValidationService } from '../services/file-validation-service.js'
import authRouter from './auth.js'

export const UFLRouter = createRouter()

UFLRouter.use('/api/auth/**', useBase("/api/auth", authRouter.handler))

// UPLOAD FILES
UFLRouter.post(
	'/file',
	defineEventHandler(async (event) => {
		const app = event.context.app as IApp
		const data = await readFiles(event, { multiples: true })
		console.log(data)

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

// DELETE A FILE
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