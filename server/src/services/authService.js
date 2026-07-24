const {
  findUserByEmail,
  findUserById,
  updateUser
} = require("../repositories/userRepository.js")

const {
  createUserSession,
  invalidateLocalUserSession,
  invalidateAllUserSessions
} = require("../repositories/sessionRepository.js")

const {
  findMfaByUserId,
  updateMfa,
  createUserMfa
} = require("../repositories/mfaRepository.js")

const {
  createAuditLog
} = require("../repositories/auditRepository.js")

const { AppError } = require('../lib/AppError');

const {
  hashPassword,
  comparePasswordHash
} = require("../utils/passwordUtils.js")

const {
  generateActivationToken,
  hashToken
} = require("../utils/tokenUtils.js")

const {
  verifyMfaOtp,
} = require("../utils/mfaUtils.js")

const { enqueueEmail, EMAIL_JOBS } = require("../queues/emailQueue")

const { prisma } = require("../config/PrismaConfig.js")
const { UserStatus, ActorType, AuditAction, TriggerType, TargetType } = require('@prisma/client')
const { redisClient } = require("../config/RedisConfig.js")
const { SESSION_TTL_MS, REMEMBER_TTL_MS, COOKIE_OPTIONS, RECOVERY_TTL_SECONDS, RECOVERY_MAP_TTL_SECONDS, RECOVERY_EMAIL_IDEMPOTENCY_MS, MFA_LOGIN_TTL_SECONDS, MFA_LOGIN_MAP_TTL_SECONDS } = require("../config/constants.js")

exports.getMeService = async (actorId) => {

  const userRecord = await findUserById(actorId)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError('Unauthenticated', 401)
  }
  return {
    id: userRecord.id,
    roles: userRecord.roles,
    email: userRecord.email,
    name: userRecord.name
  }

}

exports.loginService = async ({ email, password, rememberMe, sessionId }, actor) => {

  if (sessionId) {
    const existingSession = await redisClient.get(`session:${sessionId}`)
    // Frontend redirects user to the main page since they're logged in
    if (existingSession) {
      throw new AppError("User already logged in", 409)
    }
  }

  const userRecord = await findUserByEmail(email)
  if (!userRecord || userRecord.status != UserStatus.ACTIVE) {
    await createAuditLog({
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
    throw new AppError("Invalid credentials", 401)
  }

  const passwordsMatched = await comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    await createAuditLog({
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
    throw new AppError("Invalid credentials", 401)
  }

  if (!userRecord.userMfa?.enabled) {
    // Create a session and save its id into a cookie
    const { sessionId, rememberTokenId } = await createUserSession(userRecord.id, actor.userAgent, actor.ip, rememberMe)

    // audit
    await createAuditLog({
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
    const existing2faLoginToken = await redisClient.get(`user_mfa_login:${userRecord.id}`)
    if (existing2faLoginToken) {
      await redisClient.del(`user_mfa_login:${userRecord.id}`)
    }
    const mfaLoginTokenId = await generateActivationToken();

    await Promise.all([
      // Set mfa login token
      redisClient.set(
        `token:mfa_login:${mfaLoginTokenId}`,
        JSON.stringify({
          id: userRecord.id,
          rememberMe: rememberMe
        }),
        { EX: MFA_LOGIN_TTL_SECONDS } // 5 mins
      ),

      // Set user->mfa login token map
      redisClient.set(
        `user_mfa_login:${userRecord.id}`,
        JSON.stringify({
          mfaLoginTokenId: mfaLoginTokenId
        }),
        { EX: MFA_LOGIN_MAP_TTL_SECONDS } // 6 mins
      )
    ])

    await createAuditLog({
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

exports.verify2faLoginService = async ({ otp, mfaLoginTokenId }, actor) => {

  if (!otp || !mfaLoginTokenId) {
    throw new AppError("Invalid credendials", 401)
  }

  const mfaLoginTokenRaw = await redisClient.get(`token:mfa_login:${mfaLoginTokenId}`);

  if (!mfaLoginTokenRaw) {
    throw new AppError("Invalid token", 401)
  }

  const mfaLoginToken = JSON.parse(mfaLoginTokenRaw)
  const userIdFromMfaLoginToken = mfaLoginToken.id

  // Retrieve the token id from the user->mfa login token map to compare with the one from the request body
  const mfaTokenMappedByUserIdRaw = await redisClient.get(`user_mfa_login:${userIdFromMfaLoginToken}`)

  if (!mfaTokenMappedByUserIdRaw) {
    throw new AppError("Invalid token", 401)

  }

  const mfaTokenMappedByUserId = JSON.parse(mfaTokenMappedByUserIdRaw)
  const mfaTokenIdMappedByUserId = mfaTokenMappedByUserId.mfaLoginTokenId

  if (mfaTokenIdMappedByUserId !== mfaLoginTokenId) {
    await createAuditLog({
      actorId: userIdFromMfaLoginToken,
      targetId: userIdFromMfaLoginToken,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_MFA_FAILED,
      metadata: { reason: 'Token mismatch' },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION
    })
    throw new AppError("Invalid token", 401)

  }

  const userRecord = await findUserById(mfaLoginToken.id);

  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    await createAuditLog({
      actorId: userIdFromMfaLoginToken,
      targetId: userIdFromMfaLoginToken,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_FAILED,
      metadata: { reason: 'User not active' },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION
    })
    throw new AppError("Invalid token", 401)

  }

  const validOtp = await verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)

  if (!validOtp) {
    await createAuditLog({
      actorId: userRecord.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.LOGIN_MFA_FAILED,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION
    })
    throw new AppError("Invalid credentials", 401)

  }

  const rememberMe = mfaLoginToken.rememberMe

  // Create login session
  // Create a session and save its id into a cookie
  const { sessionId, rememberTokenId } = await createUserSession(userRecord.id, actor.userAgent, actor.ip, rememberMe)

  // Delete 2fa login token and user->2fa login token map
  await Promise.all([
    redisClient.del(`user_mfa_login:${userRecord.id}`),
    redisClient.del(`token:mfa_login:${mfaLoginTokenId}`)
  ])

  await createAuditLog({
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

exports.logoutService = async ({ sessionId, rememberTokenId }, actor) => {
  // Delete sessions and tokens: login session, login session in the user->sessions map; remember token, remember token in the user->tokens map

  await invalidateLocalUserSession(sessionId, rememberTokenId)

  await createAuditLog({
    actorId: actor.id,
    targetId: actor.id,
    targetType: actor.id ? TargetType.USER : null,
    action: AuditAction.LOGOUT,
    ip: actor.ip,
    userAgent: actor.userAgent
  })
};

exports.logoutAllService = async (actor) => {

  await invalidateAllUserSessions(actor.id)

  await createAuditLog({
    actorId: actor.id,
    targetId: actor.id,
    targetType: TargetType.USER,
    action: AuditAction.LOGOUT_ALL,
    ip: actor.ip,
    userAgent: actor.userAgent
  })
};

exports.forgotPasswordService = async (email, actor) => {

  const userRecord = await findUserByEmail(email)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    await createAuditLog({
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
  const existingRecoverTokenRaw = await redisClient.get(`user_recover:${userRecord.id}`);

  if (existingRecoverTokenRaw) {
    const { recoveryTokenId } = JSON.parse(existingRecoverTokenRaw)
    const tokenRaw = await redisClient.get(`token:recover:${recoveryTokenId}`)

    if (tokenRaw) {
      const { createdAt } = JSON.parse(tokenRaw)
      const tokenAge = Date.now() - createdAt

      if (tokenAge < RECOVERY_EMAIL_IDEMPOTENCY_MS) {
        const remainingMs = RECOVERY_EMAIL_IDEMPOTENCY_MS - tokenAge
        const remainingMins = Math.ceil(remainingMs / 1000 / 60)
        throw new AppError(`Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before requesting another reset email`, 429)
      }
    }

    await Promise.all([
      redisClient.del(`token:recover:${recoveryTokenId}`),
      redisClient.del(`user_recover:${userRecord.id}`)
    ])
  }

  // Generate new recovery token
  const recoveryTokenId = await generateActivationToken();

  await Promise.all([
    redisClient.set(
      `token:recover:${recoveryTokenId}`,
      JSON.stringify({
        id: userRecord.id,
        createdAt: Date.now()
      }),
      { EX: RECOVERY_TTL_SECONDS } // 15 mins
    ),
    // Map recovery token to user
    redisClient.set(
      `user_recover:${userRecord.id}`,
      JSON.stringify({
        recoveryTokenId: recoveryTokenId
      }),
      { EX: RECOVERY_MAP_TTL_SECONDS } // 16 mins
    )
  ])

  await enqueueEmail(EMAIL_JOBS.RECOVERY, { email, tokenId: recoveryTokenId })

  await createAuditLog({
    actorId: userRecord.id,
    targetId: userRecord.id,
    targetType: TargetType.USER,
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    metadata: null,
    ip: actor.ip,
    userAgent: actor.userAgent
  })

}

exports.resetPasswordService = async ({ password, confirmPassword, recoveryToken }, actor) => {
  if (password !== confirmPassword) {
    throw new AppError("Passwords do not match", 400)
  }

  const recoveryTokenRaw = await redisClient.get(`token:recover:${recoveryToken}`)

  if (!recoveryTokenRaw) {
    throw new AppError("Invalid token", 401)
  }

  const recoveryTokenData = JSON.parse(recoveryTokenRaw)

  const recoveryTokenMappedByUserRaw = await redisClient.get(`user_recover:${recoveryTokenData.id}`)

  if (!recoveryTokenMappedByUserRaw) {
    await createAuditLog({
      actorId: recoveryTokenData.id,
      targetId: recoveryTokenData.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: { reason: 'Token map missing', success: false },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new AppError("Invalid token", 401)
  }

  const recoveryTokenMappedByUser = JSON.parse(recoveryTokenMappedByUserRaw)

  if (recoveryTokenMappedByUser.recoveryTokenId !== recoveryToken) {
    await createAuditLog({
      actorId: recoveryTokenData.id,
      targetId: recoveryTokenData.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: { reason: 'Token mismatch', success: false },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new AppError("Invalid token", 401)
  }

  const userRecord = await findUserById(recoveryTokenData.id)

  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    await createAuditLog({
      actorId: recoveryTokenData.id,
      targetId: recoveryTokenData.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_RESET,
      metadata: { reason: 'User not active', success: false },
      ip: actor.ip,
      userAgent: actor.userAgent
    })
    throw new AppError("User not found", 401)
  }

  const hashedPassword = await hashPassword(password)

  // Delete user->recovery tokens map, recovery token, user->sessions map, login sessions, user->remember map, rememberMe tokens
  // Delete user->sessions map and login sessions
  await invalidateAllUserSessions(userRecord.id)
  // Delete user->recovery tokens map and recovery token
  await redisClient.del(`user_recover:${userRecord.id}`)
  await redisClient.del(`token:recover:${recoveryToken}`)

  await prisma.$transaction(async (tx) => {
    await updateUser(userRecord, { password: hashedPassword }, tx)
    await createAuditLog({
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