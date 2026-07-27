import { prisma } from '../client';
import { BaseRepository } from './base';

export class DocumentRepository extends BaseRepository<any> {
  protected readonly modelName = 'Document';
  protected readonly delegate = prisma.document;

  async findByEntity(entityType: string, entityId: string) {
    return this.delegate.findMany({
      where: { entityType: entityType as any, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export class NotificationRepository extends BaseRepository<any> {
  protected readonly modelName = 'Notification';
  protected readonly delegate = prisma.notification;

  async findUnreadByUser(userId: string) {
    return this.delegate.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    return this.delegate.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.delegate.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

export class AuditLogRepository extends BaseRepository<any> {
  protected readonly modelName = 'AuditLog';
  protected readonly delegate = prisma.auditLog;

  async findByEntity(entity: string, entityId: string) {
    return this.delegate.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    return this.delegate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export class SettingRepository extends BaseRepository<any> {
  protected readonly modelName = 'Setting';
  protected readonly delegate = prisma.setting;

  async get(key: string) {
    return this.delegate.findUnique({ where: { key } });
  }

  async set(key: string, value: any, description?: string) {
    return this.delegate.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description },
    });
  }
}