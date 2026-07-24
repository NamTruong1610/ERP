const {
  findUserByActivationToken,
  findUserByEmail,
  findUserById,
  updateUser,
  deleteUserExpiresAtById,
  deleteUserById
} = require("../repositories/userRepository")

const {
  findUserActivationByTokenId,
  deleteUserActivation
} = require("../repositories/activationRepository")

const {
  findMfaByUserId,
  updateMfa,
  upsertUserMfa,
  createUserMfa
} = require("../repositories/mfaRepository")

const {
  createAuditLog
} = require("../repositories/auditRepository")

const { AppError } = require('../lib/AppError');

const {
  hashPassword,
  comparePasswordHash
} = require("../utils/passwordUtils")

const {
  generateActivationToken,
  hashToken,
  compareTokenHash
} = require("../utils/tokenUtils")
const { redisClient } = require("../config/RedisConfig")

const {
  generateMfaSecret,
  verifyMfaOtp,
} = require("../utils/mfaUtils")

const { UserStatus, ActorType, AuditAction, TriggerType, TargetType } = require('@prisma/client')
const { MFA_SETUP_TTL_SECONDS } = require('../config/constants')
const { prisma } = require("../config/PrismaConfig")

const QRCode = require('qrcode')

// Missing audit logging?
exports.setPasswordService = async ({ activationToken, password, confirmPassword }, actor) => {
  const hashedActivationToken = await hashToken(activationToken)
  const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);

  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new AppError("Token expired", 404)
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

    return {
      activationToken: activationToken,
      mfaToken: rawMfaToken,
      passwordRequired: false
    }
  }

  if (userRecord.status === UserStatus.ACTIVE) {
    throw new AppError("Token expired", 404)
  }

  // Validate passwords before doing any work
  if (!password || !confirmPassword) {
    throw new AppError('Password is required', 400)
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400)
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

  return {
    activationToken: activationToken,
    mfaToken: rawMfaToken,
    passwordRequired: true
  }

}

exports.get2faSecretService = async ({ activationToken, mfaToken }, actorId) => {
  const hashedActivationToken = await hashToken(activationToken);
  const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);

  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new AppError("Token expired", 404)
  }

  const userRecord = await findUserById(userActivationToken.userId)

  const mfaTokenKey = `mfa:${userRecord.id}`

  const hashedMfaToken = await redisClient.get(mfaTokenKey)
  const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)

  if (!hashedMfaToken || !tokensMatched) {
    throw new AppError("Invalid token", 401)
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

    return {
      qrUri: qrDataUrl,
      activationToken
    }
  }

  // Pick up from the interrupted step, return the qr uri that the user set up when interrupted
  const qrDataUrl = await QRCode.toDataURL(userRecord.userMfa?.mfaUri)
  return {
    qrUri: qrDataUrl,
    activationToken
  }

}

exports.verify2faSecretSetupService = async ({ otp, activationToken, mfaToken }, actor) => {

  const hashedActivationToken = await hashToken(activationToken);
  const userActivationToken = await findUserActivationByTokenId(hashedActivationToken);
  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new AppError('Token expired', 404)
  }
  const userRecord = await findUserById(userActivationToken.userId)
  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new AppError('Token expired', 404)
  }

  const mfaTokenKey = `mfa:${userRecord.id}`
  const hashedMfaToken = await redisClient.get(mfaTokenKey)
  const tokensMatched = await compareTokenHash(mfaToken, hashedMfaToken)
  if (!hashedMfaToken || !tokensMatched) {
    throw new AppError("Invalid token", 401)
  }

  const verified = await verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)

  if (!verified) {
    throw new AppError("Invalid otp", 401)
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
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  // Delete mfa setup token and user record ttl from Redis 
  await redisClient.del(mfaTokenKey)

}

