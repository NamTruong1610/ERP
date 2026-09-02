import * as prismaConfig from '../config/prisma.config.js';
import { WebhookEventStatus } from '@prisma/client';
export const createWebhookEvent = async (data, client = prismaConfig.prisma) => {
  return client.webhookEvent.create({ data })
}

export const findWebhookEventById = async (id, client = prismaConfig.prisma) => {
  return client.webhookEvent.findUnique({ where: { id } })
}

export const markWebhookEventProcessing = async (id, client = prismaConfig.prisma) => {
  return client.webhookEvent.update({
    where: { id },
    data: { status: WebhookEventStatus.PROCESSING },
  })
}

export const markWebhookEventProcessed = async (id, client = prismaConfig.prisma) => {
  return client.webhookEvent.update({
    where: { id },
    data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() },
  })
}

export const markWebhookEventFailed = async (id, errorMessage, client = prismaConfig.prisma) => {
  return client.webhookEvent.update({
    where: { id },
    data: {
      status: WebhookEventStatus.FAILED,
      retryCount: { increment: 1 },
    },
  })
}