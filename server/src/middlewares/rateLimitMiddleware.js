const rateLimit = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const { redisClient } = require('../config/RedisConfig')

// Returns a middleware that builds its RedisStore on first request rather
// than at module load. RedisStore runs SCRIPT LOAD the moment it's
// constructed, so building it at import time requires a connected client —
// which forces every importer of this file to be required after redisConnect().
const makeLimiter = ({ windowMs, max, message, prefix }) => {
  let limiter

  return (req, res, next) => {
    if (!limiter) {
      limiter = rateLimit({
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
    return limiter(req, res, next)
  }
}

exports.loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  prefix: 'rl:login:'
})

exports.mfaVerifyLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 8,
  message: 'Too many verification attempts. Please try again in 5 minutes.',
  prefix: 'rl:mfa:'
})

exports.forgotPasswordLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many requests. Please try again later.',
  prefix: 'rl:forgot:'
})

exports.resetPasswordLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Please try again later.',
  prefix: 'rl:reset:'
})