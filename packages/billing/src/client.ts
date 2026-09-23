import Stripe from 'stripe';
import { getEnv } from '@threadsight/core/config';
import { logger } from '@threadsight/core/logging';

const { STRIPE_SECRET_KEY } = getEnv();

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
  maxNetworkRetries: 3,
});

export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  automaticPaymentMethods?: { enabled: boolean; allowRedirects?: 'never' | 'always' };
}): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100),
    currency: params.currency.toLowerCase(),
    customer: params.customerId,
    metadata: params.metadata,
    automatic_payment_methods: params.automaticPaymentMethods ?? { enabled: true, allowRedirects: 'always' },
  });
}

export async function confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });
}

export async function createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined,
    reason: reason as Stripe.RefundCreateParams.Reason,
  });
}

export async function createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
  return stripe.customers.create({ email, name, metadata });
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer> {
  return stripe.customers.retrieve(customerId);
}

export async function attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
}

export async function listPaymentMethods(customerId: string, type: Stripe.PaymentMethodListParams.Type = 'card'): Promise<Stripe.PaymentMethod[]> {
  const methods = await stripe.paymentMethods.list({ customer: customerId, type });
  return methods.data;
}

export async function constructWebhookEvent(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
  const { STRIPE_WEBHOOK_SECRET } = getEnv();
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

export { Stripe };