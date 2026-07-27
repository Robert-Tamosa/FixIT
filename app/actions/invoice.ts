"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, toPlainNumber } from "@/lib/invoice-format";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  return dbUser;
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Mechanic (or admin) generates the final invoice once a booking is DONE.
 * Line items let the mechanic reflect any changes from the original estimate
 * (extra parts, adjusted labor, etc.).
 */
export async function generateInvoice(
  bookingId: string,
  items: InvoiceItemInput[],
  notes?: string,
) {
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  const isOwnerMechanic = user.role === "MECHANIC" && booking.mechanicId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwnerMechanic && !isAdmin) throw new Error("Not authorized to generate this invoice");
  if (booking.status !== "DONE") throw new Error("Booking must be completed first");

  const existing = await prisma.invoice.findUnique({ where: { bookingId } });
  if (existing) throw new Error("An invoice already exists for this booking");
  if (items.length === 0) throw new Error("Invoice must have at least one line item");

  const laborItems = items.filter((i) => /labor/i.test(i.description));
  const laborCost = laborItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const partsCost = items
    .filter((i) => !laborItems.includes(i))
    .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalAmount = laborCost + partsCost;

  await prisma.invoice.create({
    data: {
      bookingId,
      invoiceNumber: generateInvoiceNumber(bookingId),
      laborCost,
      partsCost,
      totalAmount,
      notes,
      items: {
        create: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.quantity * i.unitPrice,
        })),
      },
    },
  });

  revalidatePath(`/dashboard/mechanic/jobs/${bookingId}`);
  revalidatePath(`/dashboard/owner/invoices/${bookingId}`);
  revalidatePath("/dashboard/admin/invoices");
  return { success: true };
}

/**
 * Mechanic or admin confirms cash payment was received outside the app.
 * There is no in-app payment processing — this just records the outcome.
 */
export async function markInvoicePaid(invoiceId: string) {
  const user = await requireUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { booking: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const isOwnerMechanic = user.role === "MECHANIC" && invoice.booking.mechanicId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwnerMechanic && !isAdmin) throw new Error("Not authorized");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paymentStatus: "PAID", paidAt: new Date() },
  });

  revalidatePath(`/dashboard/mechanic/jobs/${invoice.bookingId}`);
  revalidatePath(`/dashboard/owner/invoices/${invoice.bookingId}`);
  revalidatePath("/dashboard/admin/invoices");
  return { success: true };
}

export interface DisplayInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface DisplayInvoice {
  id: string;
  invoiceNumber: string;
  laborCost: number;
  partsCost: number;
  totalAmount: number;
  paymentStatus: "UNPAID" | "PAID";
  paidAt: string | null;
  notes: string | null;
  generatedAt: string;
  items: DisplayInvoiceItem[];
}

/** Fetches an invoice, scoped to owner/mechanic (own booking) or admin. */
export async function getInvoice(bookingId: string): Promise<DisplayInvoice | null> {
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  const isOwner = user.role === "OWNER" && booking.ownerId === user.id;
  const isMechanic = user.role === "MECHANIC" && booking.mechanicId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isMechanic && !isAdmin) throw new Error("Not authorized");

  const invoice = await prisma.invoice.findUnique({
    where: { bookingId },
    include: { items: true },
  });
  if (!invoice) return null;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    laborCost: toPlainNumber(invoice.laborCost),
    partsCost: toPlainNumber(invoice.partsCost),
    totalAmount: toPlainNumber(invoice.totalAmount),
    paymentStatus: invoice.paymentStatus,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    notes: invoice.notes,
    generatedAt: invoice.generatedAt.toISOString(),
    items: invoice.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: toPlainNumber(i.unitPrice),
      amount: toPlainNumber(i.amount),
    })),
  };
}

export interface DisplayInvoiceListRow {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  ownerName: string;
  mechanicName: string;
  totalAmount: number;
  paymentStatus: "UNPAID" | "PAID";
  generatedAt: string;
}

/** Admin-only: all invoices across the platform. */
export async function getAllInvoices(): Promise<DisplayInvoiceListRow[]> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Admin only");

  const invoices = await prisma.invoice.findMany({
    include: { booking: { include: { owner: true, mechanic: true } } },
    orderBy: { generatedAt: "desc" },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    bookingId: inv.bookingId,
    ownerName: inv.booking.owner.name ?? "Unknown",
    mechanicName: inv.booking.mechanic?.name ?? "Unassigned",
    totalAmount: toPlainNumber(inv.totalAmount),
    paymentStatus: inv.paymentStatus,
    generatedAt: inv.generatedAt.toISOString(),
  }));
}

export interface TransactionReport {
  totalInvoices: number;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  paidCount: number;
  unpaidCount: number;
}

/** Admin-only: aggregate transaction totals, optionally scoped to a date range. */
export async function getTransactionReport(
  startDate?: Date,
  endDate?: Date,
): Promise<TransactionReport> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Admin only");

  const invoices = await prisma.invoice.findMany({
    where:
      startDate && endDate
        ? { generatedAt: { gte: startDate, lte: endDate } }
        : undefined,
  });

  const paid = invoices.filter((i) => i.paymentStatus === "PAID");
  const unpaid = invoices.filter((i) => i.paymentStatus === "UNPAID");

  return {
    totalInvoices: invoices.length,
    totalRevenue: invoices.reduce((sum, i) => sum + toPlainNumber(i.totalAmount), 0),
    paidRevenue: paid.reduce((sum, i) => sum + toPlainNumber(i.totalAmount), 0),
    unpaidRevenue: unpaid.reduce((sum, i) => sum + toPlainNumber(i.totalAmount), 0),
    paidCount: paid.length,
    unpaidCount: unpaid.length,
  };
}