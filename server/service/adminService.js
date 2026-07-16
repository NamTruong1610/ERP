const {
  findAllUsers,
  findUserByEmail,
  findUserById,
  findAllUsersByString,
  createUser,
  updateUser,
  softDeleteUserById,
  deleteUserById,
  createUserRole,
  deleteUserRole
} = require("../repository/userRepository")

const {
  invalidateAllUserSessions
} = require("../repository/sessionRepository")

const {
  createUserActivation,
  updateUserActivation
} = require("../repository/activationRepository")

const {
  findMfaByUserId,
  updateMfa,
  upsertUserMfa,
  deleteMfa
} = require("../repository/mfaRepository")

const {
  createAuditLog
} = require("../repository/auditRepository")

const { invalidateClinicStats } = require('../repository/statsRepository')

const { AppError } = require('../utils/errorsUtil.js');

const {
  generateActivationToken,
  hashToken
} = require("../utils/activationTokenUtils")

const {
  sendAccountActivationEmail
} = require("../utils/emailUtils")

const { ACTIVATION_TTL_MS, ACTIVATION_EMAIL_IDEMPOTENCY_MS } = require('../config/constants')

const { redisClient } = require("../config/RedisConfig")
const { ROLES } = require('../config/RBACConfig')
const { prisma } = require("../config/PrismaConfig")
const { UserStatus, AuditAction, TargetType } = require('@prisma/client')

exports.createUserService = async (email, actor) => {

  const userRecord = await findUserByEmail(email)

  if (userRecord) {
    throw new AppError('User account already exists', 409)
  }

  const rawActivationTokenId = await generateActivationToken()
  const hashedActivationTokenId = await hashToken(rawActivationTokenId)

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await createUser({ email }, tx)
    await createUserActivation(user.id, hashedActivationTokenId, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: user.id,
      targetType: TargetType.USER,
      action: AuditAction.USER_CREATED,
      metadata: { email },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return user
  })

  await invalidateClinicStats()

  await sendAccountActivationEmail(email, rawActivationTokenId)

  return {
    id: newUser.id,
    email: newUser.email,
    status: newUser.status
  }
}

exports.deleteUserService = async (id, actor) => {

  const userRecord = await findUserById(id);
  if (!userRecord || userRecord.deletedAt !== null) {
    throw new AppError('No user found', 404)
  }

  // Write-ahead: log before the destructive operation
  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.USER_DELETED,
      metadata: { email: userRecord.email },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await softDeleteUserById(userRecord.id, tx)
  })

  // Invalidate all sessions and remember tokens (standalone due to Redis being a different service from Prisma)
  await invalidateAllUserSessions(id)

}

exports.hardDeleteUserService = async (id, actor) => {
  const userRecord = await findUserById(id);
  if (!userRecord) {
    throw new AppError('No user found', 404)

  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_DELETED,
      metadata: { email: userRecord.email, hardDelete: true },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await deleteUserById(id, tx)
  })

  // Invalidate all sessions and remember tokens
  await invalidateAllUserSessions(id)
}

exports.getAllUsersService = async ({ search, take, skip }) => {

  const pagination = {
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip)
  }

  const result = search
    ? await findAllUsersByString(search, pagination)
    : await findAllUsers(pagination)

  return result

}

exports.getUserService = async (id) => {
  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  return {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    phones: userRecord.phones,
    addresses: userRecord.addresses,
    roles: userRecord.roles,
    status: userRecord.status,
    userMfa: userRecord.userMfa ? {
      enabled: userRecord.userMfa.enabled,
      mfaSecret: !!userRecord.userMfa.mfaSecret
    } : null,
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt
  }

}

exports.suspendUserService = async (id, actor) => {
  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  if (userRecord.status === UserStatus.SUSPENDED) {
    throw new AppError("User is already suspended", 400)
  }

  await prisma.$transaction(async (tx) => {
    await updateUser(userRecord, { status: UserStatus.SUSPENDED }, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_SUSPENDED,
      metadata: { previousStatus: userRecord.status },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  // Invalidate all sessions and remember tokens
  await invalidateAllUserSessions(id)

}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired (the user has already submitted their password and set up mfa, but hasn't verify otp for mfa)
exports.reset2faService = async (id, actor) => {

  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  if (!userRecord.userMfa?.mfaSecret) {
    throw new AppError("User has no 2FA setup to reset", 400)
  }

  if (userRecord.userActivation) {
    let tokenAge = Date.now() - userRecord.userActivation?.updatedAt.getTime()
    if (tokenAge < ACTIVATION_EMAIL_IDEMPOTENCY_MS) {
      const remainingMs = ACTIVATION_EMAIL_IDEMPOTENCY_MS - tokenAge
      const remainingMins = Math.ceil(remainingMs / 1000 / 60)
      throw new AppError(`Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before resending`, 429)
    }
  }

  const rawActivationTokenId = await generateActivationToken()
  const hashedActivationTokenId = await hashToken(rawActivationTokenId)

  await prisma.$transaction(async (tx) => {
    if (userRecord.userActivation) {
      await updateUserActivation(userRecord.id, {
        tokenId: hashedActivationTokenId,
        expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS)
      }, tx)
    } else {
      await createUserActivation(userRecord.id, hashedActivationTokenId, tx)
    }

    await updateMfa(userRecord.id, {
      mfaSecret: null,
      mfaUri: null,
      enabled: false,
    }, tx)

    await updateUser(userRecord, {
      status: UserStatus.PENDING_MFA_SETUP
    }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.MFA_RESET,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  // Invalidate all sessions so the user is forced to log in and set up 2FA again
  await invalidateAllUserSessions(id)
  await sendAccountActivationEmail(userRecord.email, rawActivationTokenId)
}

exports.resendActivationEmailService = async (id, actor) => {
  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  if (userRecord.status !== UserStatus.PENDING_ACTIVATION) {
    throw new AppError("User account is already activated", 400)
  }

  // Generate a new activation token and reset the TTL
  const rawActivationTokenId = await generateActivationToken()
  const hashedActivationTokenId = await hashToken(rawActivationTokenId)

  if (userRecord.userActivation) {
    let tokenAge = Date.now() - userRecord.userActivation?.updatedAt.getTime()
    if (tokenAge < ACTIVATION_EMAIL_IDEMPOTENCY_MS) {
      const remainingMs = ACTIVATION_EMAIL_IDEMPOTENCY_MS - tokenAge
      const remainingMins = Math.ceil(remainingMs / 1000 / 60)
      throw new AppError(`Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before resending`, 429)
    }
  }

  await prisma.$transaction(async (tx) => {
    if (userRecord.userActivation) {
      await updateUserActivation(userRecord.id, {
        tokenId: hashedActivationTokenId,
        expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS)
      }, tx)
    } else {
      await createUserActivation(userRecord.id, hashedActivationTokenId, tx)
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.ACTIVATION_RESENT,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  await sendAccountActivationEmail(userRecord.email, rawActivationTokenId)


}

exports.assignRoleService = async (id, role, actor) => {

  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  if (!ROLES[role]) {
    throw new AppError("Invalid role", 400)
  }

  if (userRecord.roles.some(ur => ur.role === role)) {
    throw new AppError("User already has this role", 400)
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const result = await createUserRole(userRecord.id, role, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.ROLE,
      action: AuditAction.ROLE_ASSIGNED,
      metadata: { role },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return result
  })

  return { roles: updatedUser.roles }


}

exports.removeRoleService = async (id, role, actor) => {

  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  if (!userRecord.roles.some(ur => ur.role === role)) {
    throw new AppError("User does not have this role", 400)
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const result = await deleteUserRole(userRecord.id, role, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.ROLE,
      action: AuditAction.ROLE_REMOVED,
      metadata: { role },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return result
  })

  return { roles: updatedUser.roles }

}

exports.forceLogoutUserService = async (id, actor) => {

  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  await createAuditLog({
    actorId: actor.id,
    targetId: id,
    targetType: TargetType.USER,
    action: AuditAction.FORCE_LOGOUT,
    metadata: null,
    ip: actor.ip,
    userAgent: actor.userAgent
  })

  await invalidateAllUserSessions(id)

}

// Review this service in business security context
exports.updateUserService = async (id, body, actor) => {

  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  const allowedFields = ["name", "email", "phones", "addresses"]
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No valid fields provided", 400)
  }

  if (updates.email) {
    const existingUser = await findUserByEmail(updates.email)
    if (existingUser && existingUser.id !== id) {
      throw new AppError("Email already in use", 400)
    }
  }

  const previousEmail = userRecord.email
  const updatedUser = await prisma.$transaction(async (tx) => {
    const result = await updateUser(userRecord, updates, tx)
    if (updates.email && updates.email !== previousEmail) {
      await createAuditLog({
        actorId: actor.id,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.EMAIL_CHANGED,
        metadata: { previousEmail, newEmail: updates.email },
        ip: actor.ip,
        userAgent: actor.userAgent
      }, tx)
    }
    return result
  })

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    phones: updatedUser.phones,
    addresses: updatedUser.addresses,
    roles: updatedUser.roles,
    status: updatedUser.status,
    mfaEnabled: updatedUser.userMfa?.enabled ?? false,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt
  }

}

exports.reactivateUserService = async (id, actor) => {

  const userRecord = await findUserById(id)
  if (!userRecord) {
    throw new AppError("User not found", 404)
  }

  if (userRecord.status !== UserStatus.SUSPENDED) {
    throw new AppError("User is not suspended", 400)
  }

  await prisma.$transaction(async (tx) => {
    await updateUser(userRecord, { status: UserStatus.ACTIVE }, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_REACTIVATED,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })
}