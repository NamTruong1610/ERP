import * as userRepository from "../repositories/user.repository.js";
import * as sessionRepository from "../repositories/session.repository.js";
import * as mfaRepository from "../repositories/mfa.repository.js";
import * as auditRepository from "../repositories/audit.repository.js";
import * as appError from '../lib/AppError.js';

import * as passwordUtils from "../utils/password.utils.js";
import * as tokenUtils from "../utils/token.utils.js";
import * as mfaUtils from "../utils/mfa.utils.js";
import * as emailQueue from "../queues/email.queue.js";
import * as prismaConfig from "../config/prisma.config.js";
import * as redisConfig from "../config/redis.config.js";
import * as constants from "../config/constants.js";
import { TargetType, UserStatus, AuditAction, TriggerType } from '@prisma/client';
export const getMeService = async (actorId) => {

  const userRecord = await userRepository.findUserById(actorId)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError('Unauthenticated', 401)
  }
  return {
    id: userRecord.id,
    roles: userRecord.roles,
    email: userRecord.email,
    name: userRecord.name
  }

}

export const loginService = async ({ email, password, rememberMe, sessionId }, actor) => {

  if (sessionId) {
    const existingSession = await redisConfig.redisClient.get(`session:${sessionId}`)
    // Frontend redirects user to the main page since they're logged in
    if (existingSession) {
      throw new appError.AppError("User already logged in", 409)
    }
  }

  const userRecord = await userRepository.findUserByEmail(email)
  if (!userRecord || userRecord.status != UserStatus.ACTIVE) {
    await auditRepository.createAuditLog({
      actorId: userRecord?.id ?? null,
      targetId: userRecord?.id ?? null,
      targetType: userRecord ? TargetType.USER : null,
      action: AuditAction.LOGIN_FAILED,
      metadata: {
        "attemptedEmail": email,
        "reason": "User not found"
      },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new appError.AppError("Invalid credentials", 401)
  }

  const passwordsMatched = await passwordUtils.comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    await auditRepository.createAuditLog({
      actorId: userRecord.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_FAILED,
      metadata: {
        "reason": "Invalid credentials"
      },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new appError.AppError("Invalid credentials", 401)
  }

  if (!userRecord.userMfa?.enabled) {
    // Create a session and save its id into a cookie
    const { sessionId, rememberTokenId } = await sessionRepository.createUserSession(userRecord.id, actor.userAgent, actor.ip, rememberMe)

    // audit
    await auditRepository.createAuditLog({
      actorId: userRecord.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_SUCCESS,
      metadata: {
        "rememberMe": rememberMe
      },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    return {
      mfaRequired: false,
      sessionId: sessionId,
      rememberTokenId: rememberTokenId ?? null,
    };
  }

  // 2fa login flow 
  else {
    // Check if the user has previously verifed their password and generated the 2fa login token. If yes, delete it. 
    const existing2faLoginToken = await redisConfig.redisClient.get(`user_mfa_login:${userRecord.id}`)
    if (existing2faLoginToken) {
      await redisConfig.redisClient.del(`user_mfa_login:${userRecord.id}`)
    }
    const mfaLoginTokenId = await tokenUtils.generateActivationToken();

    await Promise.all([
      // Set mfa login token
      redisConfig.redisClient.set(
        `token:mfa_login:${mfaLoginTokenId}`,
        JSON.stringify({
          id: userRecord.id,
          rememberMe: rememberMe
        }),
        { EX: constants.MFA_LOGIN_TTL_SECONDS } // 5 mins
      ),

      // Set user->mfa login token map
      redisConfig.redisClient.set(
        `user_mfa_login:${userRecord.id}`,
        JSON.stringify({
          mfaLoginTokenId: mfaLoginTokenId
        }),
        { EX: constants.MFA_LOGIN_MAP_TTL_SECONDS } // 6 mins
      )
    ])

    await auditRepository.createAuditLog({
      actorId: userRecord.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_MFA_PENDING,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    })

    return {
      mfaRequired: true,
      mfaLoginTokenId
    };
  }
}

export const verify2faLoginService = async ({ otp, mfaLoginTokenId }, actor) => {

  if (!otp || !mfaLoginTokenId) {
    throw new appError.AppError("Invalid credendials", 401)
  }

  const mfaLoginTokenRaw = await redisConfig.redisClient.get(`token:mfa_login:${mfaLoginTokenId}`);

  if (!mfaLoginTokenRaw) {
    throw new appError.AppError("Invalid token", 401)
  }

  const mfaLoginToken = JSON.parse(mfaLoginTokenRaw)
  const userIdFromMfaLoginToken = mfaLoginToken.id

  // Retrieve the token id from the user->mfa login token map to compare with the one from the request body
  const mfaTokenMappedByUserIdRaw = await redisConfig.redisClient.get(`user_mfa_login:${userIdFromMfaLoginToken}`)

  if (!mfaTokenMappedByUserIdRaw) {
    throw new appError.AppError("Invalid token", 401)

  }

  const mfaTokenMappedByUserId = JSON.parse(mfaTokenMappedByUserIdRaw)
  const mfaTokenIdMappedByUserId = mfaTokenMappedByUserId.mfaLoginTokenId

  if (mfaTokenIdMappedByUserId !== mfaLoginTokenId) {
    await auditRepository.createAuditLog({
      actorId: userIdFromMfaLoginToken,
      targetId: userIdFromMfaLoginToken,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_MFA_FAILED,
      metadata: { reason: 'Token mismatch' },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION
    })
    throw new appError.AppError("Invalid token", 401)

  }

  const userRecord = await userRepository.findUserById(mfaLoginToken.id);

  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    await auditRepository.createAuditLog({
      actorId: userIdFromMfaLoginToken,
      targetId: userIdFromMfaLoginToken,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_FAILED,
      metadata: { reason: 'User not active' },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION
    })
    throw new appError.AppError("Invalid token", 401)

  }

  const validOtp = await mfaUtils.verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)

  if (!validOtp) {
    await auditRepository.createAuditLog({
      actorId: userRecord.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_MFA_FAILED,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION
    })
    throw new appError.AppError("Invalid credentials", 401)

  }

  const rememberMe = mfaLoginToken.rememberMe

  // Create login session
  // Create a session and save its id into a cookie
  const { sessionId, rememberTokenId } = await sessionRepository.createUserSession(userRecord.id, actor.userAgent, actor.ip, rememberMe)

  // Delete 2fa login token and user->2fa login token map
  await Promise.all([
    redisConfig.redisClient.del(`user_mfa_login:${userRecord.id}`),
    redisConfig.redisClient.del(`token:mfa_login:${mfaLoginTokenId}`)
  ])

  await auditRepository.createAuditLog({
    actorId: userRecord.id,
    targetId: userRecord.id,
    targetType: TargetType.USER,
    action: AuditAction.LOGIN_SUCCESS,
    metadata: { rememberMe, mfa: true },
    ip: actor.ip,
    userAgent: actor.userAgent
  })

  return { sessionId, rememberTokenId }
}

export const logoutService = async ({ sessionId, rememberTokenId }, actor) => {
  // Delete sessions and tokens: login session, login session in the user->sessions map; remember token, remember token in the user->tokens map

  await sessionRepository.invalidateLocalUserSession(sessionId, rememberTokenId)

  await auditRepository.createAuditLog({
    actorId: actor.id,
    targetId: actor.id,
    targetType: actor.id ? TargetType.USER : null,
    action: AuditAction.LOGOUT,
    ip: actor.ip,
    userAgent: actor.userAgent
  })
};

export const logoutAllService = async (actor) => {

  await sessionRepository.invalidateAllUserSessions(actor.id)

  await auditRepository.createAuditLog({
    actorId: actor.id,
    targetId: actor.id,
    targetType: TargetType.USER,
    action: AuditAction.LOGOUT_ALL,
    ip: actor.ip,
    userAgent: actor.userAgent
  })
};

export const forgotPasswordService = async (email, actor) => {

  const userRecord = await userRepository.findUserByEmail(email)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    await auditRepository.createAuditLog({
      actorId: null,
      targetId: userRecord?.id ?? null,
      targetType: userRecord ? TargetType.USER : null,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      metadata: { attemptedEmail: email, reason: 'User not found or inactive' },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    return
  }

  // Check if a recovery token is previously generated. If yes, delete it and the user->revover map
  const existingRecoverTokenRaw = await redisConfig.redisClient.get(`user_recover:${userRecord.id}`);

  if (existingRecoverTokenRaw) {
    const { recoveryTokenId } = JSON.parse(existingRecoverTokenRaw)
    const tokenRaw = await redisConfig.redisClient.get(`token:recover:${recoveryTokenId}`)

    if (tokenRaw) {
      const { createdAt } = JSON.parse(tokenRaw)
      const tokenAge = Date.now() - createdAt

      if (tokenAge < constants.RECOVERY_EMAIL_IDEMPOTENCY_MS) {
        const remainingMs = constants.RECOVERY_EMAIL_IDEMPOTENCY_MS - tokenAge
        const remainingMins = Math.ceil(remainingMs / 1000 / 60)
        throw new appError.AppError(`Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before requesting another reset email`, 429)
      }
    }

    await Promise.all([
      redisConfig.redisClient.del(`token:recover:${recoveryTokenId}`),
      redisConfig.redisClient.del(`user_recover:${userRecord.id}`)
    ])
  }

  // Generate new recovery token
  const recoveryTokenId = await tokenUtils.generateActivationToken();

  await Promise.all([
    redisConfig.redisClient.set(
      `token:recover:${recoveryTokenId}`,
      JSON.stringify({
        id: userRecord.id,
        createdAt: Date.now()
      }),
      { EX: constants.RECOVERY_TTL_SECONDS } // 15 mins
    ),
    // Map recovery token to user
    redisConfig.redisClient.set(
      `user_recover:${userRecord.id}`,
      JSON.stringify({
        recoveryTokenId: recoveryTokenId
      }),
      { EX: constants.RECOVERY_MAP_TTL_SECONDS } // 16 mins
    )
  ])

  await emailQueue.enqueueEmail(emailQueue.EMAIL_JOBS.RECOVERY, { email, tokenId: recoveryTokenId })

  await auditRepository.createAuditLog({
    actorId: userRecord.id,
    targetId: userRecord.id,
    targetType: TargetType.USER,
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    metadata: null,
    ip: actor.ip,
    userAgent: actor.userAgent
  })

}

export const resetPasswordService = async ({ password, confirmPassword, recoveryToken }, actor) => {
  if (password !== confirmPassword) {
    throw new appError.AppError("Passwords do not match", 400)
  }

  const recoveryTokenRaw = await redisConfig.redisClient.get(`token:recover:${recoveryToken}`)

  if (!recoveryTokenRaw) {
    throw new appError.AppError("Invalid token", 401)
  }

  const recoveryTokenData = JSON.parse(recoveryTokenRaw)

  const recoveryTokenMappedByUserRaw = await redisConfig.redisClient.get(`user_recover:${recoveryTokenData.id}`)

  if (!recoveryTokenMappedByUserRaw) {
    await auditRepository.createAuditLog({
      actorId: recoveryTokenData.id,
      targetId: recoveryTokenData.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: { reason: 'Token map missing', success: false },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new appError.AppError("Invalid token", 401)
  }

  const recoveryTokenMappedByUser = JSON.parse(recoveryTokenMappedByUserRaw)

  if (recoveryTokenMappedByUser.recoveryTokenId !== recoveryToken) {
    await auditRepository.createAuditLog({
      actorId: recoveryTokenData.id,
      targetId: recoveryTokenData.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: { reason: 'Token mismatch', success: false },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new appError.AppError("Invalid token", 401)
  }

  const userRecord = await userRepository.findUserById(recoveryTokenData.id)

  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    await auditRepository.createAuditLog({
      actorId: recoveryTokenData.id,
      targetId: recoveryTokenData.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: { reason: 'User not active', success: false },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new appError.AppError("User not found", 401)
  }

  const hashedPassword = await passwordUtils.hashPassword(password)

  // Delete user->recovery tokens map, recovery token, user->sessions map, login sessions, user->remember map, rememberMe tokens
  // Delete user->sessions map and login sessions
  await sessionRepository.invalidateAllUserSessions(userRecord.id)
  // Delete user->recovery tokens map and recovery token
  await redisConfig.redisClient.del(`user_recover:${userRecord.id}`)
  await redisConfig.redisClient.del(`token:recover:${recoveryToken}`)

  await prismaConfig.prisma.$transaction(async (tx) => {
    await userRepository.updateUser(userRecord, { password: hashedPassword }, tx)
    await auditRepository.createAuditLog({
      actorId: userRecord.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

}

// Enable 2FA:
// - Verify password (confirm intent)
// - Go through 2FA setup (scan QR, verify OTP)
// - Current session continues uninterrupted

// Disable 2FA:
// - Verify password (confirm intent)
// - Verify current OTP (confirm they still have access to authenticator)
// - Invalidate all sessions and force re-login