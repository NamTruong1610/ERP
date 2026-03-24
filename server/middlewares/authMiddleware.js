const {
  generateActivationToken,
} = require("../utils/activationTokenUtils")

const { redisClient } = require("../config/RedisConfig")

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
        await redisClient.zRemRangeByScore(`user_sessions:${session._id}`, 0, Date.now())
        await redisClient.zRemRangeByScore(`user_remember:${session._id}`, 0, Date.now())

        req.user = session;

        // Extend the session and the score in user->sessions map
        await redisClient.expire(`session:${sessionId}`, 30 * 60);
        await redisClient.zAdd(`user_sessions:${session._id}`, {
          score: Date.now() + 30 * 60 * 1000,
          value: sessionId
        })

        res.cookie("SESSIONID", sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: 30 * 60 * 1000 // 30 mins
        });

        return next();
      }

    }

    // Check if remember token is still valid
    if (rememberTokenId) {
      const rememberRaw = await redisClient.get(`token:remember:${rememberTokenId}`);

      if (rememberRaw) {
        const rememberData = JSON.parse(rememberRaw);

        // Clean up zombie session ids and tokens in the map
        await redisClient.zRemRangeByScore(`user_sessions:${rememberData._id}`, 0, Date.now())
        await redisClient.zRemRangeByScore(`user_remember:${rememberData._id}`, 0, Date.now())

        // Generate new token
        await redisClient.del(`token:remember:${rememberTokenId}`);
        const newRememberToken = await generateActivationToken()

        await redisClient.set(
          `token:remember:${newRememberToken}`,
          JSON.stringify({ _id: rememberData._id }),
          { EX: 7 * 24 * 60 * 60 } // 7 days
        );

        // Delete the old remember token if from the user->remember tokens map and update with the new remember token id
        await redisClient.zRem(`user_remember:${rememberData._id}`, rememberTokenId) 
        await redisClient.zAdd(`user_remember:${rememberData._id}`, {
          score: Date.now() + 7 * 24 * 60 * 60 * 1000,
          value: newRememberToken
        })

        // Create new session
        const newSessionId = await generateActivationToken()
        await redisClient.zAdd(`user_sessions:${rememberData._id}`, {
          score: Date.now() + 30 * 60 * 1000,
          value: newSessionId
        })

        await redisClient.set(
          `session:${newSessionId}`,
          JSON.stringify({
            _id: rememberData._id,
            userAgent: req.headers["user-agent"],
            ip: req.ip,
            createdAt: Date.now()
          }),

          { EX: 30 * 60 }
        );

        res.cookie("SESSIONID", newSessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: 30 * 60 * 1000
        });

        res.cookie("REMEMBER", newRememberToken, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        req.user = { _id: rememberData._id };

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

