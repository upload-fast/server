import os from 'node:os'

function generateRandomInteger(max: number): number {
	const bytes = new Uint8Array(1)
	crypto.getRandomValues(bytes)
	if (bytes[0]! < max) {
		return bytes[0]!
	}
	return generateRandomInteger(max)
}

export function generateRandomString(
	length: number,
	alphabet: string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
): string {
	let result = ''
	for (let i = 0; i < length; i++) {
		result += alphabet[generateRandomInteger(alphabet.length)]
	}
	return 'ufl_' + result
}

export function uuid({
	withPrefix = true,
}: {
	withPrefix: boolean
}) {
	// Use a more secure random generator for identifiers
	const bytes = new Uint8Array(32) // Increased to 32 bytes for more entropy
	crypto.getRandomValues(bytes)

	// Set version (4) and variant (2) bits according to RFC4122
	bytes[6] = (bytes[6]! & 0x0f) | 0x40
	bytes[8] = (bytes[8]! & 0x3f) | 0x80

	// Convert to hex string with additional entropy
	const hex = Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')

	// Format as UUID with dashes, using first 32 chars for standard UUID format
	const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`

	// Add timestamp to make it even more unique
	const timestamp = Date.now().toString(36)
	const identifier = `${uuid}-${timestamp}`

	return withPrefix ? 'ufl_' + identifier : identifier
}

export function addHashToFileName(fileName: string, hash: string) {
	const splits = fileName.split('.')
	splits[0] = splits[0] + `-${hash}.`

	return splits.join('')
}

