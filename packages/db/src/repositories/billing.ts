import { prisma } from '../client';
import { BaseRepository } from './base';
import { AppError } from '@car-rental/core/errors';
import { logger } from '@car-rental/core/logging';
import { paginationSchema, createPaginationResponse, type PaginationParams } from '@car-rental/core/validation';

export class InvoiceRepository extends BaseRepository<any> {
  protected readonly modelName = 'Invoice';
  protected readonly delegate = prisma.invoice;

  async findByCustomer(customerId: string, params: PaginationParams) {
    const where = { customerId };
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: { lineItems: true, payments: true, booking: { include: { vehicle: true } } },
        orderBy: { createdAt: 'desc' },
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
        include: { customer: { include: { user: true } }, lineItems: true, payments: true },
        orderBy: { dueDate: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return createPaginationResponse(items, total, params);
  }

  async findOverdue() {
    return this.delegate.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
      include: { customer: { include: { user: true } }, lineItems: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getWithDetails(id: string) {
    return this.delegate.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        booking: { include: { vehicle: { include: { category: true } } } },
        lineItems: true,
        payments: true,
      },
    });
  }
}

export class PaymentRepository extends BaseRepository<any> {
  protected readonly modelName = 'Payment';
  protected readonly delegate = prisma.payment;

  async findByBooking(bookingId: string) {
    return this.delegate.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByInvoice(invoiceId: string) {
    return this.delegate.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProviderId(providerPaymentId: string) {
    return this.delegate.findUnique({ where: { providerPaymentId } });
  }

  async findByCustomer(customerId: string, params: PaginationParams) {
    const where = { customerId };
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: { booking: true, invoice: true },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return createPaginationResponse(items, total, params);
  }
}