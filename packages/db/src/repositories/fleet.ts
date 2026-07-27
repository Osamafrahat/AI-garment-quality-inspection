import { prisma } from '../client';
import { BaseRepository } from './base';
import { AppError } from '@car-rental/core/errors';
import { logger } from '@car-rental/core/logging';
import { paginationSchema, createPaginationResponse, type PaginationParams } from '@car-rental/core/validation';

export class VehicleRepository extends BaseRepository<any> {
  protected readonly modelName = 'Vehicle';
  protected readonly delegate = prisma.vehicle;

  async findAvailable(
    startDate: Date,
    endDate: Date,
    params: { categoryId?: string; locationId?: string; pagination: PaginationParams }
  ) {
    const bookedVehicleIds = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
      select: { vehicleId: true },
    });

    const excludedIds = bookedVehicleIds.map(b => b.vehicleId);

    const where: any = {
      status: 'AVAILABLE',
      id: { notIn: excludedIds },
    };

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.locationId) where.locationId = params.locationId;

    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: { category: true, location: true },
        orderBy: { category: { sortOrder: 'asc' } },
        skip: (params.pagination.page - 1) * params.pagination.limit,
        take: params.pagination.limit,
      }),
      this.delegate.count({ where }),
    ]);

    return createPaginationResponse(items, total, params.pagination);
  }

  async updateStatus(id: string, status: string) {
    return this.delegate.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async getWithDetails(id: string) {
    return this.delegate.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
        maintenanceLogs: { orderBy: { startedAt: 'desc' }, take: 5 },
        inspections: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }
}

export class VehicleCategoryRepository extends BaseRepository<any> {
  protected readonly modelName = 'VehicleCategory';
  protected readonly delegate = prisma.vehicleCategory;

  async findActive() {
    return this.delegate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { vehicles: true } } },
    });
  }
}

export class LocationRepository extends BaseRepository<any> {
  protected readonly modelName = 'Location';
  protected readonly delegate = prisma.location;

  async findActive() {
    return this.delegate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}

export class MaintenanceLogRepository extends BaseRepository<any> {
  protected readonly modelName = 'MaintenanceLog';
  protected readonly delegate = prisma.maintenanceLog;

  async findByVehicle(vehicleId: string) {
    return this.delegate.findMany({
      where: { vehicleId },
      orderBy: { startedAt: 'desc' },
      include: { staff: { include: { user: true } } },
    });
  }

  async findUpcoming(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.delegate.findMany({
      where: {
        OR: [
          { nextServiceDate: { lte: futureDate } },
          { nextServiceMileage: { not: null } },
        ],
      },
      include: { vehicle: { include: { category: true } }, staff: { include: { user: true } } },
      orderBy: { nextServiceDate: 'asc' },
    });
  }
}

export class InspectionRepository extends BaseRepository<any> {
  protected readonly modelName = 'Inspection';
  protected readonly delegate = prisma.inspection;

  async findByBooking(bookingId: string) {
    return this.delegate.findMany({
      where: { bookingId },
      include: { staff: { include: { user: true } }, vehicle: true },
    });
  }

  async findByVehicle(vehicleId: string) {
    return this.delegate.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      include: { staff: { include: { user: true } }, booking: true },
    });
  }
}