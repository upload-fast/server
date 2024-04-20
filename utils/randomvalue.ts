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
