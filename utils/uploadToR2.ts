import { File } from 'formidable'
import { PutObjectCommand, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3'
import { S3 } from './s3.js'
import { readFileSync, statSync } from 'node:fs'
import { H3Event, setResponseStatus } from 'h3'

export async function UploadToR2({
	file,
	bucket,
	image,
	event,
}: {
	file: File
	bucket: string
	image: boolean
	event?: H3Event
}): Promise<{ error: boolean; payload: string }> {
	const body = readFileSync(file.filepath)

	const params: PutObjectCommandInput = {
		Bucket: bucket,
		Key: file.originalFilename as string | undefined,
		ContentLength: statSync(file.filepath).size,
		Body: body,
		ContentType: file.mimetype!,
		ContentDisposition: image ? `inline; filename=${file.originalFilename}` : undefined,
		ACL: 'public-read',
	}

	const command = new PutObjectCommand(params)

	let response: { error: boolean | null; payload: string | undefined | Record<any, any> } = {
		error: null,
		payload: undefined,
	}

	S3.send(command)
		.then(() => {
			response = { error: false, payload: params.Key }
		})
		.catch((error: any) => {
			const errorString = {
				name: error.name,
				message: error.message,
				stack: error.stack,
			}

			// CREDENTIAL ERROR DEBUGGING
			setResponseStatus(event!, 500, 'Credential error')
			event?.respondWith(Response.json({ data: errorString }))
		})

	return response as { error: boolean; payload: any }
}
