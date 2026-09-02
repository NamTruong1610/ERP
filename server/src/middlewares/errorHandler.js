import * as appError from '../lib/AppError.js';
import { Prisma } from '@prisma/client';
// Prisma error code → HTTP status + client-safe message
const PRISMA_ERRORS = {
  P2002: [409, 'A record with that value already exists'],
  P2003: [409, 'Operation violates a relation constraint'],
  P2025: [404, 'Record not found'],
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` })
}

// All four parameters are required — Express identifies error middleware
// by arity, and dropping `next` silently turns this into normal middleware
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  // Thrown deliberately by a service — already has a client-safe message
  if (err instanceof appError.AppError) {
    return res.status(err.statusCode || 500).json({ message: err.message })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const [status, message] = PRISMA_ERRORS[err.code] ?? [400, 'Database request failed']
    console.error(`Prisma ${err.code}`, err.meta)
    return res.status(status).json({ message })
  }

  console.error(err)
  return res.status(500).json({ message: 'Internal server error' })
}