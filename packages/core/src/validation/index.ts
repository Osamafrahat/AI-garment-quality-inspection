import { z } from 'zod';

export const idSchema = z.string().min(1).max(100);
export const ulidSchema = z.string().length(26).regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const emailSchema = z.string().email().toLowerCase();
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);
export const urlSchema = z.string().url();
export const dateTimeSchema = z.coerce.date();
export const dateSchema = z.coerce.date();
export const decimalSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().nonnegative();

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export const paginationResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

export function createPaginationResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams
) {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}