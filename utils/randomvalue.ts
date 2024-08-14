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
	alphabet: string = '0123456789abcdefghijklmnopqrstuvwxyz'
): string {
	let result = ''
	for (let i = 0; i < length; i++) {
		result += alphabet[generateRandomInteger(alphabet.length)]
	}
	return 'ufl_' + result
}

export function uuid({
	length,
	alphabet = '0123456789abcdefghijklmnopqrstuvwxyz',
	withPrefix = true,
}: {
	length: number
	alphabet?: string
	withPrefix: boolean
}) {
	let result = ''
	for (let i = 0; i < length; i++) {
		result += alphabet[generateRandomInteger(alphabet.length)]
	}
	return withPrefix ? 'ufl_' + result : result
}

export function addHashToFileName(fileName: string, hash: string) {
	const splits = fileName.split('.')
	splits[0] = splits[0] + `-${hash}.`

	return splits.join('')
}

console.log(os.tmpdir())
