import * as invoiceRepository from '../repositories/invoice.repository.js';

import * as invoiceItemRepository from '../repositories/invoiceItem.repository.js';

import * as paymentAttemptRepository from '../repositories/paymentAttempt.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';

import * as tokenUtils from '../utils/token.utils.js';
import * as stripeConfig from '../config/stripe.config.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { InvoiceStatus, TargetType, AuditAction } from '@prisma/client';
import { randomUUID } from 'crypto';

export const createPaymentAttemptService = async ({ invoiceId, itemPayments: rawItemPayments }, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(invoiceId);
  if (!invoiceRecord || ![InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(invoiceRecord.status)) {
    throw new appError.AppError('No eligible invoices for payment', 404);
  }

  const itemPayments = new Map(rawItemPayments);
  const invoiceItems = await invoiceItemRepository.findUnpaidInvoiceItemsByIds([...itemPayments.keys()]);

  if (invoiceItems.length === 0) {
    throw new appError.AppError('No pending payment for any invoices', 400);
  }
  if (invoiceItems.length !== itemPayments.size) {
    throw new appError.AppError('One or more invoice items not eligible for payment', 400);
  }

  // Block a second live checkout link for an item that already has one —
  // closes the window where two concurrent PENDING attempts both pass the
  // paidAmount check below (neither has resolved yet) and later both get
  // confirmed by Stripe.
  const existingLiveAttempts = await paymentAttemptRepository.findPendingAttemptsForItems([...itemPayments.keys()])
  if (existingLiveAttempts.length > 0) {
    throw new appError.AppError('A payment link is already pending for one or more of these items', 409);
  }

  for (const item of invoiceItems) {
    // Guard against items from a different invoice being paid against this one —
    // invoiceItemRepository.findUnpaidInvoiceItemsByIds only filters by id/status, not invoiceId.
    if (item.invoiceId !== invoiceId) {
      throw new appError.AppError('One or more invoice items do not belong to this invoice', 400);
    }
    if (itemPayments.get(item.id) > item.amount - item.paidAmount) {
      throw new appError.AppError('Payment amount exceeds one or more items required amount', 400);
    }
  }

  const idempotencyKey = randomUUID()

  return prismaConfig.prisma.$transaction(async (tx) => {
    const result = await paymentAttemptRepository.createPaymentAttempt({
      invoiceId: invoiceRecord.id,
      createdById: actor.id,
      idempotencyKey
    }, [...itemPayments.entries()], tx);

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: result.id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_PAYMENT_ATTEMPTED,
      metadata: {
        invoiceId,
        itemPayments: [...itemPayments.entries()],
        idempotencyKey
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    // createPayment's own invoice update has no include — fetch the fully
    // populated invoice here so the caller can use this response directly
    // instead of needing a separate GET.
    return { paymentAttempt: result, invoice: await invoiceRepository.findInvoiceById(invoiceId, tx) };
  });
}

export const cancelPaymentAttemptService = async (attemptId, actor) => {
  const attempt = await paymentAttemptRepository.findPaymentAttemptById(attemptId);
  if (!attempt) {
    throw new appError.AppError('Payment attempt not found', 404);
  }
  if (attempt.status !== 'PENDING') {
    throw new appError.AppError('Only pending payment attempts can be cancelled', 409);
  }

  // Kill the Stripe side first. If this succeeds, the checkout URL is
  // guaranteed unpayable — safe to flip local status afterward.
  try {
    await stripeConfig.stripe.checkout.sessions.expire(attempt.stripeCheckoutSessionId)
  } catch (err) {
    // Stripe refuses to expire a session that's already been paid — this is
    // the exact race where the patient completes checkout right as staff
    // clicks cancel. Don't cancel locally; let the webhook (already in
    // flight or about to be) process it as a normal completion instead.
    if (err.code === 'checkout_session_expire_after_completion' || err.raw?.code === 'checkout_session_expire_after_completion') {
      throw new appError.AppError(
        'This payment just completed and cannot be cancelled — refresh to see the confirmed payment',
        409
      );
    }
    throw new appError.AppError('Failed to cancel checkout session with Stripe', 502);
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const { count } = await paymentAttemptRepository.markPaymentAttemptCancelledIfPending(attemptId, tx)
    if (count === 0) {
      // Lost a race against the webhook between the Stripe call above and
      // this transaction opening — treat as already resolved, not an error.
      throw new appError.AppError('This payment attempt was already resolved', 409);
    }

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: attemptId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_PAYMENT_ATTEMPT_CANCELLED, // new AuditAction
      metadata: { invoiceId: attempt.invoiceId, stripeCheckoutSessionId: attempt.stripeCheckoutSessionId },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return { attemptId, status: 'CANCELLED' };
  });
}