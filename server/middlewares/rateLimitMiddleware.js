const rateLimit = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const { redisClient } = require('../config/RedisConfig')

const makeLimiter = ({ windowMs, max, message, prefix }) => rateLimit({
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