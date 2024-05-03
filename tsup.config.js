import { defineConfig } from 'tsup'

export default defineConfig({
	outExtension() {
		return {
			js: `.mjs`,
		}
	},
})
