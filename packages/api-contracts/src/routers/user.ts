import { z } from 'zod';
import { ulidSchema, emailSchema, phoneSchema, paginationSchema } from '@threadsight/core/validation';

export const userRouter = {
  getUsers: {
    input: z.object({
      pagination: paginationSchema,
      role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'MANAGER']).optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
      search: z.string().optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        email: z.string(),
        name: z.string().nullable(),
        phone: z.string().nullable(),
        role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'MANAGER']),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
        emailVerified: z.date().nullable(),
        createdAt: z.date(),
        customer: z.object({ id: ulidSchema, loyaltyPoints: z.number().int(), isBlacklisted: z.boolean() }).nullable(),
        staff: z.object({ id: ulidSchema, employeeId: z.string(), department: z.string().nullable() }).nullable(),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  getUser: {
    input: z.object({ id: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      email: z.string(),
      name: z.string().nullable(),
      phone: z.string().nullable(),
      role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'MANAGER']),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
      emailVerified: z.date().nullable(),
      createdAt: z.date(),
      customer: z.object({
        id: ulidSchema,
        licenseNumber: z.string().nullable(),
        licenseExpiry: z.date().nullable(),
        creditLimit: z.string(),
        loyaltyPoints: z.number().int(),
        isBlacklisted: z.boolean(),
      }).nullable(),
      staff: z.object({
        id: ulidSchema,
        employeeId: z.string(),
        department: z.string().nullable(),
        hireDate: z.date(),
        permissions: z.unknown().nullable(),
      }).nullable(),
    }).nullable(),
  },

  createUser: {
    input: z.object({
      email: emailSchema,
      password: z.string().min(8).optional(),
      name: z.string().optional(),
      phone: phoneSchema.optional(),
      role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'MANAGER']).default('CUSTOMER'),
    }),
    output: z.object({ id: ulidSchema }),
  },

  updateUser: {
    input: z.object({
      id: ulidSchema,
      data: z.object({
        name: z.string().optional(),
        phone: phoneSchema.optional(),
        role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN', 'MANAGER']).optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
      }),
    }),
    output: z.object({ success: z.boolean() }),
  },

  updatePassword: {
    input: z.object({
      id: ulidSchema,
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }),
    output: z.object({ success: z.boolean() }),
  },

  deleteUser: {
    input: z.object({ id: ulidSchema }),
    output: z.object({ success: z.boolean() }),
  },

  getCustomerProfile: {
    input: z.object({ userId: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      licenseNumber: z.string().nullable(),
      licenseExpiry: z.date().nullable(),
      dateOfBirth: z.date().nullable(),
      address: z.unknown().nullable(),
      emergencyContact: z.unknown().nullable(),
      creditLimit: z.string(),
      loyaltyPoints: z.number().int(),
      isBlacklisted: z.boolean(),
      blacklistReason: z.string().nullable(),
      user: z.object({ id: ulidSchema, name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }),
      bookings: z.array(z.object({
        id: ulidSchema,
        bookingNumber: z.string(),
        status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']),
        startDate: z.date(),
        endDate: z.date(),
        totalAmount: z.string(),
        vehicle: z.object({ make: z.string(), model: z.string(), licensePlate: z.string() }),
      })),
    }).nullable(),
  },

  updateCustomerProfile: {
    input: z.object({
      userId: ulidSchema,
      data: z.object({
        licenseNumber: z.string().optional(),
        licenseExpiry: z.date().optional(),
        dateOfBirth: z.date().optional(),
        address: z.unknown().optional(),
        emergencyContact: z.unknown().optional(),
      }),
    }),
    output: z.object({ success: z.boolean() }),
  },

  getStaffProfile: {
    input: z.object({ userId: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      employeeId: z.string(),
      department: z.string().nullable(),
      hireDate: z.date(),
      permissions: z.unknown().nullable(),
      user: z.object({ id: ulidSchema, name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }),
    }).nullable(),
  },

  getNotifications: {
    input: z.object({
      pagination: paginationSchema,
      unreadOnly: z.boolean().optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        type: z.enum(['BOOKING_CONFIRMED', 'BOOKING_REMINDER', 'BOOKING_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PICKUP_REMINDER', 'RETURN_REMINDER', 'MAINTENANCE_DUE', 'DAMAGE_REPORTED', 'INVOICE_ISSUED', 'REVIEW_REQUEST', 'SYSTEM_ALERT']),
        title: z.string(),
        message: z.string(),
        data: z.unknown().nullable(),
        readAt: z.date().nullable(),
        createdAt: z.date(),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  markNotificationRead: {
    input: z.object({ id: ulidSchema }),
    output: z.object({ success: z.boolean() }),
  },

  markAllNotificationsRead: {
    input: z.object({}).optional(),
    output: z.object({ success: z.boolean(), count: z.number().int() }),
  },
} as const;

export type UserRouter = typeof userRouter;