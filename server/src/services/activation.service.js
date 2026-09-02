import * as userRepository from "../repositories/user.repository.js";
import * as activationRepository from "../repositories/activation.repository.js";
import * as mfaRepository from "../repositories/mfa.repository.js";
import * as auditRepository from "../repositories/audit.repository.js";
import * as appError from '../lib/AppError.js';

import * as passwordUtils from "../utils/password.utils.js";
import * as tokenUtils from "../utils/token.utils.js";
import * as redisConfig from "../config/redis.config.js";
import * as mfaUtils from "../utils/mfa.utils.js";
import * as constants from '../config/constants.js';
import * as prismaConfig from "../config/prisma.config.js";
import QRCode from 'qrcode';
import { TargetType, UserStatus, AuditAction } from '@prisma/client';
// Missing audit logging?
export const setPasswordService = async ({ activationToken, password, confirmPassword }) => {
  const hashedActivationToken = await tokenUtils.hashToken(activationToken)
  const userActivationToken = await activationRepository.findUserActivationByTokenId(hashedActivationToken);

  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new appError.AppError("Token expired", 404)
  }

  const userRecord = await userRepository.findUserById(userActivationToken.userId)

  let rawMfaToken = null

  if (userRecord.status === UserStatus.PENDING_MFA_SETUP || userRecord.status === UserStatus.PENDING_MFA_VERIFICATION) {
    // Generate a new token for 2fa verification step (hand-shake) in Redis 
    rawMfaToken = await tokenUtils.generateActivationToken();
    const hashedMfaToken = await tokenUtils.hashToken(rawMfaToken);
    const mfaTokenKey = `mfa:${userRecord.id}`;

    await redisConfig.redisClient.del(mfaTokenKey)
    await redisConfig.redisClient.set(mfaTokenKey, hashedMfaToken, {
      EX: constants.MFA_SETUP_TTL_SECONDS // 10 mins
    });

    return {
      activationToken: activationToken,
      mfaToken: rawMfaToken,
      passwordRequired: false
    }
  }

  if (userRecord.status === UserStatus.ACTIVE) {
    throw new appError.AppError("Token expired", 404)
  }

  // Validate passwords before doing any work
  if (!password || !confirmPassword) {
    throw new appError.AppError('Password is required', 400)
  }

  if (password !== confirmPassword) {
    throw new appError.AppError('Passwords do not match', 400)
  }

  // Generate a new token for 2fa verification step (hand-shake)
  rawMfaToken = await tokenUtils.generateActivationToken();
  const hashedMfaToken = await tokenUtils.hashToken(rawMfaToken);

  const hashedPassword = await passwordUtils.hashPassword(password)

  const mfaTokenKey = `mfa:${userRecord.id}`;
  await redisConfig.redisClient.set(mfaTokenKey, hashedMfaToken, {
    EX: constants.MFA_SETUP_TTL_SECONDS // 10 mins
  });

  await userRepository.updateUser(userRecord, {
    password: hashedPassword,
    status: UserStatus.PENDING_MFA_SETUP
  })

  return {
    activationToken: activationToken,
    mfaToken: rawMfaToken,
    passwordRequired: true
  }

}

export const get2faSecretService = async ({ activationToken, mfaToken }) => {
  const hashedActivationToken = await tokenUtils.hashToken(activationToken);
  const userActivationToken = await activationRepository.findUserActivationByTokenId(hashedActivationToken);

  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new appError.AppError("Token expired", 404)
  }

  const userRecord = await userRepository.findUserById(userActivationToken.userId)

  const mfaTokenKey = `mfa:${userRecord.id}`

  const hashedMfaToken = await redisConfig.redisClient.get(mfaTokenKey)
  const tokensMatched = await tokenUtils.compareTokenHash(mfaToken, hashedMfaToken)

  if (!hashedMfaToken || !tokensMatched) {
    throw new appError.AppError("Invalid token", 401)
  }

  // In case the user doesn't have mfa setup (user reaches this step for the first time)
  if (!userRecord.userMfa || !userRecord.userMfa?.mfaSecret) {
    // Generate 2fa secret and store it in the user record (change the user status to PENDING_MFA_VERIFICATION)
    const mfaSecret = await mfaUtils.generateMfaSecret(userRecord.email)

    await prismaConfig.prisma.$transaction(async (tx) => {
      await userRepository.updateUser(userRecord, { status: UserStatus.PENDING_MFA_VERIFICATION }, tx)
      await mfaRepository.upsertUserMfa(userRecord.id, {
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

export const verify2faSecretSetupService = async ({ otp, activationToken, mfaToken }, actor) => {

  const hashedActivationToken = await tokenUtils.hashToken(activationToken);
  const userActivationToken = await activationRepository.findUserActivationByTokenId(hashedActivationToken);
  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new appError.AppError('Token expired', 404)
  }
  const userRecord = await userRepository.findUserById(userActivationToken.userId)
  if (!userActivationToken || Date.now() > userActivationToken.expiresAt) {
    throw new appError.AppError('Token expired', 404)
  }

  const mfaTokenKey = `mfa:${userRecord.id}`
  const hashedMfaToken = await redisConfig.redisClient.get(mfaTokenKey)
  const tokensMatched = await tokenUtils.compareTokenHash(mfaToken, hashedMfaToken)
  
  if (!hashedMfaToken) {
    throw new appError.AppError('Token expired', 404)
  }
  if (!tokensMatched) {
    throw new appError.AppError("Invalid token", 401)
  }

  

  const verified = await mfaUtils.verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)

  if (!verified) {
    throw new appError.AppError("Invalid otp", 401)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await mfaRepository.updateMfa(userRecord.id, { enabled: true }, tx)
    await activationRepository.deleteUserActivation(userRecord.id, tx)
    await userRepository.updateUser(userRecord, { status: UserStatus.ACTIVE }, tx)
    await auditRepository.createAuditLog({
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
  await redisConfig.redisClient.del(mfaTokenKey)

}

