const {
  updateUser,
  findUserById,
  findUserByEmail,
  createUserAddress,
  updateUserAddressByAddressId,
  deleteUserAddressByAddressId,
  findAllDentistUsers
} = require("../repository/userRepository")

const {
  invalidateAllUserSessions
} = require("../repository/sessionRepository")

const {
  findMfaByUserId,
  updateMfa,
  createUserMfa
} = require("../repository/mfaRepository")

const { createAuditLog } = require("../repository/auditRepository")

const { AppError } = require('../utils/errorsUtil.js');

const {
  comparePasswordHash,
  hashPassword
} = require("../utils/passwordUtils")

const {
  generateActivationToken
} = require("../utils/activationTokenUtils")

const { enqueueEmail, EMAIL_JOBS } = require("../queues/emailQueue")

const {
  verifyMfaOtp
} = require("../utils/mfaUtils")

const { redisClient } = require("../config/RedisConfig")
const { prisma } = require("../config/PrismaConfig")
const { UserStatus, AuditAction, TargetType } = require('@prisma/client')
const { RECOVERY_TTL_SECONDS, RECOVERY_MAP_TTL_SECONDS, COOKIE_OPTIONS } = require("../config/constants")

exports.getProfileService = async (id) => {

  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
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


exports.updateNameService = async (id, name) => {

  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const updatedUser = await updateUser(userRecord, { name })
  return {
    updatedName: updatedUser.name
  }

}

exports.updatePhonesService = async (id, phone) => {

  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }
  const updatedUser = await updateUser(userRecord, {
    phones: [...userRecord.phones, phone]
  })
  return { phones: updatedUser.phones }

}

exports.removePhoneService = async (id, phone) => {
  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const updatedUser = await updateUser(userRecord, {
    phones: userRecord.phones.filter(p => p !== phone)
  })

  return { phones: updatedUser.phones }

}

exports.addAddressService = async (id, address) => {
  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const updatedUser = await createUserAddress(userRecord, address)

  return { addresses: updatedUser.addresses }
}

exports.updateAddressService = async ({ id, addressId, address }) => {
  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const updatedUser = await updateUserAddressByAddressId(userRecord, addressId, address)

  return { addresses: updatedUser.addresses }

}

exports.removeAddressService = async (id, addressId) => {
  const userRecord = await findUserById(id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const updatedUser = await deleteUserAddressByAddressId(userRecord, addressId)

  return { addresses: updatedUser.addresses }
}

exports.changePasswordService = async ({ currentPassword, newPassword, confirmNewPassword }, actor) => {
  if (newPassword !== confirmNewPassword) {
    throw new AppError("Passwords do not match", 400)
  }

  const userRecord = await findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const passwordsMatched = await comparePasswordHash(currentPassword, userRecord.password)
  if (!passwordsMatched) {
    throw new AppError("Invalid current password", 400)
  }

  const hashedPassword = await hashPassword(newPassword)

  // Invalidate all other sessions so other devices are forced to re-login
  await invalidateAllUserSessions(actor.id)

  await prisma.$transaction(async (tx) => {
    await updateUser(userRecord, { password: hashedPassword }, tx)
    await createAuditLog({
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

exports.changeEmailService = async ({ email, password }, actor) => {

  const userRecord = await findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  // Require password confirmation to prevent unauthorized email change
  const passwordsMatched = await comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    throw new AppError("Invalid password", 400)
  }

  // Check new email isn't already taken
  const existingUser = await findUserByEmail(email)
  if (existingUser) {
    throw new AppError("Email already in use", 400)
  }

  // Delete any previously pending email change token
  const existingTokenRaw = await redisClient.get(`user_email_change:${actor.id}`)
  if (existingTokenRaw) {
    const { tokenId } = JSON.parse(existingTokenRaw)
    await Promise.all([
      redisClient.del(`token:email_change:${tokenId}`),
      redisClient.del(`user_email_change:${actor.id}`)
    ])
  }

  const tokenId = await generateActivationToken()

  await Promise.all([
    redisClient.set(
      `token:email_change:${tokenId}`,
      JSON.stringify({ id: actor.id, email }),
      { EX: RECOVERY_TTL_SECONDS } // 15 mins
    ),
    redisClient.set(
      `user_email_change:${actor.id}`,
      JSON.stringify({ tokenId }),
      { EX: RECOVERY_MAP_TTL_SECONDS } // 16 mins
    )
  ])

  await enqueueEmail(EMAIL_JOBS.EMAIL_CHANGE, { email, tokenId })

  await createAuditLog({
    actorId: actor.id,
    targetId: actor.id,
    targetType: TargetType.USER,
    action: AuditAction.EMAIL_CHANGE_REQUESTED,
    metadata: { newEmail: email },
    ip: actor.ip,
    userAgent: actor.userAgent
  })

}

exports.verifyEmailChangeService = async (tokenId, actor) => {
  const tokenRaw = await redisClient.get(`token:email_change:${tokenId}`)
  if (!tokenRaw) {
    throw new AppError("Invalid or expired token", 404)
  }

  const tokenData = JSON.parse(tokenRaw)

  // Ensure the token belongs to the authenticated user
  if (tokenData.id !== actor.id) {
    throw new AppError("Forbidden", 403)
  }

  const userRecord = await findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  const previousEmail = userRecord.email

  await prisma.$transaction(async (tx) => {
    await updateUser(userRecord, { email: tokenData.email }, tx)
    await createAuditLog({
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
    redisClient.del(`token:email_change:${tokenId}`),
    redisClient.del(`user_email_change:${actor.id}`)
  ])
}

exports.disable2faService = async ({ password, otp }, actor) => {
  const userRecord = await findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  if (!userRecord.userMfa?.enabled) {
    throw new AppError("2FA is already disabled", 400)
  }

  const passwordsMatched = await comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    throw new AppError("Invalid password", 401)
  }

  const validOtp = await verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)
  if (!validOtp) {
    throw new AppError("Invalid OTP", 401)
  }

  // Invalidate all sessions and force re-login
  await invalidateAllUserSessions(userRecord.id)

  await prisma.$transaction(async (tx) => {
    await updateMfa(userRecord.id, { enabled: false }, tx)
    await createAuditLog({
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

exports.enable2faService = async ({ password, otp }, actor) => {
  const userRecord = await findUserById(actor.id)
  if (!userRecord || userRecord.status !== UserStatus.ACTIVE) {
    throw new AppError("User not found", 404)
  }

  if (userRecord.userMfa?.enabled) {
    throw new AppError("2FA is already enabled", 400)
  }

  // Make sure the user has a secret from the initial setup
  if (!userRecord.userMfa?.mfaSecret) {
    throw new AppError("No 2FA secret found, contact an administrator", 400)
  }

  const passwordsMatched = await comparePasswordHash(password, userRecord.password)
  if (!passwordsMatched) {
    throw new AppError("Invalid password", 401)
  }

  // Verify OTP to confirm authenticator app is still working
  const validOtp = await verifyMfaOtp(otp, userRecord.userMfa?.mfaSecret)
  if (!validOtp) {
    throw new AppError("Invalid OTP", 401)
  }

  await prisma.$transaction(async (tx) => {
    await updateMfa(userRecord.id, { enabled: true }, tx)
    await createAuditLog({
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

exports.getDentistsService = async () => {
  try {
    const dentists = await findAllDentistUsers()
    return { dentists }
  } catch (error) {
    next(error)
  }
}



