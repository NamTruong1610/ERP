import * as userRepository from "../repositories/user.repository.js";
import * as sessionRepository from "../repositories/session.repository.js";
import * as activationRepository from "../repositories/activation.repository.js";
import * as mfaRepository from "../repositories/mfa.repository.js";
import * as auditRepository from "../repositories/audit.repository.js";
import * as statsRepository from '../repositories/stats.repository.js';
import * as appError from '../lib/AppError.js';

import * as tokenUtils from "../utils/token.utils.js";
import * as emailQueue from "../queues/email.queue.js";
import * as constants from '../config/constants.js';
import * as redisConfig from "../config/redis.config.js";
import * as rbacConfig from '../config/rbac.config.js';
import * as prismaConfig from "../config/prisma.config.js";
import { UserStatus, AuditAction, TargetType } from '@prisma/client';
export const createUserService = async (email, actor) => {

  const userRecord = await userRepository.findUserByEmail(email)

  if (userRecord) {
    throw new appError.AppError('User account already exists', 409)
  }

  const rawActivationTokenId = await tokenUtils.generateActivationToken()
  const hashedActivationTokenId = await tokenUtils.hashToken(rawActivationTokenId)

  const newUser = await prismaConfig.prisma.$transaction(async (tx) => {
    const user = await userRepository.createUser({ email }, tx)
    await activationRepository.createUserActivation(user.id, hashedActivationTokenId, tx)
    await auditRepository.createAuditLog({
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

  await statsRepository.invalidateClinicStats()

  await emailQueue.enqueueEmail(emailQueue.EMAIL_JOBS.ACTIVATION, { email, tokenId: rawActivationTokenId })

  return {
    id: newUser.id,
    email: newUser.email,
    status: newUser.status
  }
}

export const deleteUserService = async (id, actor) => {

  const userRecord = await userRepository.findUserById(id);
  if (!userRecord || userRecord.deletedAt !== null) {
    throw new appError.AppError('No user found', 404)
  }

  // Invalidate all sessions and remember tokens (standalone due to Redis being a different service from Prisma)
  await sessionRepository.invalidateAllUserSessions(id)

  // Write-ahead: log before the destructive operation
  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: userRecord.id,
      targetType: TargetType.USER,
      action: AuditAction.USER_DELETED,
      metadata: { email: userRecord.email },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await userRepository.softDeleteUserById(userRecord.id, tx)
  })
}

export const hardDeleteUserService = async (id, actor) => {
  const userRecord = await userRepository.findUserById(id);
  if (!userRecord) {
    throw new appError.AppError('No user found', 404)

  }

  // Invalidate all sessions and remember tokens
  await sessionRepository.invalidateAllUserSessions(id)

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_DELETED,
      metadata: { email: userRecord.email, hardDelete: true },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await userRepository.hardDeleteUserById(id, tx)
  })
}

export const getAllUsersService = async ({ search, take, skip }) => {

  const pagination = {
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip)
  }

  const result = search
    ? await userRepository.findAllUsersByString(search, pagination)
    : await userRepository.findAllUsers(pagination)

  return result

}

export const getUserService = async (id) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
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

export const suspendUserService = async (id, actor) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  if (userRecord.status === UserStatus.SUSPENDED) {
    throw new appError.AppError("User is already suspended", 400)
  }

  // Invalidate all sessions and remember tokens
  await sessionRepository.invalidateAllUserSessions(id)

  await prismaConfig.prisma.$transaction(async (tx) => {
    await userRepository.updateUser(userRecord, { status: UserStatus.SUSPENDED }, tx)
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_SUSPENDED,
      metadata: { previousStatus: userRecord.status },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired (the user has already submitted their password and set up mfa, but hasn't verify otp for mfa)
export const reset2faService = async (id, actor) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  if (!userRecord.userMfa?.mfaSecret) {
    throw new appError.AppError("User has no 2FA setup to reset", 400)
  }

  if (userRecord.userActivation) {
    let tokenAge = Date.now() - userRecord.userActivation?.updatedAt.getTime()
    if (tokenAge < constants.ACTIVATION_EMAIL_IDEMPOTENCY_MS) {
      const remainingMs = constants.ACTIVATION_EMAIL_IDEMPOTENCY_MS - tokenAge
      const remainingMins = Math.ceil(remainingMs / 1000 / 60)
      throw new appError.AppError(`Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before resending`, 429)
    }
  }

  const rawActivationTokenId = await tokenUtils.generateActivationToken()
  const hashedActivationTokenId = await tokenUtils.hashToken(rawActivationTokenId)

  // Invalidate all sessions so the user is forced to log in and set up 2FA again
  await sessionRepository.invalidateAllUserSessions(id)

  await prismaConfig.prisma.$transaction(async (tx) => {
    if (userRecord.userActivation) {
      await activationRepository.updateUserActivation(userRecord.id, {
        tokenId: hashedActivationTokenId,
        expiresAt: new Date(Date.now() + constants.ACTIVATION_TTL_MS)
      }, tx)
    } else {
      await activationRepository.createUserActivation(userRecord.id, hashedActivationTokenId, tx)
    }

    await mfaRepository.updateMfa(userRecord.id, {
      mfaSecret: null,
      mfaUri: null,
      enabled: false,
    }, tx)

    await userRepository.updateUser(userRecord, {
      status: UserStatus.PENDING_MFA_SETUP
    }, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.MFA_RESET,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  await emailQueue.enqueueEmail(emailQueue.EMAIL_JOBS.ACTIVATION, { email: userRecord.email, tokenId: rawActivationTokenId })
}

export const resendActivationEmailService = async (id, actor) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  if (userRecord.status !== UserStatus.PENDING_ACTIVATION) {
    throw new appError.AppError("User account is already activated", 400)
  }

  // Generate a new activation token and reset the TTL
  const rawActivationTokenId = await tokenUtils.generateActivationToken()
  const hashedActivationTokenId = await tokenUtils.hashToken(rawActivationTokenId)

  if (userRecord.userActivation) {
    let tokenAge = Date.now() - userRecord.userActivation?.updatedAt.getTime()
    if (tokenAge < constants.ACTIVATION_EMAIL_IDEMPOTENCY_MS) {
      const remainingMs = constants.ACTIVATION_EMAIL_IDEMPOTENCY_MS - tokenAge
      const remainingMins = Math.ceil(remainingMs / 1000 / 60)
      throw new appError.AppError(`Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before resending`, 429)
    }
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    if (userRecord.userActivation) {
      await activationRepository.updateUserActivation(userRecord.id, {
        tokenId: hashedActivationTokenId,
        expiresAt: new Date(Date.now() + constants.ACTIVATION_TTL_MS)
      }, tx)
    } else {
      await activationRepository.createUserActivation(userRecord.id, hashedActivationTokenId, tx)
    }

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.ACTIVATION_RESENT,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  await emailQueue.enqueueEmail(emailQueue.EMAIL_JOBS.ACTIVATION, { email: userRecord.email, tokenId: rawActivationTokenId })

}

export const assignRoleService = async (id, role, actor) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  if (!rbacConfig.ROLES[role]) {
    throw new appError.AppError("Invalid role", 400)
  }

  if (userRecord.roles.some(ur => ur.role === role)) {
    throw new appError.AppError("User already has this role", 400)
  }

  const updatedUser = await prismaConfig.prisma.$transaction(async (tx) => {
    const result = await userRepository.createUserRole(userRecord.id, role, tx)
    await auditRepository.createAuditLog({
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

export const removeRoleService = async (id, role, actor) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  if (!userRecord.roles.some(ur => ur.role === role)) {
    throw new appError.AppError("User does not have this role", 400)
  }

  const updatedUser = await prismaConfig.prisma.$transaction(async (tx) => {
    const result = await userRepository.deleteUserRole(userRecord.id, role, tx)
    await auditRepository.createAuditLog({
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

export const forceLogoutUserService = async (id, actor) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  await sessionRepository.invalidateAllUserSessions(id)

  await auditRepository.createAuditLog({
    actorId: actor.id,
    targetId: id,
    targetType: TargetType.USER,
    action: AuditAction.FORCE_LOGOUT,
    metadata: null,
    ip: actor.ip,
    userAgent: actor.userAgent
  })
}

// Review this service in business security context
export const updateUserService = async (id, body, actor) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  const allowedFields = ["name", "email", "phones", "addresses"]
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new appError.AppError("No valid fields provided", 400)
  }

  if (updates.email) {
    const existingUser = await userRepository.findUserByEmail(updates.email)
    if (existingUser && existingUser.id !== id) {
      throw new appError.AppError("Email already in use", 400)
    }
  }

  const previousEmail = userRecord.email
  const updatedUser = await prismaConfig.prisma.$transaction(async (tx) => {
    const result = await userRepository.updateUser(userRecord, updates, tx)
    if (updates.email && updates.email !== previousEmail) {
      await auditRepository.createAuditLog({
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

export const reactivateUserService = async (id, actor) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord) {
    throw new appError.AppError("User not found", 404)
  }

  if (userRecord.status !== UserStatus.SUSPENDED) {
    throw new appError.AppError("User is not suspended", 400)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await userRepository.updateUser(userRecord, { status: UserStatus.ACTIVE }, tx)
    await auditRepository.createAuditLog({
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