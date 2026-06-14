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

        // Clean up zombie session ids and tokens in the map
        await redisClient.zRemRangeByScore(`user_sessions:${session.id}`, 0, Date.now())
        await redisClient.zRemRangeByScore(`user_remember:${session.id}`, 0, Date.now())

        req.user = session;

        // Extend the session and the score in user->sessions map
        await redisClient.expire(`session:${sessionId}`, SESSION_TTL_SECONDS);
        await redisClient.zAdd(`user_sessions:${session.id}`, {
          score: Date.now() + SESSION_TTL_MS,
          value: sessionId
        })

        res.cookie('SESSIONID', sessionId, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS })

        return next();
      }

    }

    // Check if remember token is still valid
    if (rememberTokenId) {
      const rememberRaw = await redisClient.get(`token:remember:${rememberTokenId}`);

      if (rememberRaw) {
        const rememberData = JSON.parse(rememberRaw);

        // Clean up zombie session ids and tokens in the map
        await redisClient.zRemRangeByScore(`user_sessions:${rememberData.id}`, 0, Date.now())
        await redisClient.zRemRangeByScore(`user_remember:${rememberData.id}`, 0, Date.now())

        // Generate new token
        await redisClient.del(`token:remember:${rememberTokenId}`);
        const newRememberToken = await generateActivationToken()

        await redisClient.set(
          `token:remember:${newRememberToken}`,
          JSON.stringify({ id: rememberData.id }),
          { EX: REMEMBER_TTL_SECONDS } // 7 days
        );

        // Delete the old remember token if from the user->remember tokens map and update with the new remember token id
        await redisClient.zRem(`user_remember:${rememberData.id}`, rememberTokenId) 
        await redisClient.zAdd(`user_remember:${rememberData.id}`, {
          score: Date.now() + REMEMBER_TTL_MS,
          value: newRememberToken
        })

        // Create new session
        const newSessionId = await generateActivationToken()
        await redisClient.zAdd(`user_sessions:${rememberData.id}`, {
          score: Date.now() + SESSION_TTL_MS,
          value: newSessionId
        })

        await redisClient.set(
          `session:${newSessionId}`,
          JSON.stringify({
            id: rememberData.id,
            userAgent: req.headers["user-agent"],
            ip: req.ip,
            createdAt: Date.now()
          }),

          { EX: SESSION_TTL_SECONDS }
        );

        res.cookie('SESSIONID', newSessionId, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS })

        res.cookie('REMEMBER', newRememberToken, { ...COOKIE_OPTIONS, maxAge: REMEMBER_TTL_MS })

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

