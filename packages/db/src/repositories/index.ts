export * from './base';
export * from './fleet';
export * from './users';
export * from './booking';
export * from './billing';
export * from './supporting';

export const vehicleRepository = new (await import('./fleet')).VehicleRepository();
export const vehicleCategoryRepository = new (await import('./fleet')).VehicleCategoryRepository();
export const locationRepository = new (await import('./fleet')).LocationRepository();
export const maintenanceLogRepository = new (await import('./fleet')).MaintenanceLogRepository();
export const inspectionRepository = new (await import('./fleet')).InspectionRepository();

export const userRepository = new (await import('./users')).UserRepository();
export const customerRepository = new (await import('./users')).CustomerRepository();
export const staffRepository = new (await import('./users')).StaffRepository();

export const bookingRepository = new (await import('./booking')).BookingRepository();
export const extraRepository = new (await import('./booking')).ExtraRepository();

export const invoiceRepository = new (await import('./billing')).InvoiceRepository();
export const paymentRepository = new (await import('./billing')).PaymentRepository();

export const documentRepository = new (await import('./supporting')).DocumentRepository();
export const notificationRepository = new (await import('./supporting')).NotificationRepository();
export const auditLogRepository = new (await import('./supporting')).AuditLogRepository();
export const settingRepository = new (await import('./supporting')).SettingRepository();