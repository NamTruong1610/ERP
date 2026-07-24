const { redisClient } = require('../config/RedisConfig')
const { generateActivationToken } = require('../utils/tokenUtils')
const { SESSION_TTL_SECONDS, SESSION_TTL_MS, REMEMBER_TTL_SECONDS, REMEMBER_TTL_MS, COOKIE_OPTIONS } = require('../config/constants')
const { prisma } = require('../config/PrismaConfig')

exports.invalidateAllUserSessions = async (userId) => {
  // Read both registries in parallel
  const [rememberTokens, sessionIds] = await Promise.all([
    redisClient.zRange(`user_remember:${userId}`, 0, -1),
    redisClient.zRange(`user_sessions:${userId}`, 0, -1)
  ])

  // Delete remember tokens first — prevents rotation race condition
  await Promise.all([
    ...rememberTokens.map(tokenId => redisClient.del(`token:remember:${tokenId}`)),
    redisClient.del(`user_remember:${userId}`)
  ])

  // Then delete sessions
  await Promise.all([
    ...sessionIds.map(sessionId => redisClient.del(`session:${sessionId}`)),
    redisClient.del(`user_sessions:${userId}`)
  ])
}

exports.createUserSession = async (userId, userAgent, ip, rememberMe) => {
  const sessionId = await generateActivationToken()

  let rememberTokenId = null
  if (rememberMe) {
    rememberTokenId = await generateActivationToken()
  }

  await Promise.all([
    // Session now stores rememberTokenId (null if no remember me)
    redisClient.set(
      `session:${sessionId}`,
      JSON.stringify({ id: userId, userAgent, ip, createdAt: Date.now(), rememberTokenId }),
      { EX: SESSION_TTL_SECONDS }
    ),
    redisClient.zAdd(`user_sessions:${userId}`, {
      score: Date.now() + SESSION_TTL_MS,
      value: sessionId
    }),

    // Remember token now stores sessionId
    ...(rememberTokenId ? [
      redisClient.set(
        `token:remember:${rememberTokenId}`,
        JSON.stringify({ id: userId, createdAt: Date.now(), sessionId }),
        { EX: REMEMBER_TTL_SECONDS }
      ),
      redisClient.zAdd(`user_remember:${userId}`, {
        score: Date.now() + REMEMBER_TTL_MS,
        value: rememberTokenId
      })
    ] : [])
  ])

  return { sessionId, rememberTokenId }
}

exports.invalidateLocalUserSession = async (sessionId, rememberTokenId) => {
  if (sessionId) {
    const sessionRaw = await redisClient.get(`session:${sessionId}`);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);

      await Promise.all([
        // Delete session from Redis
        redisClient.del(`session:${sessionId}`),
        // Remove session id from user->sessions map. 'session.id' refers to the user's id field in session, not the session's own id
        redisClient.zRem(`user_sessions:${session.id}`, sessionId)
      ])
    }
  }

  if (rememberTokenId) {
    const rememberRaw = await redisClient.get(`token:remember:${rememberTokenId}`);
    if (rememberRaw) {
      const rememberData = JSON.parse(rememberRaw);

      await Promise.all([
        // Delete remember token from Redis
        redisClient.del(`token:remember:${rememberTokenId}`),
        // Remove remember token from user -> remember tokens map
        redisClient.zRem(`user_remember:${rememberData.id}`, rememberTokenId)
      ])
    }
  }
}

// Get all active sessions across all users — super admin session viewer
exports.getAllActiveSessions = async () => {
  const sessionKeys = await redisClient.keys('session:*')
  if (sessionKeys.length === 0) return []

  const rawSessions = await Promise.all(
    sessionKeys.map(async (key) => {
      const [raw, ttl] = await Promise.all([
        redisClient.get(key),
        redisClient.ttl(key)
      ])
      if (!raw) return null
      const data = JSON.parse(raw)
      return {
        sessionId: key.replace('session:', ''),
        userId: data.id,
        userAgent: data.userAgent,
        ip: data.ip,
        createdAt: data.createdAt,
        expiresInSeconds: ttl
      }
    })
  )

  const sessions = rawSessions.filter(Boolean)
  if (sessions.length === 0) return []

  // Batch-fetch user details for all sessions in one query
  const userIds = [...new Set(sessions.map(s => s.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true }
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  return sessions.map(s => ({
    ...s,
    user: userMap.get(s.userId) ?? null
  }))
}

// Revoke one specific session — super admin revoking a single session
exports.revokeSessionById = async (sessionId) => {
  const raw = await redisClient.get(`session:${sessionId}`)
  if (!raw) return false

  const { id: userId, rememberTokenId } = JSON.parse(raw)

  await Promise.all([
    redisClient.del(`session:${sessionId}`),
    redisClient.zRem(`user_sessions:${userId}`, sessionId),

    ...(rememberTokenId ? [
      redisClient.del(`token:remember:${rememberTokenId}`),
      redisClient.zRem(`user_remember:${userId}`, rememberTokenId)
    ] : [])
  ])

  return true
}

// Revoke every active session system-wide — emergency lockdown
exports.revokeAllSessions = async () => {
  const [sessionKeys, rememberKeys, userSessionMaps, userRememberMaps] = await Promise.all([
    redisClient.keys('session:*'),
    redisClient.keys('token:remember:*'),
    redisClient.keys('user_sessions:*'),
    redisClient.keys('user_remember:*')
  ])

  const allKeys = [
    ...sessionKeys,
    ...rememberKeys,
    ...userSessionMaps,
    ...userRememberMaps
  ]

  if (allKeys.length > 0) {
    await redisClient.del(allKeys)
  }

  return {
    sessionsRevoked: sessionKeys.length,
    rememberTokensRevoked: rememberKeys.length
  }
}