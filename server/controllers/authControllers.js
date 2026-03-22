const {
  findUserByEmail,
  findUserById,
  updateUser
} = require("../services/userService")

const {
  hashPassword,
  comparePasswordHash
} = require("../utils/passwordUtils")

const {
  generateActivationToken,
  hashToken
} = require("../utils/activationTokenUtils")
const { redisClient } = require("../config/RedisConfig")

const {
  verifyMfaOtp,
} = require("../utils/mfaUtils")

const {
  sendAccountRecoveryEmail
} = require("../utils/emailUtils")


exports.loginController = async (req, res, next) => {
  const { email, password, rememberMe } = req.body
  try {
    const sessionId = req.cookies.SESSIONID

    if (sessionId) {
      const existingSession = await redisClient.get(`session:${sessionId}`)
      // Frntend redirects user to the main page since they're logged in
      if (existingSession) {
        return res.status(401).json({
          message: "User already logged in"
        })
      }
    }

    const userRecord = await findUserByEmail(email)
    if (!userRecord || userRecord.status != "ACTIVE") {
      return res.status(404).json({
        message: "User not found"
      })
    }

    const passwordsMatched = await comparePasswordHash(password, userRecord.password)
    if (!passwordsMatched) {
      return res.status(401).json({
        message: "Invalid credentials"
      })
    }

    if (!userRecord.mfaEnabled) {
      // Create a session and save its id into a cookie
      const sessionId = await generateActivationToken()
      await redisClient.set(
        `session:${sessionId}`,
        JSON.stringify({
          _id: userRecord._id,
          userAgent: req.headers["user-agent"],
          ip: req.ip,
          createdAt: Date.now()
        }),
        { EX: 30 * 60 } // 30 mins
      )

      // Create a remember token if "Remember Me" is checked
      if (rememberMe) {
        const rememberMeTokenId = await generateActivationToken()
        await redisClient.set(
          `token:remember:${rememberMeTokenId}`,
          JSON.stringify({
            _id: userRecord._id,
            createdAt: Date.now()
          }),
          { EX: 7 * 24 * 60 * 60 } // 7 days
        )

        // Create a remember token in user->remember tokens map
        await redisClient.zAdd(`user_remember:${userRecord._id}`, {
          score: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          value: rememberMeTokenId
        })

        res.cookie("REMEMBER", rememberMeTokenId, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })
      }

      // Create a session in user->sessions map
      await redisClient.zAdd(`user_sessions:${userRecord._id}`, {
        score: Date.now() + 30 * 60 * 1000, // 30 mins
        value: sessionId
      })

      // Set local login cookie storing the session id
      res.cookie("SESSIONID", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 30 * 60 * 1000 // 30 mins
      })

      return res.status(200).json({
        message: "Login successful"
      })

    }

    // 2fa login flow 
    else {
      // Check if the user has previously verifed their password and generated the 2fa login token. If yes, delete it. 
      const existing2faLoginToken = await redisClient.get(`user_mfa_login:${userRecord._id}`)
      if (existing2faLoginToken) {
        await redisClient.del(`user_mfa_login:${userRecord._id}`)
      }
      const mfaLoginTokenId = await generateActivationToken();

      // Set mfa login token
      await redisClient.set(
        `token:mfa_login:${mfaLoginTokenId}`,
        JSON.stringify({
          _id: userRecord._id,
          rememberMe: rememberMe
        }),
        { EX: 5 * 60 } // 5 mins
      );

      // Set user->mfa login token map

      await redisClient.set(
        `user_mfa_login:${userRecord._id}`,
        JSON.stringify({
          mfaLoginTokenId: mfaLoginTokenId
        }),
        { EX: 6 * 60 } // 6 mins
      );

      return res.status(200).json({
        mfaLoginTokenId: mfaLoginTokenId
      })
    }
  } catch (error) {
    next(error)
  }
}

exports.verify2faLoginController = async (req, res, next) => {
  const { otp, mfaLoginTokenId } = req.body
  try {
    if (!otp || !mfaLoginTokenId) {
      return res.status(401).json({
        message: "Invalid credendials"
      })
    }

    const mfaLoginTokenRaw = await redisClient.get(`token:mfa_login:${mfaLoginTokenId}`);

    if (!mfaLoginTokenRaw) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const mfaLoginToken = JSON.parse(mfaLoginTokenRaw)
    const userIdFromMfaLoginToken = mfaLoginToken._id

    // Retrieve the token id from the user->mfa login token map to compare with the one from the request body
    const mfaTokenMappedByUserIdRaw = await redisClient.get(`user_mfa_login:${userIdFromMfaLoginToken}`)

    if (!mfaTokenMappedByUserIdRaw) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const mfaTokenMappedByUserId = JSON.parse(mfaTokenMappedByUserIdRaw)
    const mfaTokenIdMappedByUserId = mfaTokenMappedByUserId.mfaLoginTokenId

    if (mfaTokenIdMappedByUserId !== mfaLoginTokenId) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const userRecord = await findUserById(mfaLoginToken._id);

    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const validOtp = await verifyMfaOtp(otp, userRecord.mfaSecret)

    if (!validOtp) {
      return res.status(401).json({
        message: "Invalid credentials"
      })
    }

    const rememberMe = mfaLoginToken.rememberMe

    // Create login session
    // Create a session and save its id into a cookie
    const sessionId = await generateActivationToken()
    await redisClient.set(
      `session:${sessionId}`,
      JSON.stringify({
        _id: userRecord._id,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
        createdAt: Date.now()
      }),
      { EX: 30 * 60 } // 30 mins
    )

    // Create a remember token if "Remember Me" is checked
    if (rememberMe) {
      const rememberMeTokenId = await generateActivationToken()
      await redisClient.set(
        `token:remember:${rememberMeTokenId}`,
        JSON.stringify({
          _id: userRecord._id,
          createdAt: Date.now()
        }),
        { EX: 7 * 24 * 60 * 60 } // 7 days
      )

      // Create a remember token in user->remember tokens map
      await redisClient.zAdd(`user_remember:${userRecord._id}`, {
        score: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        value: rememberMeTokenId
      })
      res.cookie("REMEMBER", rememberMeTokenId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
    }

    // Create a session in user->sessions map
    await redisClient.zAdd(`user_sessions:${userRecord._id}`, {
      score: Date.now() + 30 * 60 * 1000, // 30 mins
      value: sessionId
    })

    // Delete 2fa login token and user->2fa login token map
    await redisClient.del(`user_mfa_login:${userRecord._id}`)
    await redisClient.del(`token:mfa_login:${mfaLoginTokenId}`)

    // Set local login cookie storing the session id
    res.cookie("SESSIONID", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 30 * 60 * 1000 // 30 mins
    })

    return res.status(200).json({
      message: "Login successful"
    })

  } catch (error) {
    next(error)
  }
}

exports.logoutController = async (req, res, next) => {
  try {
    // Delete sessions and tokens: login session, login session in the user->sessions map; remember token, remember token in the user->tokens map
    const sessionId = req.cookies.SESSIONID;
    const rememberTokenId = req.cookies.REMEMBER;

    if (sessionId) {
      const sessionRaw = await redisClient.get(`session:${sessionId}`);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);

        // Delete session from Redis
        await redisClient.del(`session:${sessionId}`);

        // Remove session id from user -> sessions map. 'session._id' refers to the user's id field in session, not the session's own id
        await redisClient.sRem(`user_sessions:${session._id}`, sessionId);
      }
    }

    if (rememberTokenId) {
      const rememberRaw = await redisClient.get(`token:remember:${rememberTokenId}`);
      if (rememberRaw) {
        const rememberData = JSON.parse(rememberRaw);

        // Delete remember token from Redis
        await redisClient.del(`token:remember:${rememberTokenId}`);

        // Remove remember token from user -> remember tokens map
        await redisClient.sRem(`user_remember:${rememberData._id}`, rememberTokenId);
      }
    }

    // Clear cookies in the browser
    res.clearCookie("SESSIONID", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    res.clearCookie("REMEMBER", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

exports.logoutAllController = async (req, res, next) => {
  try {
    const userId = req.user._id; // Assuming this is set by requireAuth middleware

    // Get all active session IDs for the user
    const sessionIds = await redisClient.sMembers(`user_sessions:${userId}`);
    if (sessionIds && sessionIds.length) {
      for (const sessionId of sessionIds) {
        await redisClient.del(`session:${sessionId}`); // Delete session from Redis
      }
      await redisClient.del(`user_sessions:${userId}`); // Clear the user->sessions map
    }

    // Get all remember tokens for the user
    const rememberTokens = await redisClient.sMembers(`user_remember:${userId}`);
    if (rememberTokens && rememberTokens.length) {
      for (const tokenId of rememberTokens) {
        await redisClient.del(`token:remember:${tokenId}`); // Delete each token
      }
      await redisClient.del(`user_remember:${userId}`); // Clear the user->remember tokens map
    }

    // Clear cookies for the current device (browser)
    res.clearCookie("SESSIONID", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/"
    });
    res.clearCookie("REMEMBER", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/"
    });

    return res.status(200).json({ message: "All sessions logged out successfully" });
  } catch (error) {
    next(error);
  }
};

exports.forgotPasswordController = async (req, res, next) => {
  const { email } = req.body
  try {
    const userRecord = await findUserByEmail(email)
    if (!userRecord || userRecord.status !== "ACTIVE") {
      return res.status(200).json({
        message: "Recovery email has been sent"
      })
    }

    // Check if a recovery token is previously generated. If yes, delete it and the user->revover map
    const existingRecoverTokenRaw = await redisClient.get(`user_recover:${userRecord._id}`);

    if (existingRecoverTokenRaw) {
      const { recoveryTokenId } = JSON.parse(existingRecoverTokenRaw);

      await redisClient.del(`token:recover:${recoveryTokenId}`);
      await redisClient.del(`user_recover:${userRecord._id}`);
    }


    // Generate new recovery token
    const recoveryTokenId = await generateActivationToken();
    await redisClient.set(
      `token:recover:${recoveryTokenId}`,
      JSON.stringify({
        _id: userRecord._id,
        createdAt: Date.now()
      }),
      { EX: 15 * 60 } // 15 mins
    )

    // Map recovery token to user
    await redisClient.set(
      `user_recover:${userRecord._id}`,
      JSON.stringify({
        recoveryTokenId: recoveryTokenId
      }),
      { EX: 16 * 60 } // 16 mins
    )

    await sendAccountRecoveryEmail(email, recoveryTokenId)

    return res.status(200).json({
      message: "Recovery token generated"
    })

  } catch (error) {
    next(error)
  }
}

exports.resetPasswordController = async (req, res, next) => {
  const { password, confirmPassword, recoveryToken } = req.body
  try {
    if (password !== confirmPassword) {
      return res.status(401).json({
        message: "Passwords do not match"
      })
    }

    const recoveryTokenRaw = await redisClient.get(`token:recover:${recoveryToken}`)

    if (!recoveryTokenRaw) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const recoveryTokenData = JSON.parse(recoveryTokenRaw)

    const recoveryTokenMappedByUserRaw = await redisClient.get(`user_recover:${recoveryTokenData._id}`)

    if (!recoveryTokenMappedByUserRaw) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const recoveryTokenMappedByUser = JSON.parse(recoveryTokenMappedByUserRaw)

    if (recoveryTokenMappedByUser.recoveryTokenId !== recoveryToken) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const userRecord = await findUserById(recoveryTokenData._id)

    console.log(recoveryTokenData._id)

    const hashedPassword = await hashPassword(password)

    await updateUser(userRecord, {
      password: hashedPassword
    })

    // Delete user->recovery tokens map, recovery token, user->sessions map, login sessions, user->remember map, rememberMe tokens
    // Delete user->sessions map and login sessions
    const sessionIds = await redisClient.sMembers(`user_sessions:${userRecord._id}`);
    if (sessionIds && sessionIds.length) {
      for (const sessionId of sessionIds) {
        await redisClient.del(`session:${sessionId}`); // Delete session from Redis
      }
      await redisClient.del(`user_sessions:${userRecord._id}`); // Clear the user->sessions map
    }

    // Delete user->remember map and rememberMe tokens
    const rememberTokens = await redisClient.sMembers(`user_remember:${userRecord._id}`);
    if (rememberTokens && rememberTokens.length) {
      for (const tokenId of rememberTokens) {
        await redisClient.del(`token:remember:${tokenId}`); // Delete each token
      }
      await redisClient.del(`user_remember:${userRecord._id}`); // Clear the user->remember tokens map
    }

    // Delete user->recovery tokens map and recovery token
    await redisClient.del(`user_recover:${userRecord._id}`)
    await redisClient.del(`token:recover:${recoveryToken}`)

    return res.status(200).json({
      message: "Password reset successfully"
    })

  } catch (error) {
    next(error)
  }
}