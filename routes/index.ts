import {
	createError,
	createRouter,
	defaultContentType,
	defineEventHandler,
	readBody,
	readFormData,
	readRawBody,
	setResponseStatus,
} from 'h3'
import { readFiles } from '../utils/readFiles.js'
import type { ObjectId } from 'mongoose'
import { Key } from '../models/api-keys.js'
import { generateRandomString } from '../utils/randomvalue.js'
import { UploadToR2 } from '../utils/uploadToR2.js'
import { calcFileSizeInKB } from '../utils/fileSize.js'
import { UFile } from '../models/file.js'
import { vars } from '../consts.js'
import { User } from '../models/user.js'
import { DeleteObjectCommand, DeleteObjectCommandInput } from '@aws-sdk/client-s3'
import { S3 } from '../utils/s3.js'

export const UFLRouter = createRouter()

type ApiKeyRequest = {
	user_id?: ObjectId
}

// API KEY
UFLRouter.post(
	'/api-key',
	defineEventHandler(async (event) => {
		const res: ApiKeyRequest = await readBody(event)

		if (!res || !res.user_id || typeof res.user_id !== 'string') {
			throw createError({
				status: 400,
				message: 'No user ID provided or bad format',
				statusMessage: 'No user ID provided or bad format',
			})
		}

		const existingUser = await User.findById(res.user_id)

		if (!existingUser) {
			throw createError({
				status: 400,
				message: 'No user found to assign key to',
				statusMessage: 'We could not find that user',
			})
		}

		const noOfKeys = await Key.countDocuments({ user_id: res.user_id })

		if (noOfKeys >= 3) {
			throw createError({
				status: 400,
				message: 'Api Key Limit Exceeded',
				statusMessage: 'Could not create API key - Limit Exceeded (3)',
			})
		}

		try {
			const key = generateRandomString(20)
			await Key.create({ value: key, user_id: existingUser._id })
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
				statusMessage: 'Could not create api key',
			})
		}
	})
)

//API KEY DELETE ENDPOINT
// UFLRouter.delete(
// 	'/api-key',
// 	defineEventHandler(async (event) => {
// 		const body = await readBody(event)

// 		if (!body) {
// 			throw createError({
// 				status: 400,
// 				statusMessage: 'No body found',
// 			})
// 		}

// 		const { user_id, apiKey } = body

// 		const key = Key.findOneAndDelete({})
// 	})
// )

// UPLOAD
UFLRouter.get(
	'/upload',
	defineEventHandler(() => {
		return `
        <html>
        <body>
        <form method="POST" encType="multipart/form-data"> <input type="file" name="file" multiple /> <button type="submit">Submit file</button> <form/>
        <body />
        <html/>
        `
	})
)

UFLRouter.post(
	'/upload',
	defineEventHandler(async (event) => {
		const data = await readFiles(event, { multiples: true })

		if (!data.files) {
			setResponseStatus(event, 404, 'No files found')
			return `No files to upload!`
		} else {
			try {
				// Get user from context
				const user = event.context.user._doc

				// Check if plan has been exceeded. Add some slight ojoro.
				if (user!.plan!.storageUsed > user!.plan!.storageCap + 1024) {
					throw createError({
						statusCode: 400,
						statusText: 'You have exceeded your storage limits',
					})
				}

				// Go ahead and upload files.
				const uploadResponse = await Promise.all(
					data.files.map(async (file) => {
						const { mimetype, originalFilename, size } = file
						const isImage = file.mimetype?.startsWith('image/')!
						await UploadToR2({ file, bucket: 'root', image: isImage })

						const file_size = calcFileSizeInKB(size)

						await UFile.create({
							file_name: originalFilename,
							file_size,
							file_type: mimetype,
							bucket: 'root',
							url: encodeURI(vars.R2URL + `/${originalFilename}`),
							// @ts-ignore
							plan_id: user?.plan?._id,
						})

						// Pulling current user ID from context
						const userId = user._id

						// We need to fetch so we can update - for some reason findByIdAndUpdate didn't work.
						const userToUpdate = await User.findById(userId)

						// Update storage level on embedded plan document in user
						userToUpdate!.plan!.storageUsed! = userToUpdate!.plan!.storageUsed! + file_size

						await userToUpdate?.save()

						return {
							file_name: originalFilename,
							file_size,
							file_type: mimetype,
							bucket: 'root',
							url: encodeURI(vars.R2URL + `/${originalFilename}`),
						}
					})
				)
				// Final response
				setResponseStatus(event, 200, 'Files Uploaded')
				return uploadResponse
			} catch (e: any) {
				setResponseStatus(event, 500, 'Error uploading files')
				return { payload: e.message, message: 'Error uploading files' }
			}
		}
	})
)

UFLRouter.delete(
	'/upload',
	defineEventHandler(async (event) => {
		const key = event.context.key
		const user = event.context.user._doc

		const body = await readBody(event)

		if (!body || !body.file_url) {
			throw createError({
				status: 400,
				statusMessage: 'No URL provided in body',
				statusText: 'No url found',
			})
		}

		const file_url = body.file_url

		const file = await UFile.findOne({ url: file_url })

		if (!file) {
			setResponseStatus(event, 400, 'File not found')
			return { message: 'Error deleting file - file not found' }
		}

		if (file!.plan_id!.toString() !== user.plan._id.toString()) {
			setResponseStatus(event, 403)
			return {
				message: 'You do not have permission to delete this file',
			}
		}

		const params: DeleteObjectCommandInput = {
			Bucket: 'root',
			Key: file.file_name!,
		}

		const command = new DeleteObjectCommand(params)

		try {
			await S3.send(command)
			await UFile.findByIdAndDelete(file._id)
			const planUser = await User.findByIdAndUpdate(user._id)

			planUser!.plan!.storageUsed = planUser!.plan!.storageUsed! - file.file_size!

			await planUser?.save()

			setResponseStatus(event, 200)
			return { message: 'File deleted successfully' }
		} catch (e: any) {
			throw createError({
				status: 500,
				statusMessage: 'Failed to delete file - ' + e.message,
			})
		}
	})
)

// UFLRouter.get(
// 	'/',
// 	defineEventHandler((event) => {
// 		if (event.context.user) {
// 			return event.context.user._doc.plan._id.toString()
// 		}
// 		return 'Bye'
// 	})
// )
