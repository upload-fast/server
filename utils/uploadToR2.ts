import { File } from 'formidable'
import { open } from 'node:fs/promises'
import { PutObjectCommand, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3'
import { S3 } from './s3'
import { readFileSync, statSync } from 'node:fs'

export async function UploadToR2({
	file,
	bucket,
	image,
}: {
	file: File
	bucket: string
	image: boolean
}) {
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

	S3.send(command)
		.then(() => {
			return { error: false, payload: params.Key }
		})
		.catch((err: any) => {
			return { error: true, payload: err }
		})
}
