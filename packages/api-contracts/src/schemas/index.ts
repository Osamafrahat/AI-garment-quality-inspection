import { z } from 'zod';
import { paginationSchema, idSchema, ulidSchema, emailSchema, phoneSchema, decimalSchema, dateSchema, dateTimeSchema } from '@car-rental/core/validation';

export const vehicleCategorySchema = z.object({
  id: ulidSchema.optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  dailyRate: decimalSchema,
  weeklyRate: decimalSchema,
  monthlyRate: decimalSchema,
  deposit: decimalSchema,
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const vehicleSchema = z.object({
  id: ulidSchema.optional(),
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
  status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED']).default('AVAILABLE'),
  locationId: ulidSchema.optional(),
  purchaseDate: dateSchema.optional(),
  purchasePrice: decimalSchema.optional(),
  insuranceExpiry: dateSchema.optional(),
  registrationExpiry: dateSchema.optional(),
  lastServiceDate: dateSchema.optional(),
  lastServiceMileage: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const locationSchema = z.object({
  id: ulidSchema.optional(),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(2).max(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isActive: z.boolean().default(true),
});

export const maintenanceLogSchema = z.object({
  id: ulidSchema.optional(),
  vehicleId: ulidSchema,
  staffId: ulidSchema.optional(),
  type: z.enum(['ROUTINE', 'REPAIR', 'INSPECTION', 'CLEANING', 'TIRE_CHANGE', 'OIL_CHANGE', 'BATTERY', 'OTHER']),
  description: z.string().min(1),
  cost: decimalSchema,
  mileage: z.number().int().nonnegative(),
  startedAt: dateTimeSchema,
  completedAt: dateTimeSchema.optional(),
  nextServiceDate: dateSchema.optional(),
  nextServiceMileage: z.number().int().nonnegative().optional(),
});

export const inspectionSchema = z.object({
  id: ulidSchema.optional(),
  vehicleId: ulidSchema,
  staffId: ulidSchema,
  bookingId: ulidSchema.optional(),
  type: z.enum(['PRE_RENTAL', 'POST_RENTAL', 'DAMAGE_ASSESSMENT', 'ROUTINE']),
  status: z.enum(['PENDING', 'COMPLETED', 'DISPUTED']).default('PENDING'),
  notes: z.string().optional(),
  photos: z.array(z.string()).default([]),
  signature: z.string().optional(),
});

export const extraSchema = z.object({
  id: ulidSchema.optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  dailyRate: decimalSchema,
  category: z.enum(['INSURANCE', 'EQUIPMENT', 'SERVICE', 'FUEL', 'OTHER']),
  isActive: z.boolean().default(true),
});

export const bookingSchema = z.object({
  id: ulidSchema.optional(),
  customerId: ulidSchema,
  vehicleId: ulidSchema,
  pickupLocationId: ulidSchema,
  returnLocationId: ulidSchema,
  startDate: dateTimeSchema,
  endDate: dateTimeSchema,
  dailyRate: decimalSchema,
  totalDays: z.number().int().positive(),
  subtotal: decimalSchema,
  taxAmount: decimalSchema,
  discountAmount: decimalSchema.default('0'),
  totalAmount: decimalSchema,
  depositAmount: decimalSchema,
  notes: z.string().optional(),
  extras: z.array(z.object({
    extraId: ulidSchema,
    quantity: z.number().int().positive().default(1),
  })).optional(),
});

export const bookingUpdateSchema = bookingSchema.partial().extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED']).optional(),
  actualStartDate: dateTimeSchema.optional(),
  actualEndDate: dateTimeSchema.optional(),
  cancellationReason: z.string().optional(),
  cancelledBy: ulidSchema.optional(),
});

export const invoiceSchema = z.object({
  id: ulidSchema.optional(),
  invoiceNumber: z.string().min(1),
  bookingId: ulidSchema,
  customerId: ulidSchema,
  subtotal: decimalSchema,
  taxAmount: decimalSchema,
  totalAmount: decimalSchema,
  dueDate: dateSchema,
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).default('DRAFT'),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: decimalSchema,
    totalPrice: decimalSchema,
    type: z.enum(['RENTAL', 'EXTRA', 'DEPOSIT', 'FEE', 'TAX', 'DISCOUNT', 'REFUND']),
    metadata: z.record(z.unknown()).optional(),
  })),
});

export const paymentSchema = z.object({
  id: ulidSchema.optional(),
  bookingId: ulidSchema.optional(),
  invoiceId: ulidSchema.optional(),
  customerId: ulidSchema,
  amount: decimalSchema,
  currency: z.string().length(3).default('USD'),
  method: z.enum(['CARD', 'CASH', 'BANK_TRANSFER', 'WALLET', 'OTHER']),
  provider: z.string().default('stripe'),
  providerPaymentId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const documentSchema = z.object({
  id: ulidSchema.optional(),
  entityType: z.enum(['CUSTOMER', 'VEHICLE', 'BOOKING', 'STAFF', 'INVOICE']),
  entityId: ulidSchema,
  type: z.enum(['ID_DOCUMENT', 'LICENSE', 'INSURANCE', 'REGISTRATION', 'INSPECTION_PHOTO', 'DAMAGE_PHOTO', 'CONTRACT', 'INVOICE_PDF', 'RECEIPT', 'OTHER']),
  name: z.string().min(1).max(255),
  url: z.string().min(1),
  mimeType: z.string(),
  size: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const notificationSchema = z.object({
  id: ulidSchema.optional(),
  userId: ulidSchema,
  type: z.enum([
    'BOOKING_CONFIRMED', 'BOOKING_REMINDER', 'BOOKING_CANCELLED',
    'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PICKUP_REMINDER',
    'RETURN_REMINDER', 'MAINTENANCE_DUE', 'DAMAGE_REPORTED',
    'INVOICE_ISSUED', 'REVIEW_REQUEST', 'SYSTEM_ALERT'
  ]),
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

export const paginationParamsSchema = paginationSchema;

export type VehicleCategoryInput = z.infer<typeof vehicleCategorySchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type MaintenanceLogInput = z.infer<typeof maintenanceLogSchema>;
export type InspectionInput = z.infer<typeof inspectionSchema>;
export type ExtraInput = z.infer<typeof extraSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type NotificationInput = z.infer<typeof notificationSchema>;
export type PaginationParams = z.infer<typeof paginationParamsSchema>;