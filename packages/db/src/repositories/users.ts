import { prisma } from '../client';
import { BaseRepository } from './base';
import { AppError } from '@threadsight/core/errors';
import { logger } from '@threadsight/core/logging';
import { paginationSchema, createPaginationResponse, type PaginationParams } from '@threadsight/core/validation';

export class UserRepository extends BaseRepository<any> {
  protected readonly modelName = 'User';
  protected readonly delegate = prisma.user;

  async findByEmail(email: string) {
    return this.delegate.findUnique({ where: { email } });
  }

  async findByEmailWithRelations(email: string) {
    return this.delegate.findUnique({
      where: { email },
      include: { customer: true, staff: true },
    });
  }

  async findStaff() {
    return this.delegate.findMany({
      where: { role: { in: ['STAFF', 'ADMIN', 'MANAGER'] } },
      include: { staff: true },
    });
  }
}

export class CustomerRepository extends BaseRepository<any> {
  protected readonly modelName = 'Customer';
  protected readonly delegate = prisma.customer;

  async findByUserId(userId: string) {
    return this.delegate.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async findByLicense(licenseNumber: string) {
    return this.delegate.findUnique({ where: { licenseNumber } });
  }

  async findWithBookings(customerId: string) {
    return this.delegate.findUnique({
      where: { id: customerId },
      include: {
        user: true,
        bookings: {
          orderBy: { createdAt: 'desc' },
          include: { vehicle: { include: { category: true } }, payments: true },
        },
      },
    });
  }

  async search(params: { query?: string; isBlacklisted?: boolean; pagination: PaginationParams }) {
    const where: any = {};

    if (params.query) {
      where.OR = [
        { user: { name: { contains: params.query, mode: 'insensitive' } } },
        { user: { email: { contains: params.query, mode: 'insensitive' } } },
        { licenseNumber: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    if (params.isBlacklisted !== undefined) {
      where.isBlacklisted = params.isBlacklisted;
    }

    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (params.pagination.page - 1) * params.pagination.limit,
        take: params.pagination.limit,
      }),
      this.delegate.count({ where }),
    ]);

    return createPaginationResponse(items, total, params.pagination);
  }
}

export class StaffRepository extends BaseRepository<any> {
  protected readonly modelName = 'Staff';
  protected readonly delegate = prisma.staff;

  async findByUserId(userId: string) {
    return this.delegate.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async findByEmployeeId(employeeId: string) {
    return this.delegate.findUnique({ where: { employeeId } });
  }
}