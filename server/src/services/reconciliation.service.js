import * as stripeConfig from '../config/stripe.config.js';
import * as paymentAttemptRepository from '../repositories/paymentAttempt.repository.js';
import * as webhookProcessingService from './webhookProcessing.service.js';
import * as prismaConfig from '../config/prisma.config.js';
import { PaymentAttemptStatus } from '@prisma/client';
const STALE_THRESHOLD_MINUTES = 20

export const reconcileStalePaymentAttemptsService = async () => {
  const staleAttempts = await paymentAttemptRepository.findStalePendingPaymentAttempts(STALE_THRESHOLD_MINUTES)

  for (const attempt of staleAttempts) {
    try {
      const session = await stripeConfig.stripe.checkout.sessions.retrieve(attempt.stripeCheckoutSessionId)

      if (session.payment_status === 'paid') {
        // Same code path the webhook would have taken — idempotent,
        // guarded by the same PENDING -> COMPLETED atomic check.
        await webhookProcessingService.handleCheckoutSessionCompleted(session)
      } else if (session.status === 'expired') {
        await prismaConfig.prisma.paymentAttempt.updateMany({
          where: { id: attempt.id, status: PaymentAttemptStatus.PENDING },
          data: { status: PaymentAttemptStatus.EXPIRED },
        })
      } else {
        // Still open, still unpaid — genuinely still pending, not stuck.
        // Left alone; next run checks again.
        console.log(`Reconciliation: attempt ${attempt.id} still open, no action`)
      }
    } catch (err) {
      // One attempt's Stripe call failing shouldn't stop the batch —
      // log and move on, this run's failures get caught on the next pass.
      console.error(`Reconciliation failed for attempt ${attempt.id}:`, err.message)
    }
  }
}