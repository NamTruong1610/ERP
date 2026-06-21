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
} = require("../services/userService")

const {
  invalidateAllUserSessions
} = require("../services/sessionService")

const {
  createUserActivation,
  updateUserActivation 
} = require("../services/activationService")

const {
  findMfaByUserId,
  updateMfa,
  upsertUserMfa,
  deleteMfa
} = require("../services/mfaService")

const {
  createAuditLog
} = require("../services/auditServices")

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

exports.createUserController = async (req, res, next) => {
  const { email } = req.body
  try {
    const userRecord = await findUserByEmail(email)

    if (userRecord) {
      return res.status(409).json({ message: 'User account already exists' })
    }

    const rawActivationTokenId = await generateActivationToken()
    const hashedActivationTokenId = await hashToken(rawActivationTokenId)

    const newUser = await createUser({ email })
    await createUserActivation(newUser.id, hashedActivationTokenId)

    await createAuditLog({
      actorId: req.user.id,
      targetId: newUser.id,
      targetType: TargetType.USER,
      action: AuditAction.USER_CREATED,
      metadata: { email },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await createUser({ email }, tx)
      await createUserActivation(user.id, hashedActivationTokenId, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: user.id,
        targetType: TargetType.USER,
        action: AuditAction.USER_CREATED,
        metadata: { email },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return user
    })

    await sendAccountActivationEmail(email, rawActivationTokenId)

    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      status: newUser.status
    })

  } catch (error) {
    next(error)
  }
}

exports.softDeleteUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id);
    if (!userRecord || userRecord.deletedAt !== null) {
      return res.status(404).json({
        message: 'No user found'
      })
    }

    // Write-ahead: log before the destructive operation
    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        targetId: userRecord.id,
        targetType: TargetType.USER,
        action: AuditAction.USER_DELETED,
        metadata: { email: userRecord.email },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      await softDeleteUserById(userRecord.id, tx)
    })

    // Invalidate all sessions and remember tokens (standalone due to Redis being a different service from Prisma)
    await invalidateAllUserSessions(id)

    return res.status(200).json({
      message: 'User deleted successfully'
    })

  } catch (error) {
    next(error)
  }
}

exports.hardDeleteUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id);
    if (!userRecord) {
      return res.status(404).json({
        message: 'No user found'
      })
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.USER_DELETED,
        metadata: { email: userRecord.email, hardDelete: true },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      await deleteUserById(id, tx)
    })

    // Invalidate all sessions and remember tokens
    await invalidateAllUserSessions(id)

    return res.status(200).json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    next(error);
  }

}

exports.getAllUsersController = async (req, res, next) => {
  const { search } = req.query
  try {
    const users = search
      ? await findAllUsersByString(search)
      : await findAllUsers()
    return res.status(200).json({ users })
  } catch (error) {
    next(error)
  }
}

exports.getUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    return res.status(200).json({
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
    })

  } catch (error) {
    next(error)
  }
}

exports.suspendUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.status === UserStatus.SUSPENDED) {
      return res.status(400).json({ message: "User is already suspended" })
    }

    await prisma.$transaction(async (tx) => {
      await updateUser(userRecord, { status: UserStatus.SUSPENDED }, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.USER_SUSPENDED,
        metadata: { previousStatus: userRecord.status },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
    })

    // Invalidate all sessions and remember tokens
    await invalidateAllUserSessions(id)

    return res.status(200).json({ message: "User suspended successfully" })
  } catch (error) {
    next(error)
  }
}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired (the user has already submitted their password and set up mfa, but hasn't verify otp for mfa)
exports.reset2faController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!userRecord.userMfa?.mfaSecret) {
      return res.status(400).json({ message: "User has no 2FA setup to reset" })
    }

    if (userRecord.userActivation) {
      let tokenAge = Date.now() - userRecord.userActivation?.updatedAt.getTime()
      if (tokenAge < ACTIVATION_EMAIL_IDEMPOTENCY_MS) {
        const remainingMs = ACTIVATION_EMAIL_IDEMPOTENCY_MS - tokenAge
        const remainingMins = Math.ceil(remainingMs / 1000 / 60)
        return res.status(429).json({
          message: `Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before resending`
        })
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
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.MFA_RESET,
        metadata: null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
    })

    // Invalidate all sessions so the user is forced to log in and set up 2FA again
    await invalidateAllUserSessions(id)
    await sendAccountActivationEmail(userRecord.email, rawActivationTokenId)

    return res.status(200).json({ message: "2FA reset successfully" })
  } catch (error) {
    next(error)
  }
}

exports.resendActivationEmailController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.status !== UserStatus.PENDING_ACTIVATION) {
      return res.status(400).json({ message: "User account is already activated" })
    }

    // Generate a new activation token and reset the TTL
    const rawActivationTokenId = await generateActivationToken()
    const hashedActivationTokenId = await hashToken(rawActivationTokenId)

    if (userRecord.userActivation) {
      let tokenAge = Date.now() - userRecord.userActivation?.updatedAt.getTime()
      if (tokenAge < ACTIVATION_EMAIL_IDEMPOTENCY_MS) {
        const remainingMs = ACTIVATION_EMAIL_IDEMPOTENCY_MS - tokenAge
        const remainingMins = Math.ceil(remainingMs / 1000 / 60)
        return res.status(429).json({
          message: `Please wait ${remainingMins} minute${remainingMins === 1 ? '' : 's'} before resending`
        })
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
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.ACTIVATION_RESENT,
        metadata: null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
    })

    await sendAccountActivationEmail(userRecord.email, rawActivationTokenId)

    return res.status(200).json({ message: "Activation email resent successfully" })
  } catch (error) {
    next(error)
  }
}

exports.assignRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!ROLES[role]) {
      return res.status(400).json({ message: "Invalid role" })
    }

    if (userRecord.roles.some(ur => ur.role === role)) {
      return res.status(400).json({ message: "User already has this role" })
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const result = await createUserRole(userRecord.id, role, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.ROLE,
        action: AuditAction.ROLE_ASSIGNED,
        metadata: { role },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return result
    })

    return res.status(200).json({ roles: updatedUser.roles })
  } catch (error) {
    next(error)
  }
}

exports.removeRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!userRecord.roles.some(ur => ur.role === role)) {
      return res.status(400).json({ message: "User does not have this role" })
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const result = await deleteUserRole(userRecord.id, role, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.ROLE,
        action: AuditAction.ROLE_REMOVED,
        metadata: { role },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return result
    })

    return res.status(200).json({ roles: updatedUser.roles })
  } catch (error) {
    next(error)
  }
}

exports.forceLogoutUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    await createAuditLog({
      actorId: req.user.id,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.FORCE_LOGOUT,
      metadata: null,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    await invalidateAllUserSessions(id)

    return res.status(200).json({ message: "User forcefully logged out successfully" })
  } catch (error) {
    next(error)
  }
}

exports.updateUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    const allowedFields = ["name", "email", "phones", "addresses"]
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided" })
    }

    if (updates.email) {
      const existingUser = await findUserByEmail(updates.email)
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ message: "Email already in use" })
      }
    }

    const previousEmail = userRecord.email
    const updatedUser = await prisma.$transaction(async (tx) => {
      const result = await updateUser(userRecord, updates, tx)
      if (updates.email && updates.email !== previousEmail) {
        await createAuditLog({
          actorId: req.user.id,
          targetId: id,
          targetType: TargetType.USER,
          action: AuditAction.EMAIL_CHANGED,
          metadata: { previousEmail, newEmail: updates.email },
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, tx)
      }
      return result
    })

    return res.status(200).json({
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
    })
  } catch (error) {
    next(error)
  }
}

exports.reactivateUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await findUserById(id)
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" })
    }

    if (userRecord.status !== UserStatus.SUSPENDED) {
      return res.status(400).json({ message: "User is not suspended" })
    }

    await prisma.$transaction(async (tx) => {
      await updateUser(userRecord, { status: UserStatus.ACTIVE }, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.USER_REACTIVATED,
        metadata: null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
    })

    return res.status(200).json({ message: "User reactivated successfully" })
  } catch (error) {
    next(error)
  }
}


