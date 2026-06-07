const {
  findUserByActivationToken,
  findUserByEmail,
  findUserById,
  updateUser,
  deleteUserExpiresAtById,
  deleteUserById
} = require("../services/userService")

const {
  findUserActivationByTokenId,
  deleteUserActivation
} = require("../services/activationTokenService")

const {
  findMfaByUserId,
  updateMfa
} = require("../services/mfaService")

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

const { UserStatus } = require('@prisma/client')

const QRCode = require('qrcode')

// exports.setPasswordController = async (req, res, next) => {
//   const { activationToken, password, confirmPassword } = req.body
//   try {

//     // Validate passwords
//     if (password !== confirmPassword) {
//       return res.status(400).json({
//         message: "Passwords do not match"
//       })
//     }
//     const hashedActivationToken = await hashToken(activationToken)
//     const userRecord = await findUserByActivationToken(hashedActivationToken);
//     let rawMfaToken = null

//     if (!userRecord || Date.now() > userRecord.expiresAt) {
//       if (userRecord) await deleteUserById(userRecord.id)
//       return res.status(404).json({
//         message: "Token expired"
//       })
//     }

//     // 2fa setup is interrupted. The system deletes the old token from the previously interrupted step from Redis and
//     // generates a new 2fa setup token and updated it in user record
//     if (userRecord.status === UserStatus.PENDING_MFA_SETUP || userRecord.status === UserStatus.PENDING_MFA_VERIFICATION) {
//       // Generate a new token for 2fa verification step (hand-shake) in Redis 
//       rawMfaToken = await generateActivationToken();
//       const hashedMfaToken = await hashToken(rawMfaToken);
//       const mfaTokenKey = `mfa:${userRecord.id}`;

//       await redisClient.del(mfaTokenKey)
//       await redisClient.set(mfaTokenKey, hashedMfaToken, {
//         EX: 10 * 60 // 10 mins
//       });

//       return res.status(200).json({
//         activationToken: activationToken,
//         mfaToken: rawMfaToken
//       })
//     }

//     else if (userRecord.status === "ACTIVE") {
//       return res.status(404).json({
//         message: "Token expired"
//       })
//     }

//     // Generate a new token for 2fa verification step (hand-shake)
//     rawMfaToken = await generateActivationToken();
//     const hashedMfaToken = await hashToken(rawMfaToken);

//     const hashedPassword = await hashPassword(password)

//     const mfaTokenKey = `mfa:${userRecord.id}`;
//     await redisClient.set(mfaTokenKey, hashedMfaToken, {
//       EX: 10 * 60 // 10 mins
//     });

//     await updateUser(userRecord, {
//       password: hashedPassword,
//       status: UserStatus.PENDING_MFA_SETUP
//     })

//     return res.status(200).json({
//       activationToken: activationToken,
//       mfaToken: rawMfaToken
//     })


//   } catch (error) {
//     next(error) 
//   }
// }

exports.setPasswordController = async (req, res, next) => {
  const { activationToken, password, confirmPassword } = req.body
  try {

    // Validate passwords
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match"
      })
    }
    const hashedActivationToken = await hashToken(activationToken)
    const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);
    
    if (!activationToken || Date.now > userActivationToken.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    const userRecord = findUserById(userActivationToken.userId)
    
    if (userRecord.status === UserStatus.PENDING_MFA_SETUP || userRecord.status === UserStatus.PENDING_MFA_VERIFICATION) {
      // Generate a new token for 2fa verification step (hand-shake) in Redis 
      rawMfaToken = await generateActivationToken();
      const hashedMfaToken = await hashToken(rawMfaToken);
      const mfaTokenKey = `mfa:${userRecord.id}`;

      await redisClient.del(mfaTokenKey)
      await redisClient.set(mfaTokenKey, hashedMfaToken, {
        EX: 10 * 60 // 10 mins
      });

      return res.status(200).json({
        activationToken: userActivationToken.tokenId,
        mfaToken: rawMfaToken
      })
    }

    else if (userRecord.status === UserStatus.ACTIVE) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    // Generate a new token for 2fa verification step (hand-shake)
    rawMfaToken = await generateActivationToken();
    const hashedMfaToken = await hashToken(rawMfaToken);

    const hashedPassword = await hashPassword(password)

    const mfaTokenKey = `mfa:${userRecord.id}`;
    await redisClient.set(mfaTokenKey, hashedMfaToken, {
      EX: 10 * 60 // 10 mins
    });

    await updateUser(userRecord, {
      password: hashedPassword,
      status: UserStatus.PENDING_MFA_SETUP
    })

    return res.status(200).json({
      activationToken: userActivationToken.tokenId,
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
    const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);
    const userRecord = findUserById(userActivationToken.userId)

    if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    const mfaTokenKey = `mfa:${userRecord.id}`
    const hashedMfaToken = await redisClient.get(mfaTokenKey)
    const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)
    if (!hashedMfaToken || !tokensMatched) {
      return res.status(404).json({
        message: "Invalid token"
      })
    }

    const userMfa = await findMfaByUserId(userRecord.id);

    // In case the user doesn't have mfa setup (user reaches this step for the first time)
    if (!userMfa || !userMfa.mfaSecret) {
      // Generate 2fa secret and store it in the user record (change the user status to PENDING_MFA_VERIFICATION)
      const mfaSecret = await generateMfaSecret(userRecord.email)

      await updateUser(userRecord, {
        status: UserStatus.PENDING_MFA_VERIFICATION
      })

      await updateMfa(userRecord.id, {
        mfaSecret: mfaSecret.base32,
        mfaUri: mfaSecret.otpauth_url,
      })

      const qrDataUrl = await QRCode.toDataURL(mfaSecret.otpauth_url)

      return res.status(200).json({
        qrUri: qrDataUrl,
        activationToken: userActivationToken.tokenId
      })
    }

    // Pick up from the interrupted step, return the qr uri that the user set up when interrupted
    const qrDataUrl = await QRCode.toDataURL(userRecord.mfaUri)
    return res.status(200).json({
      qrUri: qrDataUrl,
      activationToken: userActivationToken.tokenId
    })

  } catch (error) {
    next(error)
  }
}

exports.verify2faSecretSetupController = async (req, res, next) => {
  const { otp, activationToken, mfaToken } = req.body
  try {
    const hashedActivationToken = await hashToken(activationToken);
    const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);
    const userRecord = await findUserById(userActivationToken.userId)
    if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    const mfaTokenKey = `mfa:${userRecord.id}`
    const hashedMfaToken = await redisClient.get(mfaTokenKey)
    const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)
    if (!hashedMfaToken || !tokensMatched) {
      return res.status(404).json({
        message: "Invalid token"
      })
    }

    const userMfa = await findMfaByUserId(userRecord.id);

    const verified = await verifyMfaOtp(otp, userMfa.mfaSecret)

    if (!verified) {
      return res.status(401).json({
        message: "Invalid otp"
      })
    }

    await updateUser(userRecord, {
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
    })

    await deleteUserActivation(userRecord.id)

    // Delete mfa setup token and user record ttl from Redis and MongoDb
    await redisClient.del(mfaTokenKey)

    return res.status(200).json({
      message: "User 2fa successfully activated"
    })

  } catch (error) {
    next(error)
  }
}

