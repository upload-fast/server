export function calcFileSizeInKB(size: number) {
	const fileSizeInKB = size / 1024
	return Number(fileSizeInKB.toFixed(2)) // Return the size with two decimal places
}
