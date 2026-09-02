import * as userRepository from '../repositories/user.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import * as activationRepository from '../repositories/activation.repository.js';
import * as emailQueue from '../queues/email.queue.js';
import * as tokenUtils from '../utils/token.utils.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as constants from '../config/constants.js';
import * as appError from '../lib/AppError.js';
import { ActorType, TargetType, AuditAction, TriggerType } from '@prisma/client';
// service
const VALID_ACTOR_TYPES = ['USER', 'SYSTEM'];
const VALID_TARGET_TYPES = ['USER', 'PATIENT', 'APPOINTMENT', 'TREATMENT', 'FILE', 'SESSION', 'ROLE'];
const VALID_TRIGGERS = ['USER_ACTION', 'ADMIN_ACTION', 'SYSTEM', 'CASCADE'];
const isValidDate = (val) => val && !isNaN(new Date(val).getTime());

export const getAuditLogsService = async (filters) => {
  const { actorType, targetType, actorId, action, trigger, from, to, cursor, take } = filters;

  return auditRepository.findAuditLogs({
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
export const revokeSessionService = async (sessionId, actor) => {
  const revoked = await sessionRepository.revokeSessionById(sessionId);
  if (!revoked) {
    throw new appError.AppError('Session not found or already expired', 404);
  }

  await auditRepository.createAuditLog({
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

export const revokeAllSessionsService = async (actor) => {
  const result = await sessionRepository.revokeAllSessions();

  // Audit log after Redis operation — cross-system, can't be atomic
  await auditRepository.createAuditLog({
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
export const restoreUserService = async (id, actor) => {
  const userRecord = await userRepository.findDeletedUserById(id);
  if (!userRecord) {
    throw new appError.AppError('Deleted user not found', 404);
  }

  const rawActivationTokenId = await tokenUtils.generateActivationToken();
  const hashedActivationTokenId = await tokenUtils.hashToken(rawActivationTokenId);

  await prismaConfig.prisma.$transaction(async (tx) => {
    await userRepository.restoreUser(id, tx);

    if (userRecord.userActivation) {
      await activationRepository.updateUserActivation(id, {
        tokenId: hashedActivationTokenId,
        expiresAt: new Date(Date.now() + constants.ACTIVATION_TTL_MS),
      }, tx);
    } else {
      await activationRepository.createUserActivation(id, hashedActivationTokenId, tx);
    }

    await auditRepository.createAuditLog({
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
  await emailQueue.enqueueEmail(emailQueue.EMAIL_JOBS.ACTIVATION, { email: userRecord.email, tokenId: rawActivationTokenId });
};

export const purgeUserService = async (id, actor) => {
  const userRecord = await userRepository.findDeletedUserById(id);
  if (!userRecord) {
    throw new appError.AppError('Deleted user not found', 404);
  }

  // Write-ahead audit log before hard delete — record won't exist after
  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
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

    await userRepository.hardDeleteUserById(id, tx);
  });
};

export const getAllActiveSessionsService = async () => {
  return await sessionRepository.getAllActiveSessions()
}

export const getAllDeletedUsersService = async () => {
  return await userRepository.findAllDeletedUsers()
}