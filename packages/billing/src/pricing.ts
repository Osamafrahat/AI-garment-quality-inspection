import { Decimal } from 'decimal.js';
import { logger } from '@threadsight/core/logging';

export interface PricingInput {
  dailyRate: Decimal;
  totalDays: number;
  extras: Array<{ dailyRate: Decimal; quantity: number; days: number }>;
  taxRate: Decimal;
  discount?: Decimal;
}

export interface PricingResult {
  subtotal: Decimal;
  extraTotal: Decimal;
  discount: Decimal;
  taxAmount: Decimal;
  total: Decimal;
  breakdown: {
    rental: Decimal;
    extras: Array<{ name: string; quantity: number; dailyRate: Decimal; days: number; total: Decimal }>;
  };
}

export function calculatePricing(input: PricingInput): PricingResult {
  const rentalSubtotal = input.dailyRate.mul(input.totalDays);
  const extraTotal = input.extras.reduce(
    (sum, extra) => sum.plus(extra.dailyRate.mul(extra.quantity).mul(extra.days)),
    new Decimal(0)
  );
  const subtotal = rentalSubtotal.plus(extraTotal);
  const discount = input.discount ?? new Decimal(0);
  const taxableAmount = subtotal.minus(discount);
  const taxAmount = taxableAmount.mul(input.taxRate);
  const total = taxableAmount.plus(taxAmount);

  return {
    subtotal: round(subtotal),
    extraTotal: round(extraTotal),
    discount: round(discount),
    taxAmount: round(taxAmount),
    total: round(total),
    breakdown: {
      rental: round(rentalSubtotal),
      extras: input.extras.map((e) => ({
        name: '',
        quantity: e.quantity,
        dailyRate: e.dailyRate,
        days: e.days,
        total: round(e.dailyRate.mul(e.quantity).mul(e.days)),
      })),
    },
  };
}

export function calculateDeposit(dailyRate: Decimal, totalDays: number, depositMultiplier: Decimal = new Decimal(1)): Decimal {
  return round(dailyRate.mul(totalDays).mul(depositMultiplier));
}

export function calculateRefund(
  totalPaid: Decimal,
  usedDays: number,
  totalDays: number,
  dailyRate: Decimal,
  cancellationFee: Decimal = new Decimal(0)
): Decimal {
  const unusedDays = totalDays - usedDays;
  const refundableAmount = dailyRate.mul(unusedDays);
  return round(refundableAmount.minus(cancellationFee).max(0));
}

export function round(value: Decimal, decimals = 2): Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}