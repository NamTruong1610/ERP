const {
  generateActivationToken,
} = require("../utils/activationTokenUtils")

const { redisClient } = require("../config/RedisConfig")
const {
  SESSION_TTL_MS,
  SESSION_TTL_SECONDS,
  REMEMBER_TTL_SECONDS,
  REMEMBER_TTL_MS,
  COOKIE_OPTIONS
} = require("../config/constants")

exports.requireAuth = async (req, res, next) => {
  try {
    const sessionId = req.cookies.SESSIONID;
    const rememberTokenId = req.cookies.REMEMBER;

    // Check is session is still valid
    if (sessionId) {
      const sessionRaw = await redisClient.get(`session:${sessionId}`);

      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        req.user = session;

        await Promise.all([
          // Clean up zombie session ids and tokens in the map
          redisClient.zRemRangeByScore(`user_sessions:${session.id}`, 0, Date.now()),
          redisClient.zRemRangeByScore(`user_remember:${session.id}`, 0, Date.now()),

          // Extend the session and the score in user->sessions map
          redisClient.expire(`session:${sessionId}`, SESSION_TTL_SECONDS),
          redisClient.zAdd(`user_sessions:${session.id}`, {
            score: Date.now() + SESSION_TTL_MS,
            value: sessionId
          })
        ])

        res.cookie('SESSIONID', sessionId, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS })

        return next();
      }

    }

    // Check if remember token is still valid
    if (rememberTokenId) {
      const rememberRaw = await redisClient.get(`token:remember:${rememberTokenId}`);

      if (rememberRaw) {
        const rememberData = JSON.parse(rememberRaw);

        await Promise.all([

        ])

        const [[newRememberTokenId, newSessionId]] = await Promise.all([
          // Generate new token
          Promise.all([generateActivationToken(), generateActivationToken()]),
          
          // Clean up zombie session ids and tokens in the map
          Promise.all([
            redisClient.zRemRangeByScore(`user_sessions:${rememberData.id}`, 0, Date.now()),
            redisClient.zRemRangeByScore(`user_remember:${rememberData.id}`, 0, Date.now()),
          ])
        ])

        await Promise.all([
          // New remember token stores the new sessionId
          redisClient.set(
            `token:remember:${newRememberTokenId}`,
            JSON.stringify({ id: rememberData.id, createdAt: Date.now(), sessionId: newSessionId }),
            { EX: REMEMBER_TTL_SECONDS }
          ),
          redisClient.zRem(`user_remember:${rememberData.id}`, rememberTokenId),
          redisClient.zAdd(`user_remember:${rememberData.id}`, {
            score: Date.now() + REMEMBER_TTL_MS,
            value: newRememberTokenId
          }),

          // New session stores the new rememberTokenId
          redisClient.set(
            `session:${newSessionId}`,
            JSON.stringify({
              id: rememberData.id,
              userAgent: req.headers['user-agent'],
              ip: req.ip,
              createdAt: Date.now(),
              rememberTokenId: newRememberTokenId
            }),
            { EX: SESSION_TTL_SECONDS }
          ),
          redisClient.zAdd(`user_sessions:${rememberData.id}`, {
            score: Date.now() + SESSION_TTL_MS,
            value: newSessionId
          }),

          // Delete old remember token and old session (if it exists)
          redisClient.del(`token:remember:${rememberTokenId}`),
        ])

        res.cookie('SESSIONID', newSessionId, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS })

        res.cookie('REMEMBER', newRememberTokenId, { ...COOKIE_OPTIONS, maxAge: REMEMBER_TTL_MS })

        req.user = {
          id: rememberData.id,
          userAgent: req.headers["user-agent"],
          ip: req.ip,
          createdAt: Date.now()
        };

        return next();
      }
    }

    return res.status(401).json({
      message: "Unauthenticated"
    });

  } catch (error) {
    next(error);
  }
};

