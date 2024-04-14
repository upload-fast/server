import { H3Event, defaultContentType, send, setResponseStatus } from 'h3'
import type { Fields, Files, Options } from 'formidable'
import formidable from 'formidable'
import { File } from 'formidable'

interface ReadFilesOptions extends Options {
	getForm?: (incomingForm: any) => void
}

export async function readFiles(
	event: H3Event,
	options?: ReadFilesOptions
): Promise<
	| {
			files: File[] | null
			success: boolean
			error?: { value: boolean; payload?: Record<any, any> }
	  }
	| { files: null; error: { value: boolean; payload?: Record<any, any> } }
> {
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
			error: {
				value: true,
				payload: err,
			},
		}
	}
}
