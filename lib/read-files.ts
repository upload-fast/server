import { createError, H3Event } from 'h3'
import type { Options } from 'formidable'
import formidable from 'formidable'
import { File } from 'formidable'

interface ReadFilesOptions extends Options {
	getForm?: (incomingForm: any) => void
}

export async function readFiles(
	event: H3Event,
	options?: ReadFilesOptions
): Promise<{
	files: File[]
	success: boolean
}> {
	const form = formidable(options)

	try {
		const [, files] = await form.parse(event.node.req)

		if (!files.length) {
			throw createError({
				statusCode: 404,
				statusMessage: 'No files found',
			})
		}
		return {
			success: true,
			files: files.file!,
		}
	} catch (err) {
		throw err
	}
}
