import { Types } from 'mongoose'
import { UFile } from '../models/file.js'
import { createError } from 'h3'

interface StorageStats {
    totalUsed: number
    filesCount: number
    monthlyUploads: number
    lastCalculated: Date
}

export class StorageService {
    static async calculateStorageStats(appId: Types.ObjectId): Promise<StorageStats> {
        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()

        const [totalFiles, monthlyFiles] = await Promise.all([
            UFile.aggregate([
                { $match: { app_id: appId } },
                {
                    $group: {
                        _id: null,
                        totalSize: { $sum: '$file_size' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            UFile.countDocuments({
                app_id: appId,
                createdAt: {
                    $gte: new Date(currentYear, currentMonth, 1),
                    $lt: new Date(currentYear, currentMonth + 1, 1)
                }
            })
        ])

        return {
            totalUsed: totalFiles[0]?.totalSize || 0,
            filesCount: totalFiles[0]?.count || 0,
            monthlyUploads: monthlyFiles,
            lastCalculated: new Date()
        }
    }

    static async validateStorageLimit(appId: Types.ObjectId, fileSize: number, plan: any): Promise<void> {
        const stats = await this.calculateStorageStats(appId)

        if (stats.totalUsed + fileSize > plan.storageCap) {
            throw createError({
                status: 403,
                statusMessage: `Storage limit exceeded. You have used ${stats.totalUsed >= 1048576 ? (stats.totalUsed/1048576).toFixed(2) + 'GB' : (stats.totalUsed/1024).toFixed(2) + 'MB'} out of your ${(plan.storageCap/1048576).toFixed(2)}GB storage limit`
            })
        }

        if (stats.monthlyUploads >= plan.uploadCap && plan.plan_type !== 'Tier 2') {
            throw createError({
                status: 403,
                statusMessage: `Monthly upload limit reached. Uploads this month: ${stats.monthlyUploads}, Limit: ${plan.uploadCap}`
            })
        }
    }
} 