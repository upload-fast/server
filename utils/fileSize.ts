import { readFileSync, statSync } from 'node:fs'

export function calcFileSizeInKB(size: number) {
	const fileSizeInKB = size / 1024
	return fileSizeInKB.toFixed(2) // Return the size with two decimal places
}
