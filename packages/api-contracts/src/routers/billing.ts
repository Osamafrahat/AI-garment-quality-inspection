import { z } from 'zod';
import { ulidSchema, decimalSchema, dateSchema, dateTimeSchema, paginationSchema } from '@car-rental/core/validation';

export const billingRouter = {
  getInvoices: {
    input: z.object({
      pagination: paginationSchema,
      status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
      customerId: ulidSchema.optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        invoiceNumber: z.string(),
        status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
        subtotal: decimalSchema,
        taxAmount: decimalSchema,
        totalAmount: decimalSchema,
        paidAmount: decimalSchema,
        dueDate: z.date(),
        issuedAt: z.date().nullable(),
        paidAt: z.date().nullable(),
        customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string() }) }),
        booking: z.object({ id: ulidSchema, bookingNumber: z.string(), vehicle: z.object({ make: z.string(), model: z.string() }) }).nullable(),
        lineItems: z.array(z.object({ description: z.string(), quantity: z.number().int(), unitPrice: decimalSchema, totalPrice: decimalSchema, type: z.enum(['RENTAL', 'EXTRA', 'DEPOSIT', 'FEE', 'TAX', 'DISCOUNT', 'REFUND']) })),
        payments: z.array(z.object({ amount: decimalSchema, status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']), method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']), processedAt: z.date().nullable() })),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  getInvoice: {
    input: z.object({ id: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      invoiceNumber: z.string(),
      status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
      subtotal: decimalSchema,
      taxAmount: decimalSchema,
      totalAmount: decimalSchema,
      paidAmount: decimalSchema,
      dueDate: z.date(),
      issuedAt: z.date().nullable(),
      paidAt: z.date().nullable(),
      cancelledAt: z.date().nullable(),
      pdfUrl: z.string().nullable(),
      customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string(), phone: z.string().nullable(), address: z.unknown() }) }),
      booking: z.object({ id: ulidSchema, bookingNumber: z.string(), vehicle: z.object({ make: z.string(), model: z.string(), licensePlate: z.string() }) }).nullable(),
      lineItems: z.array(z.object({ id: ulidSchema, description: z.string(), quantity: z.number().int(), unitPrice: decimalSchema, totalPrice: decimalSchema, type: z.enum(['RENTAL', 'EXTRA', 'DEPOSIT', 'FEE', 'TAX', 'DISCOUNT', 'REFUND']), metadata: z.unknown() })),
      payments: z.array(z.object({ id: ulidSchema, amount: decimalSchema, status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']), method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']), provider: z.string(), providerPaymentId: z.string().nullable(), processedAt: z.date().nullable() })),
    }).nullable(),
  },

  createInvoice: {
    input: z.object({
      bookingId: ulidSchema,
      dueDate: dateSchema,
      lineItems: z.array(z.object({
        description: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: decimalSchema,
        type: z.enum(['RENTAL', 'EXTRA', 'DEPOSIT', 'FEE', 'TAX', 'DISCOUNT', 'REFUND']),
        metadata: z.unknown().optional(),
      })),
    }),
    output: z.object({ id: ulidSchema, invoiceNumber: z.string() }),
  },

  issueInvoice: {
    input: z.object({ id: ulidSchema }),
    output: z.object({ success: z.boolean() }),
  },

  cancelInvoice: {
    input: z.object({ id: ulidSchema }),
    output: z.object({ success: z.boolean() }),
  },

  generatePdf: {
    input: z.object({ id: ulidSchema }),
    output: z.object({ pdfUrl: z.string() }),
  },

  getPayments: {
    input: z.object({
      pagination: paginationSchema,
      status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']).optional(),
      customerId: ulidSchema.optional(),
      bookingId: ulidSchema.optional(),
      invoiceId: ulidSchema.optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        paymentNumber: z.string(),
        amount: decimalSchema,
        currency: z.string(),
        status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']),
        method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']),
        provider: z.string(),
        providerPaymentId: z.string().nullable(),
        description: z.string().nullable(),
        processedAt: z.date().nullable(),
        booking: z.object({ id: ulidSchema, bookingNumber: z.string() }).nullable(),
        invoice: z.object({ id: ulidSchema, invoiceNumber: z.string() }).nullable(),
        customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string() }) }),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  getPayment: {
    input: z.object({ id: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      paymentNumber: z.string(),
      amount: decimalSchema,
      currency: z.string(),
      status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']),
      method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']),
      provider: z.string(),
      providerPaymentId: z.string().nullable(),
      description: z.string().nullable(),
      processedAt: z.date().nullable(),
      refundedAt: z.date().nullable(),
      booking: z.object({ id: ulidSchema, bookingNumber: z.string() }).nullable(),
      invoice: z.object({ id: ulidSchema, invoiceNumber: z.string() }).nullable(),
      customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string() }) }),
    }).nullable(),
  },

  createPayment: {
    input: z.object({
      bookingId: ulidSchema.optional(),
      invoiceId: ulidSchema.optional(),
      customerId: ulidSchema,
      amount: decimalSchema,
      currency: z.string().default('USD'),
      method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']),
      provider: z.string().default('stripe'),
      providerPaymentId: z.string().optional(),
      description: z.string().optional(),
    }),
    output: z.object({ id: ulidSchema, paymentNumber: z.string(), clientSecret: z.string().optional() }),
  },

  processRefund: {
    input: z.object({
      paymentId: ulidSchema,
      amount: decimalSchema.optional(),
      reason: z.string().optional(),
    }),
    output: z.object({ success: z.boolean(), refundId: z.string() }),
  },

  getOverdueInvoices: {
    input: z.object({}).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      invoiceNumber: z.string(),
      totalAmount: decimalSchema,
      paidAmount: decimalSchema,
      dueDate: z.date(),
      customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string() }) }),
    })),
  },

  getRevenueStats: {
    input: z.object({
      startDate: dateSchema,
      endDate: dateSchema,
    }),
    output: z.object({
      totalRevenue: decimalSchema,
      paidInvoices: z.number().int(),
      pendingInvoices: z.number().int(),
      overdueInvoices: z.number().int(),
      byMonth: z.array(z.object({ month: z.string(), revenue: decimalSchema, count: z.number().int() })),
    }),
  },
} as const;

export type BillingRouter = typeof billingRouter;