import * as stripeConfig from '../../config/stripe.config.js';
import * as appError from '../AppError.js';
import * as paymentAttemptService from '../../services/paymentAttempt.service.js';
import * as paymentAttemptRepository from '../../repositories/paymentAttempt.repository.js';
import * as invoiceItemRepository from '../../repositories/invoiceItem.repository.js';
export const createCheckoutSessionService = async ({ invoiceId, itemPayments }, actor) => {
  const { paymentAttempt, invoice } = await paymentAttemptService.createPaymentAttemptService({ invoiceId, itemPayments }, actor)

  // itemPayments is stored as [invoiceItemId, amount] pairs — pull item descriptions so each Stripe line item can show what it's actually for.
  const itemPaymentsArray = paymentAttempt.itemPayments
  const invoiceItems = await invoiceItemRepository.findInvoiceItemsByIds(itemPaymentsArray.map(([invoiceItemId]) => invoiceItemId))
  const descriptionsById = new Map(invoiceItems.map(item => [item.id, item.description]))

  const line_items = itemPaymentsArray.map(([invoiceItemId, itemAmount]) => ({
    price_data: {
      currency: 'aud',
      unit_amount: Math.round(itemAmount * 100),
      product_data: {
        name: descriptionsById.get(invoiceItemId) ?? 'Invoice item',
      },
    },
    quantity: 1,
  }))

  let session
  try {
    session = await stripeConfig.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      metadata: { paymentAttemptId: paymentAttempt.id },
      success_url: `${process.env.CLIENT_URL}/pay/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/pay/cancelled`,
    }, {
      idempotencyKey: paymentAttempt.idempotencyKey,
    })
  } catch (err) {
    await paymentAttemptRepository.markPaymentAttemptFailed(paymentAttempt.id, err.message)
    throw new appError.AppError('Failed to create Stripe checkout session', 502)
  }

  let updated
  try {
    updated = await paymentAttemptRepository.updatePaymentAttemptStripeIds(paymentAttempt.id, {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent ?? null,
      amount: session.amount_total / 100,
    })
  } catch (err) {
    console.error(`CRITICAL: Stripe session ${session.id} created but write-back failed for attempt ${paymentAttempt.id}`, err.message)
    throw err
  }

  return { paymentAttempt: updated, invoice, checkoutUrl: session.url }
}