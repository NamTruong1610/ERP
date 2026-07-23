const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const routes = require('./routes')
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler')

const app = express()

// Trust exactly one reverse proxy hop so req.ip is the real client IP
// rather than the proxy's IP — required for rate limiting and audit
// logging to work correctly in production
app.set('trust proxy', 1)

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(helmet())
app.use(cookieParser())
app.use(express.json())

app.use('/api/v2', routes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = { app }