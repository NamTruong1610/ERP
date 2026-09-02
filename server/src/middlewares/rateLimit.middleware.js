// server/src/middlewares/rateLimitMiddleware.js
import rateLimit from 'express-rate-limit';
import * as redisConfig from '../config/redis.config.js';
import { RedisStore } from 'rate-limit-redis';
// Route files import these functions at module-load time (before Redis is
// connected), but the actual limiter + RedisStore can only be built once
// redisConfig.redisClient is connected (RedisStore issues a SCRIPT LOAD on construction).
// initRateLimiters() builds them exactly once, deterministically, during
// server bootstrap — not lazily inside a request handler, which is both a
// race under concurrent requests and trips express-rate-limit's own
// ERR_ERL_CREATED_IN_REQUEST_HANDLER safety check.

const definitions = {
  login: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    prefix: 'rl:login:'
  },
  mfaVerify: {
    windowMs: 5 * 60 * 1000,
    max: 8,
    message: 'Too many verification attempts. Please try again in 5 minutes.',
    prefix: 'rl:mfa:'
  },
  forgotPassword: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many requests. Please try again later.',
    prefix: 'rl:forgot:'
  },
  resetPassword: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many attempts. Please try again later.',
    prefix: 'rl:reset:'
  }
}

const limiters = {}

export const initRateLimiters = () => {
  for (const [key, { windowMs, max, message, prefix }] of Object.entries(definitions)) {
    limiters[key] = rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand: (...args) => redisConfig.redisClient.sendCommand(args),
        prefix
      }),
      handler: (req, res) => {
        res.status(429).json({ message })
      }
    })
  }
}

// Thin delegating middleware — safe to import before initRateLimiters() runs,
// since it only resolves the real limiter once an actual request arrives.
const delegate = (key) => (req, res, next) => {
  if (!limiters[key]) {
    return next(new Error(`Rate limiter "${key}" not initialized — call initRateLimiters() during server bootstrap`))
  }
  return limiters[key](req, res, next)
}

export const loginLimiter = delegate('login')
export const mfaVerifyLimiter = delegate('mfaVerify')
export const forgotPasswordLimiter = delegate('forgotPassword')
export const resetPasswordLimiter = delegate('resetPassword')