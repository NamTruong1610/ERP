import * as redisConfig from '../config/redis.config.js';
import * as tokenUtils from '../utils/token.utils.js';
import * as constants from '../config/constants.js';
import * as prismaConfig from '../config/prisma.config.js';
export const invalidateAllUserSessions = async (userId) => {
  // Read both registries in parallel
  const [rememberTokens, sessionIds] = await Promise.all([
    redisConfig.redisClient.zRange(`user_remember:${userId}`, 0, -1),
    redisConfig.redisClient.zRange(`user_sessions:${userId}`, 0, -1)
  ])

  // Delete remember tokens first — prevents rotation race condition
  await Promise.all([
    ...rememberTokens.map(tokenId => redisConfig.redisClient.del(`token:remember:${tokenId}`)),
    redisConfig.redisClient.del(`user_remember:${userId}`)
  ])

  // Then delete sessions
  await Promise.all([
    ...sessionIds.map(sessionId => redisConfig.redisClient.del(`session:${sessionId}`)),
    redisConfig.redisClient.del(`user_sessions:${userId}`)
  ])
}

export const createUserSession = async (userId, userAgent, ip, rememberMe) => {
  const sessionId = await tokenUtils.generateActivationToken()

  let rememberTokenId = null
  if (rememberMe) {
    rememberTokenId = await tokenUtils.generateActivationToken()
  }

  await Promise.all([
    // Session now stores rememberTokenId (null if no remember me)
    redisConfig.redisClient.set(
      `session:${sessionId}`,
      JSON.stringify({ id: userId, userAgent, ip, createdAt: Date.now(), rememberTokenId }),
      { EX: constants.SESSION_TTL_SECONDS }
    ),
    redisConfig.redisClient.zAdd(`user_sessions:${userId}`, {
      score: Date.now() + constants.SESSION_TTL_MS,
      value: sessionId
    }),

    // Remember token now stores sessionId
    ...(rememberTokenId ? [
      redisConfig.redisClient.set(
        `token:remember:${rememberTokenId}`,
        JSON.stringify({ id: userId, createdAt: Date.now(), sessionId }),
        { EX: constants.REMEMBER_TTL_SECONDS }
      ),
      redisConfig.redisClient.zAdd(`user_remember:${userId}`, {
        score: Date.now() + constants.REMEMBER_TTL_MS,
        value: rememberTokenId
      })
    ] : [])
  ])

  return { sessionId, rememberTokenId }
}

export const invalidateLocalUserSession = async (sessionId, rememberTokenId) => {
  if (sessionId) {
    const sessionRaw = await redisConfig.redisClient.get(`session:${sessionId}`);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);

      await Promise.all([
        // Delete session from Redis
        redisConfig.redisClient.del(`session:${sessionId}`),
        // Remove session id from user->sessions map. 'session.id' refers to the user's id field in session, not the session's own id
        redisConfig.redisClient.zRem(`user_sessions:${session.id}`, sessionId)
      ])
    }
  }

  if (rememberTokenId) {
    const rememberRaw = await redisConfig.redisClient.get(`token:remember:${rememberTokenId}`);
    if (rememberRaw) {
      const rememberData = JSON.parse(rememberRaw);

      await Promise.all([
        // Delete remember token from Redis
        redisConfig.redisClient.del(`token:remember:${rememberTokenId}`),
        // Remove remember token from user -> remember tokens map
        redisConfig.redisClient.zRem(`user_remember:${rememberData.id}`, rememberTokenId)
      ])
    }
  }
}

// Get all active sessions across all users — super admin session viewer
export const getAllActiveSessions = async () => {
  const sessionKeys = await redisConfig.redisClient.keys('session:*')
  if (sessionKeys.length === 0) return []

  const rawSessions = await Promise.all(
    sessionKeys.map(async (key) => {
      const [raw, ttl] = await Promise.all([
        redisConfig.redisClient.get(key),
        redisConfig.redisClient.ttl(key)
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
  const users = await prismaConfig.prisma.user.findMany({
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
export const revokeSessionById = async (sessionId) => {
  const raw = await redisConfig.redisClient.get(`session:${sessionId}`)
  if (!raw) return false

  const { id: userId, rememberTokenId } = JSON.parse(raw)

  await Promise.all([
    redisConfig.redisClient.del(`session:${sessionId}`),
    redisConfig.redisClient.zRem(`user_sessions:${userId}`, sessionId),

    ...(rememberTokenId ? [
      redisConfig.redisClient.del(`token:remember:${rememberTokenId}`),
      redisConfig.redisClient.zRem(`user_remember:${userId}`, rememberTokenId)
    ] : [])
  ])

  return true
}

// Revoke every active session system-wide — emergency lockdown
export const revokeAllSessions = async () => {
  const [sessionKeys, rememberKeys, userSessionMaps, userRememberMaps] = await Promise.all([
    redisConfig.redisClient.keys('session:*'),
    redisConfig.redisClient.keys('token:remember:*'),
    redisConfig.redisClient.keys('user_sessions:*'),
    redisConfig.redisClient.keys('user_remember:*')
  ])

  const allKeys = [
    ...sessionKeys,
    ...rememberKeys,
    ...userSessionMaps,
    ...userRememberMaps
  ]

  if (allKeys.length > 0) {
    await redisConfig.redisClient.del(allKeys)
  }

  return {
    sessionsRevoked: sessionKeys.length,
    rememberTokensRevoked: rememberKeys.length
  }
}