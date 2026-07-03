const {
  findAllDeletedUsers,
  findUserById,
  findDeletedUserById,
  restoreUser,
  hardDeleteUserById
} = require('../services/userService')

const {
  findAuditLogs,
  createAuditLog
} = require('../services/auditServices')

const {
  getAllActiveSessions,
  revokeSessionById,
  revokeAllSessions
} = require('../services/sessionService')

const {
  createUserActivation,
  updateUserActivation
} = require('../services/activationService')

const {
  sendAccountActivationEmail
} = require('../utils/emailUtils')

const {
  generateActivationToken,
  hashToken
} = require('../utils/activationTokenUtils')

const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType, TriggerType, ActorType, UserStatus } = require('@prisma/client')
const { ACTIVATION_TTL_MS } = require('../config/constants')


exports.getAuditLogsController = async (req, res, next) => {
  const {
    actorType,
    targetType,
    actorId,
    action,
    trigger,
    from,
    to,
    cursor,
    take = 50
  } = req.query

  const VALID_ACTOR_TYPES = ['USER', 'SYSTEM']
  const VALID_TARGET_TYPES = ['USER', 'PATIENT', 'APPOINTMENT', 'TREATMENT', 'FILE', 'SESSION', 'ROLE']
  const VALID_TRIGGERS = ['USER_ACTION', 'ADMIN_ACTION', 'SYSTEM', 'CASCADE']

  // Validate dates — reject values that can't be parsed
  const isValidDate = (val) => val && !isNaN(new Date(val).getTime())

  try {
    const result = await findAuditLogs({
      actorType: VALID_ACTOR_TYPES.includes(actorType) ? actorType : undefined,
      targetType: VALID_TARGET_TYPES.includes(targetType) ? targetType : undefined,
      actorId: actorId || undefined,
      action: action || undefined,
      trigger: VALID_TRIGGERS.includes(trigger) ? trigger : undefined,
      from: isValidDate(from) ? from : undefined,
      to: isValidDate(to) ? to : undefined,
      cursor: isValidDate(cursor) ? cursor : undefined,
      take: Math.min(parseInt(take) || 50, 100)
    })

    return res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

exports.getAllSessionsController = async (req, res, next) => {
  try {
    const sessions = await getAllActiveSessions()
    return res.status(200).json({ sessions })
  } catch (error) {
    next(error)
  }
}

exports.revokeSessionController = async (req, res, next) => {
  const { sessionId } = req.params
  try {
    const revoked = await revokeSessionById(sessionId)

    if (!revoked) {
      return res.status(404).json({ message: 'Session not found or already expired' })
    }

    await createAuditLog({
      actorId: req.user.id,
      actorType: ActorType.USER,
      targetId: sessionId,
      targetType: TargetType.SESSION,
      action: AuditAction.SESSION_REVOKED,
      metadata: { sessionId },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      trigger: TriggerType.ADMIN_ACTION
    })

    return res.status(200).json({ message: 'Session revoked successfully' })
  } catch (error) {
    next(error)
  }
}

exports.revokeAllSessionsController = async (req, res, next) => {
  try {
    const result = await revokeAllSessions()

    // Audit log after Redis operation — cross-system, can't be atomic
    await createAuditLog({
      actorId: req.user.id,
      actorType: ActorType.USER,
      targetId: null,
      targetType: null,
      action: AuditAction.SESSION_REVOKED,
      metadata: {
        scope: 'ALL',
        sessionsRevoked: result.sessionsRevoked,
        rememberTokensRevoked: result.rememberTokensRevoked
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      trigger: TriggerType.ADMIN_ACTION
    })

    return res.status(200).json({
      message: 'All sessions revoked successfully',
      ...result
    })
  } catch (error) {
    next(error)
  }
}

exports.getDeletedUsersController = async (req, res, next) => {
  try {
    const users = await findAllDeletedUsers()
    return res.status(200).json({ users })
  } catch (error) {
    next(error)
  }
}

exports.restoreUserController = async (req, res, next) => {
  const { id } = req.params
  try {

    const userRecord = await findDeletedUserById(id)

    if (!userRecord) {
      return res.status(404).json({ message: 'Deleted user not found' })
    }

    const rawActivationTokenId = await generateActivationToken()
    const hashedActivationTokenId = await hashToken(rawActivationTokenId)

    await prisma.$transaction(async (tx) => {
      await restoreUser(id, tx)

      if (userRecord.userActivation) {
        await tx.userActivation.update({
          where: { userId: id },
          data: {
            tokenId: hashedActivationTokenId,
            expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS)
          }
        })
      } else {
        await tx.userActivation.create({
          data: {
            userId: id,
            tokenId: hashedActivationTokenId,
            expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS)
          }
        })
      }

      await createAuditLog({
        actorId: req.user.id,
        actorType: ActorType.USER,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.USER_REACTIVATED,
        metadata: { restored: true, email: userRecord.email },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        trigger: TriggerType.ADMIN_ACTION
      }, tx)
    })

    // Email after commit — never email for a restore that rolled back
    await sendAccountActivationEmail(userRecord.email, rawActivationTokenId)

    return res.status(200).json({ message: 'User restored successfully' })
  } catch (error) {
    next(error)
  }
}

exports.purgeUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const userRecord = await prisma.user.findFirst({
      where: { id, deletedAt: { not: null } }
    })

    if (!userRecord) {
      return res.status(404).json({ message: 'Deleted user not found' })
    }

    // Write-ahead audit log before hard delete — record won't exist after
    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        actorType: ActorType.USER,
        targetId: id,
        targetType: TargetType.USER,
        action: AuditAction.USER_DELETED,
        metadata: {
          email: userRecord.email,
          hardDelete: true,
          purge: true,
          deletedAt: userRecord.deletedAt
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        trigger: TriggerType.ADMIN_ACTION
      }, tx)

      await hardDeleteUserById(id, tx)
    })

    return res.status(200).json({ message: 'User permanently deleted' })
  } catch (error) {
    next(error)
  }
}