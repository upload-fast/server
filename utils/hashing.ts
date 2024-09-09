import crypto from 'node:crypto'

export function hashString(inputString: string) {
	return crypto.createHash('sha256').update(inputString).digest('hex')
}

export function compareHashes(hash1: string, hash2: string) {
	return crypto.timingSafeEqual(Buffer.from(hash1), Buffer.from(hash2))
}
