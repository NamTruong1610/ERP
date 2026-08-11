// server/src/middlewares/rateLimitMiddleware.js
const rateLimit = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const { redisClient } = require('../config/RedisConfig')

// Route files import these functions at module-load time (before Redis is
// connected), but the actual limiter + RedisStore can only be built once
// redisClient is connected (RedisStore issues a SCRIPT LOAD on construction).
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

exports.initRateLimiters = () => {
  for (const [key, { windowMs, max, message, prefix }] of Object.entries(definitions)) {
    limiters[key] = rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
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

exports.loginLimiter = delegate('login')
exports.mfaVerifyLimiter = delegate('mfaVerify')
exports.forgotPasswordLimiter = delegate('forgotPassword')
exports.resetPasswordLimiter = delegate('resetPassword')