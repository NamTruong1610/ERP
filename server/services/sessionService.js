const { redisClient } = require('../config/RedisConfig')
const { generateActivationToken } = require('../utils/activationTokenUtils')
const { SESSION_TTL_SECONDS, SESSION_TTL_MS, REMEMBER_TTL_SECONDS, REMEMBER_TTL_MS, COOKIE_OPTIONS } = require('../config/constants')

exports.invalidateAllUserSessions = async (userId) => {
  const sessionIds = await redisClient.zRange(`user_sessions:${userId}`, 0, -1)
  for (const sessionId of sessionIds) {
    await redisClient.del(`session:${sessionId}`)
  }
  await redisClient.del(`user_sessions:${userId}`)

  const rememberTokens = await redisClient.zRange(`user_remember:${userId}`, 0, -1)
  for (const tokenId of rememberTokens) {
    await redisClient.del(`token:remember:${tokenId}`)
  }
  await redisClient.del(`user_remember:${userId}`)
}

exports.createUserSession = async (userId, userAgent, ip, rememberMe) => {
  const sessionId = await generateActivationToken()
  await redisClient.set(
    `session:${sessionId}`,
    JSON.stringify({ id: userId, userAgent, ip, createdAt: Date.now() }),
    { EX: SESSION_TTL_SECONDS }
  )
  await redisClient.zAdd(`user_sessions:${userId}`, {
    score: Date.now() + SESSION_TTL_MS,
    value: sessionId
  })

  let rememberTokenId = null
  if (rememberMe) {
    rememberTokenId = await generateActivationToken()
    await redisClient.set(
      `token:remember:${rememberTokenId}`,
      JSON.stringify({ id: userId, createdAt: Date.now() }),
      { EX: REMEMBER_TTL_SECONDS }
    )
    await redisClient.zAdd(`user_remember:${userId}`, {
      score: Date.now() + REMEMBER_TTL_MS,
      value: rememberTokenId
    })
  }

  return { sessionId, rememberTokenId }
}