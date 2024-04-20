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

		try {
			await Key.create({ value: generateRandomString(20), user_id: res.user_id })
			setResponseStatus(event, 201, 'Created API key successfully')
			return {
				success: true,
				message: 'Created API key successfully',
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
		const data = await readFiles(event)

		if (!data.files) {
			setResponseStatus(event, 404, 'No files found')
			return `${event.node.res.statusCode} No files in this dunya`
		} else {
			try {
				data.files.forEach(async (file) => {
					const res = await UploadToR2({ file, bucket: 'root', image: true, event })
				})
				setResponseStatus(event, 200, 'Files uploaded successfully')
				return 'Files Uploaded'
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
			return event.context.user._doc.name
		}
		return 'Bye'
	})
)
