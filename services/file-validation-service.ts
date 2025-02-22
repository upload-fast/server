import { createError } from "h3"
import { File } from 'formidable'

export class FileValidationService {
    private static allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'image/heic',
        'image/heif',
        'image/jpg',
        'application/pdf',
        // Add more as needed
    ])

    private static maxFileSizeInMB = {
        'Trial': 500,
        'Tier 1': 1024,
        'Tier 2': 5120
    }

    static validateFile(file: File, planType: keyof typeof FileValidationService.maxFileSizeInMB) {
        if (!this.allowedTypes.has(file.mimetype!)) {
            throw createError({
                status: 400,
                statusMessage: 'File type not allowed'
            })
        }

        const fileSizeInMB = file.size / (1024 * 1024)
        const maxSize = this.maxFileSizeInMB[planType]

        if (fileSizeInMB > maxSize) {
            throw createError({
                status: 400,
                statusMessage: `File size exceeds the ${maxSize}MB limit for your plan`
            })
        }
    }
} 