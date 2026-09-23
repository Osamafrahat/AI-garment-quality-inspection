import { z } from 'zod';
import { ulidSchema, emailSchema, phoneSchema, decimalSchema, dateSchema, dateTimeSchema, paginationSchema } from '@threadsight/core/validation';

export const bookingRouter = {
  getBookings: {
    input: z.object({
      pagination: paginationSchema,
      status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']).optional(),
      customerId: ulidSchema.optional(),
      vehicleId: ulidSchema.optional(),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        bookingNumber: z.string(),
        status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']),
        startDate: z.date(),
        endDate: z.date(),
        actualStartDate: z.date().nullable(),
        actualEndDate: z.date().nullable(),
        dailyRate: decimalSchema,
        totalDays: z.number().int(),
        subtotal: decimalSchema,
        taxAmount: decimalSchema,
        discountAmount: decimalSchema,
        totalAmount: decimalSchema,
        depositAmount: decimalSchema,
        depositRefunded: decimalSchema,
        customer: z.object({
          id: ulidSchema,
          user: z.object({ id: ulidSchema, name: z.string().nullable(), email: z.string() }),
        }),
        vehicle: z.object({
          id: ulidSchema,
          licensePlate: z.string(),
          make: z.string(),
          model: z.string(),
          category: z.object({ id: ulidSchema, name: z.string() }),
        }),
        pickupLocation: z.object({ id: ulidSchema, name: z.string() }),
        returnLocation: z.object({ id: ulidSchema, name: z.string() }),
        extras: z.array(z.object({
          id: ulidSchema,
          quantity: z.number().int(),
          unitPrice: decimalSchema,
          totalPrice: decimalSchema,
          extra: z.object({ id: ulidSchema, name: z.string(), dailyRate: decimalSchema }),
        })),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  getBooking: {
    input: z.object({ id: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      bookingNumber: z.string(),
      status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']),
      startDate: z.date(),
      endDate: z.date(),
      actualStartDate: z.date().nullable(),
      actualEndDate: z.date().nullable(),
      dailyRate: decimalSchema,
      totalDays: z.number().int(),
      subtotal: decimalSchema,
      taxAmount: decimalSchema,
      discountAmount: decimalSchema,
      totalAmount: decimalSchema,
      depositAmount: decimalSchema,
      depositRefunded: decimalSchema,
      cancellationReason: z.string().nullable(),
      cancelledAt: z.date().nullable(),
      cancelledBy: z.string().nullable(),
      notes: z.string().nullable(),
      customer: z.object({
        id: ulidSchema,
        licenseNumber: z.string().nullable(),
        creditLimit: decimalSchema,
        loyaltyPoints: z.number().int(),
        user: z.object({ id: ulidSchema, name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }),
      }),
      vehicle: z.object({
        id: ulidSchema,
        licensePlate: z.string(),
        vin: z.string(),
        make: z.string(),
        model: z.string(),
        year: z.number().int(),
        color: z.string(),
        fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']),
        transmission: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']),
        mileage: z.number().int(),
        category: z.object({ id: ulidSchema, name: z.string() }),
        location: z.object({ id: ulidSchema, name: z.string() }).nullable(),
      }),
      pickupLocation: z.object({ id: ulidSchema, name: z.string(), address: z.string() }),
      returnLocation: z.object({ id: ulidSchema, name: z.string(), address: z.string() }),
      extras: z.array(z.object({
        id: ulidSchema,
        quantity: z.number().int(),
        unitPrice: decimalSchema,
        totalPrice: decimalSchema,
        extra: z.object({ id: ulidSchema, name: z.string(), description: z.string().nullable(), dailyRate: decimalSchema, category: z.enum(['INSURANCE', 'EQUIPMENT', 'SERVICE', 'FUEL', 'OTHER']) }),
      })),
      payments: z.array(z.object({
        id: ulidSchema,
        paymentNumber: z.string(),
        amount: decimalSchema,
        status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']),
        method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']),
        provider: z.string(),
        providerPaymentId: z.string().nullable(),
        processedAt: z.date().nullable(),
      })),
      invoices: z.array(z.object({
        id: ulidSchema,
        invoiceNumber: z.string(),
        status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
        totalAmount: decimalSchema,
        paidAmount: decimalSchema,
        dueDate: z.date(),
        pdfUrl: z.string().nullable(),
      })),
      inspections: z.array(z.object({
        id: ulidSchema,
        type: z.enum(['PRE_RENTAL', 'POST_RENTAL', 'DAMAGE_ASSESSMENT', 'ROUTINE']),
        status: z.enum(['PENDING', 'COMPLETED', 'DISPUTED']),
        notes: z.string().nullable(),
        photos: z.array(z.string()),
        createdAt: z.date(),
        staff: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable() }) }),
      })),
    }).nullable(),
  },

  createBooking: {
    input: z.object({
      customerId: ulidSchema,
      vehicleId: ulidSchema,
      pickupLocationId: ulidSchema,
      returnLocationId: ulidSchema,
      startDate: dateTimeSchema,
      endDate: dateTimeSchema,
      extras: z.array(z.object({
        extraId: ulidSchema,
        quantity: z.number().int().positive().default(1),
      })).default([]),
      notes: z.string().optional(),
    }),
    output: z.object({ id: ulidSchema, bookingNumber: z.string(), totalAmount: decimalSchema, depositAmount: decimalSchema }),
  },

  updateBooking: {
    input: z.object({
      id: ulidSchema,
      data: z.object({
        status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']).optional(),
        startDate: dateTimeSchema.optional(),
        endDate: dateTimeSchema.optional(),
        actualStartDate: dateTimeSchema.optional(),
        actualEndDate: dateTimeSchema.optional(),
        dailyRate: decimalSchema.optional(),
        discountAmount: decimalSchema.optional(),
        notes: z.string().optional(),
        cancellationReason: z.string().optional(),
      }),
    }),
    output: z.object({ success: z.boolean() }),
  },

  cancelBooking: {
    input: z.object({
      id: ulidSchema,
      reason: z.string().min(1),
      cancelledBy: ulidSchema,
    }),
    output: z.object({ success: z.boolean(), refundAmount: decimalSchema }),
  },

  checkAvailability: {
    input: z.object({
      vehicleId: ulidSchema,
      startDate: dateTimeSchema,
      endDate: dateTimeSchema,
      excludeBookingId: ulidSchema.optional(),
    }),
    output: z.object({ available: z.boolean() }),
  },

  getUpcomingPickups: {
    input: z.object({ days: z.number().int().positive().default(7) }).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      bookingNumber: z.string(),
      startDate: z.date(),
      customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }) }),
      vehicle: z.object({ id: ulidSchema, licensePlate: z.string(), make: z.string(), model: z.string() }),
      pickupLocation: z.object({ id: ulidSchema, name: z.string(), address: z.string() }),
    })),
  },

  getUpcomingReturns: {
    input: z.object({ days: z.number().int().positive().default(7) }).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      bookingNumber: z.string(),
      endDate: z.date(),
      customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }) }),
      vehicle: z.object({ id: ulidSchema, licensePlate: z.string(), make: z.string(), model: z.string() }),
      returnLocation: z.object({ id: ulidSchema, name: z.string(), address: z.string() }),
    })),
  },

  getOverdue: {
    input: z.object({}).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      bookingNumber: z.string(),
      endDate: z.date(),
      customer: z.object({ id: ulidSchema, user: z.object({ name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }) }),
      vehicle: z.object({ id: ulidSchema, licensePlate: z.string(), make: z.string(), model: z.string() }),
      returnLocation: z.object({ id: ulidSchema, name: z.string(), address: z.string() }),
    })),
  },

  getExtras: {
    input: z.object({}).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      name: z.string(),
      description: z.string().nullable(),
      dailyRate: decimalSchema,
      category: z.enum(['INSURANCE', 'EQUIPMENT', 'SERVICE', 'FUEL', 'OTHER']),
      isActive: z.boolean(),
    })),
  },

  createExtra: {
    input: z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      dailyRate: decimalSchema,
      category: z.enum(['INSURANCE', 'EQUIPMENT', 'SERVICE', 'FUEL', 'OTHER']),
    }),
    output: z.object({ id: ulidSchema }),
  },
} as const;

export type BookingRouter = typeof bookingRouter;