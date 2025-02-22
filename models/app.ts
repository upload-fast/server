import mongoose, { Schema, Document, Types } from 'mongoose'
import { planSchema } from './plan.js'
import { StorageService } from '../services/storage-service.js'

interface StorageMetrics {
	totalUsed: number
	filesCount: number
	monthlyUploads: number
	lastCalculated: Date
}

export interface IApp extends Document {
	id: Types.ObjectId
	name: string
	description: string
	userId: Types.ObjectId
	plan: {
		plan_type: string
		storageCap: number
		uploadCap: number
		storageUsed: number
		name?: string
		description?: string
		active: boolean
	}
	storageMetrics: StorageMetrics
	createdAt: Date
	updatedAt: Date

	// Methods
	updateStorage(sizeChange: number): Promise<void>
	recalculateStorage(): Promise<void>
	validateStorageLimit(fileSize: number): Promise<void>
	switchAppPlan(planType: string): Promise<void>
}

const AppSchema: Schema = new Schema<IApp>(
	{
		name: { type: String, required: true },
		description: String,
		userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
		plan: planSchema,
		storageMetrics: {
			totalUsed: { type: Number, default: 0 },
			filesCount: { type: Number, default: 0 },
			monthlyUploads: { type: Number, default: 0 },
			lastCalculated: { type: Date, default: Date.now }
		}
	},
	{
		timestamps: true,
	}
)

// Method to update storage
AppSchema.methods.updateStorage = async function (sizeChange: number) {
	this.storageMetrics.totalUsed += sizeChange
	if (this.storageMetrics.totalUsed < 0) this.storageMetrics.totalUsed = 0

	if (sizeChange > 0) {
		this.storageMetrics.filesCount += 1
		this.storageMetrics.monthlyUploads += 1
	} else {
		this.storageMetrics.filesCount = Math.max(0, this.storageMetrics.filesCount - 1)
	}

	this.storageMetrics.lastCalculated = new Date()
	await this.save()
}

// Method to recalculate storage (useful for periodic checks)
AppSchema.methods.recalculateStorage = async function () {
	const stats = await StorageService.calculateStorageStats(this._id)
	this.storageMetrics = stats
	await this.save()
}

// Method to validate storage limits before upload
AppSchema.methods.validateStorageLimit = async function (fileSize: number) {
	// Recalculate if last calculation was more than an hour ago
	if (Date.now() - this.storageMetrics.lastCalculated.getTime() > 3600000) {
		await this.recalculateStorage()
	}

	await StorageService.validateStorageLimit(this._id, fileSize, this.plan)
}

AppSchema.methods.switchAppPlan = async function (planType: string) {
	this.plan.plan_type = planType;
	this.plan.active = true;

	const GB_IN_KB = 2 ** 20;
	switch (planType) {
		case 'Trial':
			this.plan.storageCap = 5 * GB_IN_KB;
			this.plan.uploadCap = 500;
			break;
		case 'Tier 1':
			this.plan.storageCap = 15 * GB_IN_KB;
			this.plan.uploadCap = 5000;
			break;
		case 'Tier 2':
			this.plan.storageCap = 120 * GB_IN_KB;
			this.plan.uploadCap = 10 ** 3;
			break;
		default:
			this.plan.storageCap = GB_IN_KB;
			this.plan.uploadCap = 500;
	}
	await this.save();
}

// Add a pre-save hook to ensure storage metrics are valid
AppSchema.pre('save', function (next) {
	const metrics = this.get('storageMetrics') as {
		totalUsed: number;
		filesCount: number;
		monthlyUploads: number;
	}
	if (metrics.totalUsed < 0) metrics.totalUsed = 0
	if (metrics.filesCount < 0) metrics.filesCount = 0
	if (metrics.monthlyUploads < 0) metrics.monthlyUploads = 0
	this.set('storageMetrics', metrics)
	next()
})



const AppModel = () => mongoose.model<IApp>('apps', AppSchema)
export const App = (mongoose.models['apps'] || AppModel()) as ReturnType<typeof AppModel>
