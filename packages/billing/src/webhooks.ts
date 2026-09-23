import { stripe, constructWebhookEvent } from './client';
import { pricing } from '@threadsight/billing/pricing';
import { invoicing } from '@threadsight/billing/invoicing';
import { logger } from '@threadsight/core/logging';
import { prisma } from '@threadsight/db/client';
import { Decimal } from 'decimal.js';

export async function handleStripeWebhook(payload: string | Buffer, signature: string) {
  const event = await constructWebhookEvent(payload, signature);
  logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as any);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as any);
      break;
    case 'charge.refunded':
      await handleRefunded(event.data.object as any);
      break;
    case 'customer.created':
    case 'customer.updated':
    case 'customer.deleted':
      logger.info({ customerId: event.data.object.id }, 'Customer event');
      break;
  }
}

async function handlePaymentSucceeded(paymentIntent: any) {
  const bookingId = paymentIntent.metadata?.bookingId;
  const invoiceId = paymentIntent.metadata?.invoiceId;
  const customerId = paymentIntent.metadata?.customerId;

  if (!customerId) {
    logger.warn({ paymentIntentId: paymentIntent.id }, 'No customerId in metadata');
    return;
  }

  const payment = await prisma.payment.findFirst({
    where: { providerPaymentId: paymentIntent.id },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
        processedAt: new Date(),
        providerPaymentId: paymentIntent.id,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        paymentNumber: `PAY-${Date.now()}`,
        customerId,
        bookingId,
        invoiceId,
        amount: new Decimal(paymentIntent.amount / 100),
        currency: paymentIntent.currency.toUpperCase(),
        status: 'SUCCEEDED',
        method: 'CARD',
        provider: 'stripe',
        providerPaymentId: paymentIntent.id,
        description: paymentIntent.description ?? undefined,
        metadata: paymentIntent.metadata,
        processedAt: new Date(),
      },
    });
  }

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (invoice) {
      const newPaidAmount = new Decimal(invoice.paidAmount).plus(paymentIntent.amount / 100);
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newPaidAmount.gte(invoice.totalAmount) ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: newPaidAmount.gte(invoice.totalAmount) ? new Date() : null,
        },
      });
    }
  }

  logger.info({ bookingId, invoiceId, amount: paymentIntent.amount }, 'Payment succeeded');
}

async function handlePaymentFailed(paymentIntent: any) {
  const payment = await prisma.payment.findFirst({
    where: { providerPaymentId: paymentIntent.id },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', metadata: paymentIntent.metadata },
    });
  }

  logger.warn({ paymentIntentId: paymentIntent.id, error: paymentIntent.last_payment_error }, 'Payment failed');
}

async function handleRefunded(charge: any) {
  const paymentIntentId = charge.payment_intent;
  const payment = await prisma.payment.findFirst({
    where: { providerPaymentId: paymentIntentId },
  });

  if (payment) {
    const refundAmount = new Decimal(charge.amount_refunded / 100);
    const newRefundedAmount = new Decimal(payment.metadata?.refundedAmount ?? 0).plus(refundAmount);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: refundAmount.eq(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAt: new Date(),
        metadata: { ...payment.metadata, refundedAmount: newRefundedAmount.toString() },
      },
    });

    if (payment.invoiceId) {
      const invoice = await prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice) {
        const newPaidAmount = new Decimal(invoice.paidAmount).minus(refundAmount);
        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            paidAmount: newPaidAmount.max(0),
            status: newPaidAmount.eq(0) ? 'ISSUED' : 'PARTIALLY_PAID',
          },
        });
      }
    }
  }

  logger.info({ paymentIntentId, refunded: charge.amount_refunded }, 'Refund processed');
}