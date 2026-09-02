import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import webhookRoutes from './routes/webhook.routes.js';
import * as errorHandlerNs from './middlewares/errorHandler.js';
const app = express()

app.set('trust proxy', 1)

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(helmet())
app.use(cookieParser())

// Mounted before express.json() — Stripe's signature check needs the raw,
// unparsed body. webhookRoutes.js applies its own express.raw() internally.
app.use('/api/v2/webhooks', webhookRoutes)

app.use(express.json())
app.use('/api/v2', routes)

app.use(errorHandlerNs.notFoundHandler)
app.use(errorHandlerNs.errorHandler)

export { app };