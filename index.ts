import { createApp, createRouter, defineEventHandler, fromNodeMiddleware } from 'h3'
import { UFLRouter } from './routes'
import { connectToDb } from './utils/db'
import { S3, send } from './utils/s3'

export const app = createApp()

app.use(UFLRouter)

send()
connectToDb()
