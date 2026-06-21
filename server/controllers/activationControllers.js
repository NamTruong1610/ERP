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
} = require("../services/activationService")

const {
  findMfaByUserId,
  updateMfa,
  upsertUserMfa,
  createUserMfa
} = require("../services/mfaService")

const {
  createAuditLog
} = require("../services/auditServices")

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

const { UserStatus, ActorType, AuditAction, TriggerType, TargetType } = require('@prisma/client')
const { MFA_SETUP_TTL_SECONDS } = require('../config/constants')
const { prisma } = require("../config/PrismaConfig")

const QRCode = require('qrcode')


exports.setPasswordController = async (req, res, next) => {
  const { activationToken, password, confirmPassword } = req.body
  try {

    const hashedActivationToken = await hashToken(activationToken)
    const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);
    
    if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    const userRecord = await findUserById(userActivationToken.userId)

    let rawMfaToken = null
    
    if (userRecord.status === UserStatus.PENDING_MFA_SETUP || userRecord.status === UserStatus.PENDING_MFA_VERIFICATION) {
      // Generate a new token for 2fa verification step (hand-shake) in Redis 
      rawMfaToken = await generateActivationToken();
      const hashedMfaToken = await hashToken(rawMfaToken);
      const mfaTokenKey = `mfa:${userRecord.id}`;

      await redisClient.del(mfaTokenKey)
      await redisClient.set(mfaTokenKey, hashedMfaToken, {
        EX: MFA_SETUP_TTL_SECONDS // 10 mins
      });

      return res.status(200).json({
        activationToken: activationToken,
        mfaToken: rawMfaToken,
        passwordRequired: false 
      })
    }

    if (userRecord.status === UserStatus.ACTIVE) {
      return res.status(404).json({ message: 'Token expired' })
    }

    // Validate passwords before doing any work
    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Password is required' })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' })
    }

    // Generate a new token for 2fa verification step (hand-shake)
    rawMfaToken = await generateActivationToken();
    const hashedMfaToken = await hashToken(rawMfaToken);

    const hashedPassword = await hashPassword(password)    

    const mfaTokenKey = `mfa:${userRecord.id}`;
    await redisClient.set(mfaTokenKey, hashedMfaToken, {
      EX: MFA_SETUP_TTL_SECONDS // 10 mins
    });

    await updateUser(userRecord, {
      password: hashedPassword,
      status: UserStatus.PENDING_MFA_SETUP
    })

    return res.status(200).json({
      activationToken: activationToken,
      mfaToken: rawMfaToken,
      passwordRequired: true
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

    if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
      return res.status(404).json({
        message: "Token expired"
      })
    }

    const userRecord = await findUserById(userActivationToken.userId)

    const mfaTokenKey = `mfa:${userRecord.id}`
    
    const hashedMfaToken = await redisClient.get(mfaTokenKey)
    const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)
    
    if (!hashedMfaToken || !tokensMatched) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    // In case the user doesn't have mfa setup (user reaches this step for the first time)
    if (!userRecord.userMfa || !userRecord.userMfa?.mfaSecret) {
      // Generate 2fa secret and store it in the user record (change the user status to PENDING_MFA_VERIFICATION)
      const mfaSecret = await generateMfaSecret(userRecord.email)

      await prisma.$transaction(async (tx) => {
        await updateUser(userRecord, { status: UserStatus.PENDING_MFA_VERIFICATION }, tx)
        await upsertUserMfa(userRecord.id, {
          mfaSecret: mfaSecret.base32,
          mfaUri: mfaSecret.otpauth_url,
        }, tx)
      })

      const qrDataUrl = await QRCode.toDataURL(mfaSecret.otpauth_url)

      return res.status(200).json({
        qrUri: qrDataUrl,
        activationToken: activationToken
      })
    }

    // Pick up from the interrupted step, return the qr uri that the user set up when interrupted
    const qrDataUrl = await QRCode.toDataURL(userRecord.userMfa?.mfaUri)
    return res.status(200).json({
      qrUri: qrDataUrl,
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
    const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);
    if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
      return res.status(404).json({ message: 'Token expired' })
    }
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
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    const verified = await verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)

    if (!verified) {
      return res.status(401).json({
        message: "Invalid otp"
      })
    }

    await prisma.$transaction(async (tx) => {
      await updateMfa(userRecord.id, { enabled: true }, tx)
      await deleteUserActivation(userRecord.id, tx)
      await updateUser(userRecord, { status: UserStatus.ACTIVE }, tx)
      await createAuditLog({
        actorId: userRecord.id,
        targetId: userRecord.id,
        targetType: TargetType.USER,
        action: AuditAction.USER_ACTIVATED,
        metadata: null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
    })

    // Delete mfa setup token and user record ttl from Redis 
    await redisClient.del(mfaTokenKey)

    return res.status(200).json({
      message: "User 2fa successfully activated"
    })

  } catch (error) {
    next(error)
  }
}

