import * as webhookRepository from '../repositories/webhook.repository.js';
import * as webhookQueue from '../queues/webhook.queue.js';
import { WebhookEventStatus } from '@prisma/client';
export const handleStripeWebhookService = async (event) => {
  let webhookEvent
  try {
    webhookEvent = await webhookRepository.createWebhookEvent({
      provider: 'stripe',
      externalEventId: event.id,
      eventType: event.type,
      payload: event,
      status: WebhookEventStatus.RECEIVED,
    })
  } catch (err) {
    if (err.code === 'P2002') {
      // Unique constraint on [provider, externalEventId] — Stripe redelivering
      // an event we've already recorded. Ack quietly, don't re-enqueue.
      return
    }
    throw err
  }

  await webhookQueue.enqueueWebhookEvent({ webhookEventId: webhookEvent.id })
}