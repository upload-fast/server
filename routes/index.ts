import {
	createError,
	createRouter,
	defineEventHandler,
	readBody,
	readFormData,
	readRawBody,
	setResponseStatus,
} from 'h3'
import { readFiles } from '../utils/readFiles'
import 'dotenv/config'
import type { ObjectId } from 'mongoose'
import { Key } from '../models/api-keys'
import { generateRandomString } from '../utils/randomvalue'

export const UFLRouter = createRouter()

type ApiKeyRequest = {
	user_id?: ObjectId
}

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
			await Key.create({ value: generateRandomString(28), user_id: res.user_id })
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
			return `${event.node.res.statusCode}`
		} else return data
	})
)
