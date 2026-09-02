import * as userRepository from "../repositories/user.repository.js";
import * as sessionRepository from "../repositories/session.repository.js";
import * as mfaRepository from "../repositories/mfa.repository.js";
import * as auditRepository from "../repositories/audit.repository.js";
import * as appError from '../lib/AppError.js';

import * as passwordUtils from "../utils/password.utils.js";
import * as tokenUtils from "../utils/token.utils.js";
import * as emailQueue from "../queues/email.queue.js";
import * as mfaUtils from "../utils/mfa.utils.js";
import * as redisConfig from "../config/redis.config.js";
import * as prismaConfig from "../config/prisma.config.js";
import * as constants from "../config/constants.js";
import { TargetType, UserStatus, AuditAction } from '@prisma/client';
export const getProfileService = async (id) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  return {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    phones: userRecord.phones,
    addresses: userRecord.addresses,
    roles: userRecord.roles,
    mfaEnabled: userRecord.userMfa?.enabled ?? false
  }
}


export const updateNameService = async (id, name) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const updatedUser = await userRepository.updateUser(userRecord, { name })
  return {
    updatedName: updatedUser.name
  }

}

export const updatePhonesService = async (id, phone) => {

  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }
  const updatedUser = await userRepository.updateUser(userRecord, {
    phones: [...userRecord.phones, phone]
  })
  return { phones: updatedUser.phones }

}

export const removePhoneService = async (id, phone) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const updatedUser = await userRepository.updateUser(userRecord, {
    phones: userRecord.phones.filter(p => p !== phone)
  })

  return { phones: updatedUser.phones }

}

export const addAddressService = async (id, address) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const updatedUser = await userRepository.createUserAddress(userRecord, address)

  return { addresses: updatedUser.addresses }
}

export const updateAddressService = async ({ id, addressId, address }) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const updatedUser = await userRepository.updateUserAddressByAddressId(userRecord, addressId, address)

  return { addresses: updatedUser.addresses }

}

export const removeAddressService = async (id, addressId) => {
  const userRecord = await userRepository.findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const updatedUser = await userRepository.deleteUserAddressByAddressId(userRecord, addressId)

  return { addresses: updatedUser.addresses }
}

export const changePasswordService = async ({ currentPassword, newPassword, confirmNewPassword }, actor) => {
  if (newPassword !== confirmNewPassword) {
    throw new appError.AppError("Passwords do not match", 400)
  }

  const userRecord = await userRepository.findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const passwordsMatched = await passwordUtils.comparePasswordHash(currentPassword, userRecord.password)
  if (!passwordsMatched) {
    throw new appError.AppError("Invalid current password", 400)
  }

  const hashedPassword = await passwordUtils.hashPassword(newPassword)

  // Invalidate all other sessions so other devices are forced to re-login
  await sessionRepository.invalidateAllUserSessions(actor.id)

  await prismaConfig.prisma.$transaction(async (tx) => {
    await userRepository.updateUser(userRecord, { password: hashedPassword }, tx)
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: actor.id,
      targetType: TargetType.USER,
      action: AuditAction.PASSWORD_CHANGED,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })
}

export const changeEmailService = async ({ email, password }, actor) => {

  const userRecord = await userRepository.findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  // Require password confirmation to prevent unauthorized email change
  const passwordsMatched = await passwordUtils.comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    throw new appError.AppError("Invalid password", 400)
  }

  // Check new email isn't already taken
  const existingUser = await userRepository.findUserByEmail(email)
  if (existingUser) {
    throw new appError.AppError("Email already in use", 400)
  }

  // Delete any previously pending email change token
  const existingTokenRaw = await redisConfig.redisClient.get(`user_email_change:${actor.id}`)
  if (existingTokenRaw) {
    const { tokenId } = JSON.parse(existingTokenRaw)
    await Promise.all([
      redisConfig.redisClient.del(`token:email_change:${tokenId}`),
      redisConfig.redisClient.del(`user_email_change:${actor.id}`)
    ])
  }

  const tokenId = await tokenUtils.generateActivationToken()

  await Promise.all([
    redisConfig.redisClient.set(
      `token:email_change:${tokenId}`,
      JSON.stringify({ id: actor.id, email }),
      { EX: constants.RECOVERY_TTL_SECONDS } // 15 mins
    ),
    redisConfig.redisClient.set(
      `user_email_change:${actor.id}`,
      JSON.stringify({ tokenId }),
      { EX: constants.RECOVERY_MAP_TTL_SECONDS } // 16 mins
    )
  ])

  await emailQueue.enqueueEmail(emailQueue.EMAIL_JOBS.EMAIL_CHANGE, { email, tokenId })

  await auditRepository.createAuditLog({
    actorId: actor.id,
    targetId: actor.id,
    targetType: TargetType.USER,
    action: AuditAction.EMAIL_CHANGE_REQUESTED,
    metadata: { newEmail: email },
    ip: actor.ip,
    userAgent: actor.userAgent
  })

}

export const verifyEmailChangeService = async (tokenId, actor) => {
  const tokenRaw = await redisConfig.redisClient.get(`token:email_change:${tokenId}`)
  if (!tokenRaw) {
    throw new appError.AppError("Invalid or expired token", 404)
  }

  const tokenData = JSON.parse(tokenRaw)

  // Ensure the token belongs to the authenticated user
  if (tokenData.id !== actor.id) {
    throw new appError.AppError("Forbidden", 403)
  }

  const userRecord = await userRepository.findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  const previousEmail = userRecord.email

  await prismaConfig.prisma.$transaction(async (tx) => {
    await userRepository.updateUser(userRecord, { email: tokenData.email }, tx)
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: actor.id,
      targetType: TargetType.USER,
      action: AuditAction.EMAIL_CHANGED,
      metadata: { previousEmail, newEmail: tokenData.email },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

  await Promise.all([
    redisConfig.redisClient.del(`token:email_change:${tokenId}`),
    redisConfig.redisClient.del(`user_email_change:${actor.id}`)
  ])
}

export const disable2faService = async ({ password, otp }, actor) => {
  const userRecord = await userRepository.findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  if (!userRecord.userMfa?.enabled) {
    throw new appError.AppError("2FA is already disabled", 400)
  }

  const passwordsMatched = await passwordUtils.comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    throw new appError.AppError("Invalid password", 401)
  }

  const validOtp = await mfaUtils.verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)
  if (!validOtp) {
    throw new appError.AppError("Invalid OTP", 401)
  }

  // Invalidate all sessions and force re-login
  await sessionRepository.invalidateAllUserSessions(userRecord.id)

  await prismaConfig.prisma.$transaction(async (tx) => {
    await mfaRepository.updateMfa(userRecord.id, { enabled: false }, tx)
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: actor.id,
      targetType: TargetType.USER,
      action: AuditAction.MFA_DISABLED,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })

}

export const enable2faService = async ({ password, otp }, actor) => {
  const userRecord = await userRepository.findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new appError.AppError("User not found", 404)
  }

  if (userRecord.userMfa?.enabled) {
    throw new appError.AppError("2FA is already enabled", 400)
  }

  // Make sure the user has a secret from the initial setup
  if (!userRecord.userMfa?.mfaSecret) {
    throw new appError.AppError("No 2FA secret found, contact an administrator", 400)
  }

  const passwordsMatched = await passwordUtils.comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    throw new appError.AppError("Invalid password", 401)
  }

  // Verify OTP to confirm authenticator app is still working
  const validOtp = await mfaUtils.verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)
  if (!validOtp) {
    throw new appError.AppError("Invalid OTP", 401)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await mfaRepository.updateMfa(userRecord.id, { enabled: true }, tx)
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: actor.id,
      targetType: TargetType.USER,
      action: AuditAction.MFA_ENABLED,
      metadata: null,
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })
}

export const getDentistsService = async () => {
  try {
    const dentists = await userRepository.findAllDentistUsers()
    return { dentists }
  } catch (error) {
    throw error
  }
}



