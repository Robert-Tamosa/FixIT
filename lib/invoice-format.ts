import type { Decimal } from "@prisma/client/runtime/client";

/** Formats a Prisma Decimal, number, or numeric string as ₱ currency. */
export function formatCurrency(amount: Decimal | number | string): string {
  const n = Number(amount);
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Generates a human-readable invoice number, unique per booking. */
export function generateInvoiceNumber(bookingId: string): string {
  const year = new Date().getFullYear();
  const suffix = bookingId.slice(-6).toUpperCase();
  return `INV-${year}-${suffix}`;
}

/** Converts Prisma Decimal fields to plain numbers for client components. */
export function toPlainNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}