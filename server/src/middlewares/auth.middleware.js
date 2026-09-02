import * as tokenUtils from "../utils/token.utils.js";
import * as redisConfig from "../config/redis.config.js";
import * as constants from "../config/constants.js";
export const requireAuth = async (req, res, next) => {
  try {
    const sessionId = req.cookies.SESSIONID;
    const rememberTokenId = req.cookies.REMEMBER;

    // Check is session is still valid
    if (sessionId) {
      const sessionRaw = await redisConfig.redisClient.get(`session:${sessionId}`);

      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        req.user = session;

        await Promise.all([
          // Clean up zombie session ids and tokens in the map
          redisConfig.redisClient.zRemRangeByScore(`user_sessions:${session.id}`, 0, Date.now()),
          redisConfig.redisClient.zRemRangeByScore(`user_remember:${session.id}`, 0, Date.now()),

          // Extend the session and the score in user->sessions map
          redisConfig.redisClient.expire(`session:${sessionId}`, constants.SESSION_TTL_SECONDS),
          redisConfig.redisClient.zAdd(`user_sessions:${session.id}`, {
            score: Date.now() + constants.SESSION_TTL_MS,
            value: sessionId
          })
        ])

        res.cookie('SESSIONID', sessionId, { ...constants.COOKIE_OPTIONS, maxAge: constants.SESSION_TTL_MS })

        return next();
      }

    }

    // Check if remember token is still valid
    if (rememberTokenId) {
      const rememberRaw = await redisConfig.redisClient.get(`token:remember:${rememberTokenId}`);

      if (rememberRaw) {
        const rememberData = JSON.parse(rememberRaw);

        await Promise.all([

        ])

        const [[newRememberTokenId, newSessionId]] = await Promise.all([
          // Generate new token
          Promise.all([tokenUtils.generateActivationToken(), tokenUtils.generateActivationToken()]),
          
          // Clean up zombie session ids and tokens in the map
          Promise.all([
            redisConfig.redisClient.zRemRangeByScore(`user_sessions:${rememberData.id}`, 0, Date.now()),
            redisConfig.redisClient.zRemRangeByScore(`user_remember:${rememberData.id}`, 0, Date.now()),
          ])
        ])

        await Promise.all([
          // New remember token stores the new sessionId
          redisConfig.redisClient.set(
            `token:remember:${newRememberTokenId}`,
            JSON.stringify({ id: rememberData.id, createdAt: Date.now(), sessionId: newSessionId }),
            { EX: constants.REMEMBER_TTL_SECONDS }
          ),
          redisConfig.redisClient.zRem(`user_remember:${rememberData.id}`, rememberTokenId),
          redisConfig.redisClient.zAdd(`user_remember:${rememberData.id}`, {
            score: Date.now() + constants.REMEMBER_TTL_MS,
            value: newRememberTokenId
          }),

          // New session stores the new rememberTokenId
          redisConfig.redisClient.set(
            `session:${newSessionId}`,
            JSON.stringify({
              id: rememberData.id,
              userAgent: req.headers['user-agent'],
              ip: req.ip,
              createdAt: Date.now(),
              rememberTokenId: newRememberTokenId
            }),
            { EX: constants.SESSION_TTL_SECONDS }
          ),
          redisConfig.redisClient.zAdd(`user_sessions:${rememberData.id}`, {
            score: Date.now() + constants.SESSION_TTL_MS,
            value: newSessionId
          }),

          // Delete old remember token and old session (if it exists)
          redisConfig.redisClient.del(`token:remember:${rememberTokenId}`),
        ])

        res.cookie('SESSIONID', newSessionId, { ...constants.COOKIE_OPTIONS, maxAge: constants.SESSION_TTL_MS })

        res.cookie('REMEMBER', newRememberTokenId, { ...constants.COOKIE_OPTIONS, maxAge: constants.REMEMBER_TTL_MS })

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
      message: "Unauthenticated check"
    });

  } catch (error) {
    next(error);
  }
};

