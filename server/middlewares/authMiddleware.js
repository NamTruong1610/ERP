const {
  generateActivationToken,
  hashToken,
  compareTokenHash
} = require("../utils/activationTokenUtils")

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

        await redisClient.expire(`session:${sessionId}`, 30 * 60);

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

        // Generate new token
        await redisClient.del(`token:remember:${rememberTokenId}`);
        const newRememberToken = await generateActivationToken()

        await redisClient.set(
          `token:remember:${newRememberToken}`,
          JSON.stringify({ _id: rememberData._id }),
          { EX: 7 * 24 * 60 * 60 } // 7 days
        );

        // Create new session
        const newSessionId = await generateActivationToken()

        // Delete the old login session id from the user -> sessions map and update with the new session id
        await redisClient.sRem(`user_sessions:${rememberData._id}`, sessionId);
        await redisClient.sAdd(`user_sessions:${rememberData._id}`, newSessionId);

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

