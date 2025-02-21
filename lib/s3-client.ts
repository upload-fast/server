import { S3Client } from '@aws-sdk/client-s3'

const { ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY } = process.env

export interface S3Config {
	region: string
	endpoint: string
	credentials: {
		accessKeyId: string
		secretAccessKey: string
	}
}

export abstract class BaseS3Client {
	protected client: S3Client

	constructor(config: S3Config) {
		this.client = new S3Client({
			region: config.region,
			endpoint: config.endpoint,
			credentials: {
				accessKeyId: config.credentials.accessKeyId,
				secretAccessKey: config.credentials.secretAccessKey
			}
		})
	}

	getClient(): S3Client {
		return this.client
	}
}

export class CloudflareR2Client extends BaseS3Client {
	constructor() {
		super({
			region: 'auto',
			endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: ACCESS_KEY_ID!,
				secretAccessKey: SECRET_ACCESS_KEY!
			}
		})
	}
}

export const R2 = new CloudflareR2Client().getClient()
