import * as prismaConfig from '../config/prisma.config.js';
import * as webhookRepository from '../repositories/webhook.repository.js';
import * as paymentAttemptRepository from '../repositories/paymentAttempt.repository.js';
import * as paymentRepository from '../repositories/payment.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import { ActorType, WebhookEventStatus, PaymentMethod, TargetType, AuditAction } from '@prisma/client';
export const processStripeWebhookEventService = async (webhookEventId) => {
  const webhookEvent = await webhookRepository.findWebhookEventById(webhookEventId)
  if (!webhookEvent) {
    throw new Error(`WebhookEvent ${webhookEventId} not found`)
  }

  // Redelivered job landing here after a prior run already succeeded — ack quietly.
  if (webhookEvent.status === WebhookEventStatus.PROCESSED) {
    return
  }

  await webhookRepository.markWebhookEventProcessing(webhookEvent.id)

  const event = webhookEvent.payload

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object)
        break
      default:
        // Not yet handled — acknowledged, not an error.
        break
    }
    await webhookRepository.markWebhookEventProcessed(webhookEvent.id)
  } catch (err) {
    await webhookRepository.markWebhookEventFailed(webhookEvent.id, err.message)
    throw err // let consumeWithRetry's ladder handle the retry
  }
}

export const handleCheckoutSessionCompleted = async (session) => {
  const paymentAttemptId = session.metadata?.paymentAttemptId
  if (!paymentAttemptId) {
    throw new Error(`Checkout session ${session.id} has no paymentAttemptId in metadata`)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    const paymentAttempt = await paymentAttemptRepository.findPaymentAttemptBySessionId(session.id, tx)
    if (!paymentAttempt) {
      throw new Error(`No PaymentAttempt found for session ${session.id}`)
    }

    // Guard + creation in one transaction — if creation throws below,
    // this status flip rolls back too, so there's no window where
    // COMPLETED exists without a real Payment behind it.
    const claimed = await paymentAttemptRepository.markPaymentAttemptCompletedIfPending(paymentAttempt.id, tx)
    if (claimed.count === 0) {
      return // already processed by an earlier delivery — no-op
    }

    const itemPayments = new Map(paymentAttempt.itemPayments)

    const result = await paymentRepository.createPayment({
      invoiceId: paymentAttempt.invoiceId,
      method: PaymentMethod.CARD,
      recordedById: paymentAttempt.createdById,
      note: null,
      paymentAttemptId: paymentAttempt.id,
    }, itemPayments, tx)

    await auditRepository.createAuditLog({
      actorId: null,
      actorType: ActorType.SYSTEM,
      targetId: result.payment.id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_PAYMENT_RECORDED,
      metadata: {
        invoiceId: paymentAttempt.invoiceId,
        amount: result.payment.amount,
        method: PaymentMethod.CARD,
        itemPayments: [...itemPayments.entries()],
        source: 'stripe',
        paymentAttemptId: paymentAttempt.id,
        initiatedByUserId: paymentAttempt.createdById, // traceability, without conflating with actorId
      },
      ip: null,
      userAgent: null,
    }, tx)
  })
}