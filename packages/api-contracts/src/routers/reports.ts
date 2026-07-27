import { z } from 'zod';
import { ulidSchema, decimalSchema, dateSchema, paginationSchema } from '@car-rental/core/validation';

export const reportRouter = {
  getDashboardStats: {
    input: z.object({}).optional(),
    output: z.object({
      fleet: z.object({
        total: z.number().int(),
        available: z.number().int(),
        rented: z.number().int(),
        maintenance: z.number().int(),
        outOfService: z.number().int(),
      }),
      bookings: z.object({
        today: z.object({ pickups: z.number().int(), returns: z.number().int(), active: z.number().int() }),
        upcoming: z.object({ pickups: z.number().int(), returns: z.number().int() }),
        overdue: z.number().int(),
      }),
      revenue: z.object({
        today: decimalSchema,
        thisMonth: decimalSchema,
        pending: decimalSchema,
        overdue: decimalSchema,
      }),
      customers: z.object({
        total: z.number().int(),
        newThisMonth: z.number().int(),
        blacklisted: z.number().int(),
      }),
      alerts: z.array(z.object({
        type: z.enum(['MAINTENANCE_DUE', 'INSURANCE_EXPIRY', 'REGISTRATION_EXPIRY', 'OVERDUE_RETURN', 'PAYMENT_FAILED', 'DISPUTE']),
        count: z.number().int(),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      })),
    }),
  },

  getFleetUtilization: {
    input: z.object({
      startDate: dateSchema,
      endDate: dateSchema,
    }),
    output: z.object({
      overall: z.object({
        totalDays: z.number().int(),
        rentedDays: z.number().int(),
        utilizationRate: z.number(),
      }),
      byCategory: z.array(z.object({
        categoryId: ulidSchema,
        categoryName: z.string(),
        totalVehicles: z.number().int(),
        totalDays: z.number().int(),
        rentedDays: z.number().int(),
        utilizationRate: z.number(),
        revenue: decimalSchema,
      })),
      byVehicle: z.array(z.object({
        vehicleId: ulidSchema,
        licensePlate: z.string(),
        make: z.string(),
        model: z.string(),
        daysRented: z.number().int(),
        revenue: decimalSchema,
      })),
    }),
  },

  getRevenueReport: {
    input: z.object({
      startDate: dateSchema,
      endDate: dateSchema,
      groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).default('DAY'),
    }),
    output: z.object({
      total: decimalSchema,
      byPeriod: z.array(z.object({
        period: z.string(),
        rentalRevenue: decimalSchema,
        extraRevenue: decimalSchema,
        depositRevenue: decimalSchema,
        refunds: decimalSchema,
        netRevenue: decimalSchema,
        bookingsCount: z.number().int(),
      })),
      byCategory: z.array(z.object({
        categoryId: ulidSchema,
        categoryName: z.string(),
        revenue: decimalSchema,
        bookingsCount: z.number().int(),
      })),
      byExtra: z.array(z.object({
        extraId: ulidSchema,
        extraName: z.string(),
        revenue: decimalSchema,
        count: z.number().int(),
      })),
    }),
  },

  getCustomerLTV: {
    input: z.object({
      pagination: paginationSchema,
      minLTV: decimalSchema.optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        customerId: ulidSchema,
        user: z.object({ name: z.string().nullable(), email: z.string() }),
        totalBookings: z.number().int(),
        totalSpent: decimalSchema,
        avgBookingValue: decimalSchema,
        firstBookingDate: z.date(),
        lastBookingDate: z.date(),
        loyaltyPoints: z.number().int(),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  getMaintenanceCosts: {
    input: z.object({
      startDate: dateSchema,
      endDate: dateSchema,
    }),
    output: z.object({
      totalCost: decimalSchema,
      byType: z.array(z.object({
        type: z.enum(['ROUTINE', 'REPAIR', 'INSPECTION', 'CLEANING', 'TIRE_CHANGE', 'OIL_CHANGE', 'BATTERY', 'OTHER']),
        count: z.number().int(),
        totalCost: decimalSchema,
      })),
      byVehicle: z.array(z.object({
        vehicleId: ulidSchema,
        licensePlate: z.string(),
        make: z.string(),
        model: z.string(),
        totalCost: decimalSchema,
        logCount: z.number().int(),
      })),
    }),
  },

  exportBookingsCsv: {
    input: z.object({
      startDate: dateSchema,
      endDate: dateSchema,
      status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']).optional(),
    }),
    output: z.object({ csv: z.string() }),
  },

  exportRevenueCsv: {
    input: z.object({
      startDate: dateSchema,
      endDate: dateSchema,
    }),
    output: z.object({ csv: z.string() }),
  },
} as const;

export type ReportRouter = typeof reportRouter;