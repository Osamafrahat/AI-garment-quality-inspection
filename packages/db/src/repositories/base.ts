import { prisma } from '../client';
import { AppError } from '@car-rental/core/errors';
import { logger } from '@car-rental/core/logging';
import { paginationSchema, createPaginationResponse, type PaginationParams } from '@car-rental/core/validation';

export abstract class BaseRepository<T> {
  protected abstract modelName: string;
  protected abstract delegate: any;

  async findById(id: string) {
    return this.delegate.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string) {
    const item = await this.findById(id);
    if (!item) {
      throw AppError.notFound(this.modelName, id);
    }
    return item;
  }

  async findMany(params: PaginationParams & { where?: any; include?: any; orderBy?: any }) {
    const { page, limit, sortBy, sortOrder, where, include, orderBy } = params;

    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include,
        orderBy: sortBy ? { [sortBy]: sortOrder } : orderBy ?? { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.delegate.count({ where }),
    ]);

    return createPaginationResponse(items, total, params);
  }

  async create(data: any) {
    return this.delegate.create({ data });
  }

  async update(id: string, data: any) {
    await this.findByIdOrThrow(id);
    return this.delegate.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findByIdOrThrow(id);
    return this.delegate.delete({ where: { id } });
  }

  async softDelete(id: string) {
    await this.findByIdOrThrow(id);
    return this.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async count(where?: any) {
    return this.delegate.count({ where });
  }

  async exists(where: any) {
    const count = await this.delegate.count({ where });
    return count > 0;
  }

  async findFirst(where: any, include?: any) {
    return this.delegate.findFirst({ where, include });
  }

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}