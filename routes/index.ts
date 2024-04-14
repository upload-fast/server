import { createRouter, defineEventHandler, readFormData, setResponseStatus } from 'h3'
import { readFiles } from '../utils/readFiles'

export const UFLRouter = createRouter()

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
