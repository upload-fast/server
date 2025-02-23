import { File } from 'formidable'
import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3'
import { R2 } from './s3-client.js'
import { statSync, unlinkSync, createReadStream } from 'node:fs'
import { H3Event, setResponseStatus } from 'h3'

export async function UploadToR2({
	file,
	bucket,
	isImage,
	event,
	fileKey,
}: {
	file: File
	bucket: string
	isImage: boolean
	event?: H3Event
	fileKey?: string
}): Promise<{ error: boolean; payload: string }> {
	const params: PutObjectCommandInput = {
		Bucket: bucket,
		Key: fileKey as string | undefined,
		ContentLength: statSync(file.filepath).size,
		Body: createReadStream(file.filepath),
		ContentType: file.mimetype!,
		ContentDisposition: isImage ? `inline; filename=${file.originalFilename}` : undefined,
		ACL: 'public-read',
	}

	const command = new PutObjectCommand(params)

	let response: { error: boolean | null; payload: string | undefined | Record<any, any> } = {
		error: null,
		payload: undefined,
	}

	R2.send(command)
		.then(() => {
			response = { error: false, payload: params.Key }
			unlinkSync(file.filepath)
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
