import { createApp, createRouter, defineEventHandler, fromNodeMiddleware } from 'h3'
import { UFLRouter } from './routes'

export const app = createApp()

app.use(UFLRouter)
