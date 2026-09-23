import { prisma } from '../client';
import { BaseRepository } from './base';
import { AppError } from '@threadsight/core/errors';
import { logger } from '@threadsight/core/logging';
import { paginationSchema, createPaginationResponse, type PaginationParams } from '@threadsight/core/validation';

export class BookingRepository extends BaseRepository<any> {
  protected readonly modelName = 'Booking';
  protected readonly delegate = prisma.booking;

  async findByCustomer(customerId: string, params: PaginationParams) {
    const where = { customerId };
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: {
          vehicle: { include: { category: true } },
          pickupLocation: true,
          returnLocation: true,
          extras: { include: { extra: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return createPaginationResponse(items, total, params);
  }

  async findByVehicle(vehicleId: string, params: PaginationParams) {
    const where = { vehicleId };
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: { customer: { include: { user: true } }, extras: { include: { extra: true } } },
        orderBy: { startDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return createPaginationResponse(items, total, params);
  }

  async findByStatus(status: string, params: PaginationParams) {
    const where = { status: status as any };
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: {
          customer: { include: { user: true } },
          vehicle: { include: { category: true } },
          pickupLocation: true,
          returnLocation: true,
        },
        orderBy: { startDate: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return createPaginationResponse(items, total, params);
  }

  async findUpcomingPickups(days = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.delegate.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PENDING'] },
        startDate: { lte: endDate, gte: new Date() },
      },
      include: {
        customer: { include: { user: true } },
        vehicle: { include: { category: true } },
        pickupLocation: true,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findUpcomingReturns(days = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.delegate.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: endDate, gte: new Date() },
      },
      include: {
        customer: { include: { user: true } },
        vehicle: { include: { category: true } },
        returnLocation: true,
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async findOverdue() {
    return this.delegate.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: new Date() },
      },
      include: {
        customer: { include: { user: true } },
        vehicle: { include: { category: true } },
        returnLocation: true,
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async getWithDetails(id: string) {
    return this.delegate.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        vehicle: { include: { category: true, location: true } },
        pickupLocation: true,
        returnLocation: true,
        extras: { include: { extra: true } },
        payments: true,
        invoices: { include: { lineItems: true, payments: true } },
        inspections: { include: { staff: { include: { user: true } } } },
      },
    });
  }

  async checkAvailability(vehicleId: string, startDate: Date, endDate: Date, excludeBookingId?: string): Promise<boolean> {
    const where: any = {
      vehicleId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
      OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
    };

    if (excludeBookingId) {
      where.id = { not: excludeBookingId };
    }

    const count = await this.delegate.count({ where });
    return count === 0;
  }
}

export class ExtraRepository extends BaseRepository<any> {
  protected readonly modelName = 'Extra';
  protected readonly delegate = prisma.extra;

  async findActive() {
    return this.delegate.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    });
  }

  async findByCategory(category: string) {
    return this.delegate.findMany({
      where: { category: category as any, isActive: true },
    });
  }
}