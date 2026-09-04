import * as prismaConfig from '../config/prisma.config.js';
import { InvoiceItemStatus, InvoiceStatus, PaymentStatus, PaymentAttemptStatus } from '@prisma/client';
export const createPaymentAttempt = async (data, itemPayments, client) => {
  return client.paymentAttempt.create({
    data: {
      invoiceId: data.invoiceId,
      createdById: data.createdById,
      itemPayments,
      idempotencyKey: data.idempotencyKey,
    }
  })
}

// paymentAttemptRepository.js

export const updatePaymentAttemptStripeIds = async (id, { stripeCheckoutSessionId, stripePaymentIntentId, amount }, client = prismaConfig.prisma) => {
  return client.paymentAttempt.update({
    where: { id },
    data: { stripeCheckoutSessionId, stripePaymentIntentId, amount },
  })
}

export const markPaymentAttemptFailed = async (id, errorMessage, client = prismaConfig.prisma) => {
  return client.paymentAttempt.update({
    where: { id },
    data: { 
      status: PaymentAttemptStatus.FAILED, failureReason: errorMessage ?? null
    },
  })
}

export const findPaymentAttemptBySessionId = async (stripeCheckoutSessionId, client = prismaConfig.prisma) => {
  return client.paymentAttempt.findUnique({ where: { stripeCheckoutSessionId } })
}

// Atomic check-then-act, same pattern as voidInvoiceById — only flips
// status if it's still PENDING. Caller checks .count to know if it won the claim.
export const markPaymentAttemptCompletedIfPending = async (id, client = prismaConfig.prisma) => {
  return client.paymentAttempt.updateMany({
    where: { id, status: PaymentAttemptStatus.PENDING },
    data: { status: PaymentAttemptStatus.COMPLETED },
  })
}

export const findStalePendingPaymentAttempts = async (staleMinutes, client = prismaConfig.prisma) => {
  return client.paymentAttempt.findMany({
    where: {
      status: PaymentAttemptStatus.PENDING,
      stripeCheckoutSessionId: { not: null }, // Stripe wasn't called successfully, nothing to reconcile against
      createdAt: { lt: new Date(Date.now() - staleMinutes * 60_000) },
    },
  })
}

// Any PENDING attempt whose itemPayments JSON references at least one of
// the given invoice item ids. itemPayments is stored as [itemId, amount]
// pairs, so this needs a raw JSON containment check rather than a
// relational filter Prisma can express directly.
export const findPendingAttemptsForItems = async (invoiceItemIds, client = prismaConfig.prisma) => {
  const pendingAttempts = await client.paymentAttempt.findMany({
    where: { status: PaymentAttemptStatus.PENDING },
  })

  return pendingAttempts.filter(attempt =>
    attempt.itemPayments.some(([itemId]) => invoiceItemIds.includes(itemId))
  )
}

export const markPaymentAttemptCancelledIfPending = async (id, client = prismaConfig.prisma) => {
  return client.paymentAttempt.updateMany({
    where: { id, status: PaymentAttemptStatus.PENDING },
    data: { status: PaymentAttemptStatus.CANCELLED },
  })
}

export const findPaymentAttemptById = async (id, client = prismaConfig.prisma) => {
  return client.paymentAttempt.findUnique({ where: { id } })
}