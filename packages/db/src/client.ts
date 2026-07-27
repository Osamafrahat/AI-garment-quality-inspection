import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '@car-rental/core/logging';
import { getEnv } from '@car-rental/core/config';

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getEnv();

  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  client.$on('query', (e) => {
    logger.debug({ duration: e.duration, query: e.query }, 'Database query');
  });

  return client;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}