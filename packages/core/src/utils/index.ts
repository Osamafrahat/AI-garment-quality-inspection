import { ulid } from 'ulid';
import { format, parseISO, differenceInDays, addDays, startOfDay, endOfDay } from 'date-fns';
import { Decimal } from 'decimal.js';

export function generateId(): string {
  return ulid();
}

export function formatCurrency(amount: number | string | Decimal, currency = 'USD'): string {
  const decimal = new Decimal(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(decimal.toNumber());
}

export function parseCurrency(value: string): Decimal {
  return new Decimal(value.replace(/[^0-9.-]/g, ''));
}

export function calculateDays(start: Date, end: Date): number {
  return differenceInDays(endOfDay(end), startOfDay(start)) + 1;
}

export function formatDate(date: Date | string, pattern = 'PPP'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'PPP p');
}

export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d < new Date();
}

export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d > new Date();
}

export function addBusinessDays(date: Date, days: number): Date {
  let result = new Date(date);
  let added = 0;
  while (added < days) {
    result = addDays(result, 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++;
    }
  }
  return result;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  options: { attempts: number; delay: number; backoff?: number } = { attempts: 3, delay: 1000 }
): Promise<T> {
  return fn().catch((error) => {
    if (options.attempts <= 1) throw error;
    return sleep(options.delay).then(() =>
      retry(fn, {
        attempts: options.attempts - 1,
        delay: options.delay * (options.backoff ?? 2),
        backoff: options.backoff,
      })
    );
  });
}