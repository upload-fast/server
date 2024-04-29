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

export const UFLRouter = createRouter()

type ApiKeyRequest = {
	user_id?: ObjectId
}

// API KEY
UFLRouter.post(
	'/api-key',
	defineEventHandler(async (event) => {
		const res: ApiKeyRequest = await readBody(event)

		if (!res.user_id || typeof res.user_id !== 'string') {
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
						})

						const userId = event.context.user._doc._id

						const res = await User.findById(userId)

						res!.plan!.storageUsed! = res!.plan!.storageUsed! + file_size

						await res?.save()

						return {
							file_name: originalFilename,
							file_size,
							file_type: mimetype,
							bucket: 'root',
							url: encodeURI(vars.R2URL + `/${originalFilename}`),
							value: res,
						}
					})
				)
				return uploadResponse
			} catch (e: any) {
				setResponseStatus(event, 500, 'Error uploading files')
				return { payload: e.message, message: 'Error uploading files' }
			}
		}
	})
)

UFLRouter.get(
	'/',
	defineEventHandler((event) => {
		if (event.context.user) {
			return event.context.user._doc
		}
		return 'Bye'
	})
)
