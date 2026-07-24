const {
  findAllDeletedUsers,
  findUserById,
  findDeletedUserById,
  restoreUser,
  hardDeleteUserById
} = require('../repositories/userRepository')

const {
  findAuditLogs,
  createAuditLog
} = require('../repositories/auditRepository')

const {
  getAllActiveSessions,
  revokeSessionById,
  revokeAllSessions
} = require('../repositories/sessionRepository')

const {
  createUserActivation,
  updateUserActivation
} = require('../repositories/activationRepository')

const { enqueueEmail, EMAIL_JOBS } = require('../queues/emailQueue')

const {
  generateActivationToken,
  hashToken
} = require('../utils/tokenUtils')

const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType, TriggerType, ActorType, UserStatus } = require('@prisma/client')
const { ACTIVATION_TTL_MS } = require('../config/constants')

const { AppError } = require('../lib/AppError')

// service
const VALID_ACTOR_TYPES = ['USER', 'SYSTEM'];
const VALID_TARGET_TYPES = ['USER', 'PATIENT', 'APPOINTMENT', 'TREATMENT', 'FILE', 'SESSION', 'ROLE'];
const VALID_TRIGGERS = ['USER_ACTION', 'ADMIN_ACTION', 'SYSTEM', 'CASCADE'];
const isValidDate = (val) => val && !isNaN(new Date(val).getTime());

exports.getAuditLogsService = async (filters) => {
  const { actorType, targetType, actorId, action, trigger, from, to, cursor, take } = filters;

  return findAuditLogs({
    actorType: VALID_ACTOR_TYPES.includes(actorType) ? actorType : undefined,
    targetType: VALID_TARGET_TYPES.includes(targetType) ? targetType : undefined,
    actorId: actorId || undefined,
    action: action || undefined,
    trigger: VALID_TRIGGERS.includes(trigger) ? trigger : undefined,
    from: isValidDate(from) ? from : undefined,
    to: isValidDate(to) ? to : undefined,
    cursor: isValidDate(cursor) ? cursor : undefined,
    take: Math.min(parseInt(take, 10) || 50, 100),
  });
};

// service
exports.revokeSessionService = async (sessionId, actor) => {
  const revoked = await revokeSessionById(sessionId);
  if (!revoked) {
    throw new AppError('Session not found or already expired', 404);
  }

  await createAuditLog({
    actorId: actor.id,
    actorType: ActorType.USER,
    targetId: sessionId,
    targetType: TargetType.SESSION,
    action: AuditAction.SESSION_REVOKED,
    metadata: { sessionId },
    ip: actor.ip,
    userAgent: actor.userAgent,
    trigger: TriggerType.ADMIN_ACTION,
  });
};

exports.revokeAllSessionsService = async (actor) => {
  const result = await revokeAllSessions();

  // Audit log after Redis operation — cross-system, can't be atomic
  await createAuditLog({
    actorId: actor.id,
    actorType: ActorType.USER,
    targetId: null,
    targetType: null,
    action: AuditAction.SESSION_REVOKED,
    metadata: {
      scope: 'ALL',
      sessionsRevoked: result.sessionsRevoked,
      rememberTokensRevoked: result.rememberTokensRevoked,
    },
    ip: actor.ip,
    userAgent: actor.userAgent,
    trigger: TriggerType.ADMIN_ACTION,
  });

  return result;
};

// service
exports.restoreUserService = async (id, actor) => {
  const userRecord = await findDeletedUserById(id);
  if (!userRecord) {
    throw new AppError('Deleted user not found', 404);
  }

  const rawActivationTokenId = await generateActivationToken();
  const hashedActivationTokenId = await hashToken(rawActivationTokenId);

  await prisma.$transaction(async (tx) => {
    await restoreUser(id, tx);

    if (userRecord.userActivation) {
      await updateUserActivation(id, {
        tokenId: hashedActivationTokenId,
        expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS),
      }, tx);
    } else {
      await createUserActivation(id, hashedActivationTokenId, tx);
    }

    await createAuditLog({
      actorId: actor.id,
      actorType: ActorType.USER,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_REACTIVATED,
      metadata: { restored: true, email: userRecord.email },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.ADMIN_ACTION,
    }, tx);
  });

  // Email after commit — never email for a restore that rolled back
  await enqueueEmail(EMAIL_JOBS.ACTIVATION, { email: userRecord.email, tokenId: rawActivationTokenId });
};

exports.purgeUserService = async (id, actor) => {
  const userRecord = await findDeletedUserById(id);
  if (!userRecord) {
    throw new AppError('Deleted user not found', 404);
  }

  // Write-ahead audit log before hard delete — record won't exist after
  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      actorType: ActorType.USER,
      targetId: id,
      targetType: TargetType.USER,
      action: AuditAction.USER_DELETED,
      metadata: {
        email: userRecord.email,
        hardDelete: true,
        purge: true,
        deletedAt: userRecord.deletedAt,
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.ADMIN_ACTION,
    }, tx);

    await hardDeleteUserById(id, tx);
  });
};

exports.getAllActiveSessionsService = async () => {
  return await getAllActiveSessions()
}

exports.getAllDeletedUsersService = async () => {
  return await findAllDeletedUsers()
}