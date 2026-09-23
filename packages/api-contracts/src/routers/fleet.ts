import { z } from 'zod';
import { idSchema, ulidSchema, emailSchema, phoneSchema, decimalSchema, dateSchema, dateTimeSchema, paginationSchema } from '@threadsight/core/validation';

export const fleetRouter = {
  getCategories: {
    input: z.object({}).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      name: z.string(),
      description: z.string().nullable(),
      dailyRate: decimalSchema,
      weeklyRate: decimalSchema,
      monthlyRate: decimalSchema,
      deposit: decimalSchema,
      imageUrl: z.string().nullable(),
      sortOrder: z.number().int(),
      isActive: z.boolean(),
      _count: z.object({ vehicles: z.number().int() }).optional(),
    })),
  },

  getVehicles: {
    input: z.object({
      pagination: paginationSchema,
      categoryId: ulidSchema.optional(),
      locationId: ulidSchema.optional(),
      status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED']).optional(),
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        categoryId: ulidSchema,
        licensePlate: z.string(),
        vin: z.string(),
        make: z.string(),
        model: z.string(),
        year: z.number().int(),
        color: z.string(),
        fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']),
        transmission: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']),
        mileage: z.number().int(),
        status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED']),
        locationId: z.string().nullable(),
        category: z.object({ id: ulidSchema, name: z.string() }),
        location: z.object({ id: ulidSchema, name: z.string() }).nullable(),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  getVehicle: {
    input: z.object({ id: ulidSchema }),
    output: z.object({
      id: ulidSchema,
      categoryId: ulidSchema,
      licensePlate: z.string(),
      vin: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      color: z.string(),
      fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']),
      transmission: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']),
      mileage: z.number().int(),
      status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED']),
      locationId: z.string().nullable(),
      purchaseDate: z.date().nullable(),
      purchasePrice: z.string().nullable(),
      insuranceExpiry: z.date().nullable(),
      registrationExpiry: z.date().nullable(),
      lastServiceDate: z.date().nullable(),
      lastServiceMileage: z.number().int().nullable(),
      notes: z.string().nullable(),
      category: z.object({ id: ulidSchema, name: z.string(), dailyRate: decimalSchema }),
      location: z.object({ id: ulidSchema, name: z.string() }).nullable(),
      maintenanceLogs: z.array(z.object({
        id: ulidSchema,
        type: z.enum(['ROUTINE', 'REPAIR', 'INSPECTION', 'CLEANING', 'TIRE_CHANGE', 'OIL_CHANGE', 'BATTERY', 'OTHER']),
        description: z.string(),
        cost: decimalSchema,
        mileage: z.number().int(),
        startedAt: z.date(),
        completedAt: z.date().nullable(),
      })),
      inspections: z.array(z.object({
        id: ulidSchema,
        type: z.enum(['PRE_RENTAL', 'POST_RENTAL', 'DAMAGE_ASSESSMENT', 'ROUTINE']),
        status: z.enum(['PENDING', 'COMPLETED', 'DISPUTED']),
        notes: z.string().nullable(),
        photos: z.array(z.string()),
        createdAt: z.date(),
      })),
    }).nullable(),
  },

  createVehicle: {
    input: z.object({
      categoryId: ulidSchema,
      licensePlate: z.string().min(1).max(20),
      vin: z.string().min(17).max(17),
      make: z.string().min(1).max(50),
      model: z.string().min(1).max(50),
      year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
      color: z.string().min(1).max(30),
      fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']),
      transmission: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']),
      mileage: z.number().int().nonnegative().default(0),
      locationId: ulidSchema.optional(),
      purchaseDate: z.date().optional(),
      purchasePrice: decimalSchema.optional(),
      insuranceExpiry: z.date().optional(),
      registrationExpiry: z.date().optional(),
    }),
    output: z.object({ id: ulidSchema }),
  },

  updateVehicle: {
    input: z.object({
      id: ulidSchema,
      data: z.object({
        categoryId: ulidSchema.optional(),
        licensePlate: z.string().min(1).max(20).optional(),
        vin: z.string().min(17).max(17).optional(),
        make: z.string().min(1).max(50).optional(),
        model: z.string().min(1).max(50).optional(),
        year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
        color: z.string().min(1).max(30).optional(),
        fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']).optional(),
        transmission: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']).optional(),
        mileage: z.number().int().nonnegative().optional(),
        status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED']).optional(),
        locationId: ulidSchema.optional(),
        purchaseDate: z.date().optional(),
        purchasePrice: decimalSchema.optional(),
        insuranceExpiry: z.date().optional(),
        registrationExpiry: z.date().optional(),
        lastServiceDate: z.date().optional(),
        lastServiceMileage: z.number().int().nonnegative().optional(),
        notes: z.string().optional(),
      }),
    }),
    output: z.object({ success: z.boolean() }),
  },

  deleteVehicle: {
    input: z.object({ id: ulidSchema }),
    output: z.object({ success: z.boolean() }),
  },

  getLocations: {
    input: z.object({}).optional(),
    output: z.array(z.object({
      id: ulidSchema,
      name: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string().nullable(),
      country: z.string(),
      lat: z.number(),
      lng: z.number(),
      isActive: z.boolean(),
    })),
  },

  createLocation: {
    input: z.object({
      name: z.string().min(1).max(100),
      address: z.string().min(1).max(200),
      city: z.string().min(1).max(100),
      state: z.string().max(100).optional(),
      country: z.string().min(2).max(2),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    output: z.object({ id: ulidSchema }),
  },

  updateLocation: {
    input: z.object({
      id: ulidSchema,
      data: z.object({
        name: z.string().min(1).max(100).optional(),
        address: z.string().min(1).max(200).optional(),
        city: z.string().min(1).max(100).optional(),
        state: z.string().max(100).optional(),
        country: z.string().min(2).max(2).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        isActive: z.boolean().optional(),
      }),
    }),
    output: z.object({ success: z.boolean() }),
  },

  getMaintenanceLogs: {
    input: z.object({
      vehicleId: ulidSchema,
      pagination: paginationSchema,
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        vehicleId: ulidSchema,
        type: z.enum(['ROUTINE', 'REPAIR', 'INSPECTION', 'CLEANING', 'TIRE_CHANGE', 'OIL_CHANGE', 'BATTERY', 'OTHER']),
        description: z.string(),
        cost: decimalSchema,
        mileage: z.number().int(),
        startedAt: z.date(),
        completedAt: z.date().nullable(),
        nextServiceDate: z.date().nullable(),
        nextServiceMileage: z.number().int().nullable(),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  createMaintenanceLog: {
    input: z.object({
      vehicleId: ulidSchema,
      staffId: ulidSchema.optional(),
      type: z.enum(['ROUTINE', 'REPAIR', 'INSPECTION', 'CLEANING', 'TIRE_CHANGE', 'OIL_CHANGE', 'BATTERY', 'OTHER']),
      description: z.string().min(1),
      cost: decimalSchema,
      mileage: z.number().int().nonnegative(),
      startedAt: z.date(),
      completedAt: z.date().optional(),
      nextServiceDate: z.date().optional(),
      nextServiceMileage: z.number().int().nonnegative().optional(),
    }),
    output: z.object({ id: ulidSchema }),
  },

  getUpcomingMaintenance: {
    input: z.object({ days: z.number().int().positive().default(30) }),
    output: z.array(z.object({
      id: ulidSchema,
      vehicleId: ulidSchema,
      vehicle: z.object({ id: ulidSchema, licensePlate: z.string(), make: z.string(), model: z.string() }),
      nextServiceDate: z.date().nullable(),
      nextServiceMileage: z.number().int().nullable(),
    })),
  },

  getInspections: {
    input: z.object({
      vehicleId: ulidSchema.optional(),
      bookingId: ulidSchema.optional(),
      pagination: paginationSchema,
    }),
    output: z.object({
      items: z.array(z.object({
        id: ulidSchema,
        vehicleId: ulidSchema,
        type: z.enum(['PRE_RENTAL', 'POST_RENTAL', 'DAMAGE_ASSESSMENT', 'ROUTINE']),
        status: z.enum(['PENDING', 'COMPLETED', 'DISPUTED']),
        notes: z.string().nullable(),
        photos: z.array(z.string()),
        createdAt: z.date(),
      })),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  },

  createInspection: {
    input: z.object({
      vehicleId: ulidSchema,
      staffId: ulidSchema,
      bookingId: ulidSchema.optional(),
      type: z.enum(['PRE_RENTAL', 'POST_RENTAL', 'DAMAGE_ASSESSMENT', 'ROUTINE']),
      notes: z.string().optional(),
      photos: z.array(z.string()).default([]),
    }),
    output: z.object({ id: ulidSchema }),
  },

  updateInspection: {
    input: z.object({
      id: ulidSchema,
      data: z.object({
        status: z.enum(['PENDING', 'COMPLETED', 'DISPUTED']).optional(),
        notes: z.string().optional(),
        photos: z.array(z.string()).optional(),
        signature: z.string().optional(),
      }),
    }),
    output: z.object({ success: z.boolean() }),
  },
} as const;

export type FleetRouter = typeof fleetRouter;