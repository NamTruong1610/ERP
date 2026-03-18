const {
  findUserByActivationToken,
  findUserByEmail,
  findUserById,
  updateUser,
  deleteUserExpiresAtById
} = require("../services/userService")

const {
  hashPassword,
  comparePasswordHash
} = require("../utils/passwordUtils")

const {
  generateActivationToken,
  hashToken,
  compareTokenHash
} = require("../utils/activationTokenUtils")
const { redisClient } = require("../config/RedisConfig")

const {
  generateMfaSecret,
  verifyMfaOtp,
} = require("../utils/mfaUtils")

exports.setPasswordController = async (req, res, next) => {
  const { activationToken, password, confirmPassword } = req.body
  try {
    const hashedActivationToken = await hashToken(activationToken)
    const userRecord = await findUserByActivationToken(hashedActivationToken);
    let rawMfaToken = null

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match"
      })
    }

    else if (!userRecord || Date.now() > userRecord.expiresAt) {
      console.log(userRecord)
      return res.status(404).json({
        message: "Token expired"
      })
    }

    // 2fa setup is interrupted. The system deletes the old token from the previously interrupted step from Redis and
    // generates a new 2fa setup token and updated it in user record
    if (userRecord.status === "PENDING_MFA_SETUP" || userRecord.status === "PENDING_MFA_VERIFICATION") {
      // Generate a new token for 2fa verification step (hand-shake) in Redis 
      rawMfaToken = await generateActivationToken();
      const hashedMfaToken = await hashToken(rawMfaToken);
      const mfaTokenKey = `mfa:${userRecord._id}`;

      await redisClient.del(mfaTokenKey)
      await redisClient.set(mfaTokenKey, hashedMfaToken, {
        EX: 10 * 60 // 10 mins
      });

      return res.status(200).json({
        activationToken: activationToken,
        mfaToken: rawMfaToken
      })
    }

    else if (userRecord.status === "ACTIVE") {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    // Generate a new token for 2fa verification step (hand-shake)
    rawMfaToken = await generateActivationToken();
    const hashedMfaToken = await hashToken(rawMfaToken);

    const hashedPassword = await hashPassword(password)

    const mfaTokenKey = `mfa:${userRecord._id}`;
    await redisClient.set(mfaTokenKey, hashedMfaToken, {
      EX: 10 * 60 // 10 mins
    });

    await updateUser(userRecord, {
      password: hashedPassword,
      status: "PENDING_MFA_SETUP"
    })

    return res.status(200).json({
      activationToken: activationToken,
      mfaToken: rawMfaToken
    })


  } catch (error) {
    next(error)
  }
}

exports.get2faSecretController = async (req, res, next) => {
  const { activationToken, mfaToken } = req.body
  try {
    const hashedActivationToken = await hashToken(activationToken);
    const userRecord = await findUserByActivationToken(hashedActivationToken)

    if (!userRecord || Date.now() > userRecord.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }
    const mfaTokenKey = `mfa:${userRecord._id}`
    const hashedMfaToken = await redisClient.get(mfaTokenKey)
    const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)
    if (!hashedMfaToken || !tokensMatched) {
      return res.status(404).json({
        message: "Invalid token"
      })
    }

    if (!userRecord.mfaSecret) {
      // Generate 2fa secret and store it in the user record (change the user status to PENDING_MFA_VERIFICATION)
      const mfaSecret = await generateMfaSecret(userRecord.email)

      await updateUser(userRecord, {
        mfaSecret: mfaSecret.base32,
        mfaUri: mfaSecret.otpauth_url,
        status: "PENDING_MFA_VERIFICATION"
      })

      return res.status(200).json({
        qrUri: mfaSecret.otpauth_url,
        activationToken: activationToken
      })
    }

    return res.status(200).json({
      qrUri: userRecord.mfaUri,
      activationToken: activationToken
    })

  } catch (error) {
    next(error)
  }
}

exports.verify2faSecretSetupController = async (req, res, next) => {
  const { otp, activationToken, mfaToken } = req.body
  try {
    const hashedActivationToken = await hashToken(activationToken);
    const userRecord = await findUserByActivationToken(hashedActivationToken)
    if (!userRecord || Date.now() > userRecord.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    const mfaTokenKey = `mfa:${userRecord._id}`
    const hashedMfaToken = await redisClient.get(mfaTokenKey)
    const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)
    if (!hashedMfaToken || !tokensMatched) {
      return res.status(404).json({
        message: "Invalid token"
      })
    }

    const verified = await verifyMfaOtp(otp, userRecord.mfaSecret)

    if (!verified) {
      return res.status(401).json({
        message: "Invalid otp"
      })
    }

    await updateUser(userRecord, {
      status: "ACTIVE",
      mfaEnabled: true,
    })

    // Delete mfa setup token and user record ttl from Redis and MongoDb
    await redisClient.del(mfaTokenKey)
    await deleteUserExpiresAtById(userRecord._id)

    return res.status(200).json({
      message: "User 2fa successfully activated"
    })

  } catch (error) {
    next(error)
  }
}

