import { H3Event } from 'h3'
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
	files: File[] | null
	success: boolean
}> {
	const form = formidable(options)

	try {
		const [fields, files] = await form.parse(event.node.req)

		return {
			success: true,
			files: files.file ?? null,
		}
	} catch (err) {
		return {
			files: null,
			success: false,
		}
	}
}
