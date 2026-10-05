"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

// ── Guard helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

// ── Activity logging ────────────────────────────────────────────────────────
// Scoped deliberately to admin actions only — not a platform-wide audit
// trail of every booking/message/payment event, which would mean touching
// dozens of files outside this one. Every admin action already funnels
// through this file, so logging them here is a contained, real addition
// that directly answers "who did what, and is there any accountability for
// the single most powerful role in the system."

async function logAdminAction(adminId: string, action: string, targetId?: string, detail?: string) {
  await prisma.adminActivityLog.create({
    data: { adminId, action, targetId, detail },
  });
}

export interface AdminActivityEntry {
  id:        string;
  adminName: string;
  action:    string;
  targetId:  string | null;
  detail:    string | null;
  createdAt: string;
}

export async function getRecentAdminActivity(limit = 30): Promise<AdminActivityEntry[]> {
  await requireAdmin();

  const logs = await prisma.adminActivityLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { name: true } } },
  });

  return logs.map((l) => ({
    id:        l.id,
    adminName: l.admin.name ?? "Unknown admin",
    action:    l.action,
    targetId:  l.targetId,
    detail:    l.detail,
    createdAt: l.createdAt.toLocaleString("en-PH", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
  }));
}

// ── Mechanic verification ─────────────────────────────────────────────────────

export async function approveMechanic(userId: string) {
  const session = await requireAdmin();

  await prisma.mechanicProfile.update({
    where: { userId },
    data:  { verificationStatus: "APPROVED", isVerified: true },
  });
  await logAdminAction(session.user.id, "APPROVE_MECHANIC", userId);

  revalidatePath("/dashboard/admin");
}

export async function rejectMechanic(userId: string) {
  const session = await requireAdmin();

  await prisma.mechanicProfile.update({
    where: { userId },
    data:  { verificationStatus: "REJECTED", isVerified: false },
  });
  await logAdminAction(session.user.id, "REJECT_MECHANIC", userId);

  revalidatePath("/dashboard/admin");
}

// ── Shop verification ─────────────────────────────────────────────────────────
// NOTE: shop.ts has its own separate approveShop/rejectShop functions. As
// far as this codebase shows, nothing calls those — _dashboard.tsx imports
// exclusively from this file ("./admin"), so these are the versions
// actually running for the admin panel. The shop.ts versions are very
// likely dead/duplicate code at this point and worth deleting once
// confirmed no other caller exists.

export async function approveShop(shopId: string) {
  const session = await requireAdmin();

  await prisma.repairShop.update({
    where: { id: shopId },
    data:  { verificationStatus: "APPROVED", isVerified: true },
  });
  await logAdminAction(session.user.id, "APPROVE_SHOP", shopId);

  revalidatePath("/dashboard/admin");
}

export async function rejectShop(shopId: string) {
  const session = await requireAdmin();

  await prisma.repairShop.update({
    where: { id: shopId },
    data:  { verificationStatus: "REJECTED", isVerified: false },
  });
  await logAdminAction(session.user.id, "REJECT_SHOP", shopId);

  revalidatePath("/dashboard/admin");
}

// ── User role management ──────────────────────────────────────────────────────

export async function changeUserRole(
  userId: string,
  role: "OWNER" | "MECHANIC" | "ADMIN"
) {
  const session = await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data:  { role },
  });
  await logAdminAction(session.user.id, "CHANGE_ROLE", userId, `New role: ${role}`);

  revalidatePath("/dashboard/admin");
}

// ── User search ────────────────────────────────────────────────────────────────
// Uses the admin plugin's built-in listUsers rather than a hand-rolled
// Prisma query — it already supports search by name/email with the
// contains/eq/starts-with operators the plugin's own types expect.

export interface AdminUserSearchResult {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  banned:    boolean;
  createdAt: string;
}

export async function searchUsers(query: string): Promise<AdminUserSearchResult[]> {
  await requireAdmin();
  if (!query.trim()) return [];

  const result = await auth.api.listUsers({
    headers: await headers(),
    query: {
      searchValue:    query.trim(),
      searchField:    "email",
      searchOperator: "contains",
      limit:          20,
    },
  });

  // Also search by name — listUsers only searches one field per call, so
  // this runs a second pass and merges, deduping by id. Simpler than trying
  // to OR two fields in one call given the plugin's query shape.
  const byName = await auth.api.listUsers({
    headers: await headers(),
    query: {
      searchValue:    query.trim(),
      searchField:    "name",
      searchOperator: "contains",
      limit:          20,
    },
  });

  const merged = new Map<string, (typeof result.users)[number]>();
  for (const u of [...result.users, ...byName.users]) merged.set(u.id, u);

  return Array.from(merged.values()).map((u) => ({
    id:        u.id,
    name:      u.name ?? "Unknown",
    email:     u.email,
    role:      (u.role as string) ?? "OWNER",
    banned:    u.banned ?? false,
    createdAt: new Date(u.createdAt).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    }),
  }));
}

// ── Ban / unban ──────────────────────────────────────────────────────────────
// Deliberately NOT a real delete — see the module-level reasoning in the
// chat history this was built from: a hard delete risks FK constraint
// failures across every relation pointing at User (bookings, mechanic
// profiles, ratings, messages...) that hasn't been individually audited for
// safe cascade behavior. Ban achieves the same practical outcome (account
// becomes unusable) via Better Auth's own enforcement — it blocks sign-in
// and revokes existing sessions automatically, with no custom gating code
// needed anywhere else in the app.

export async function banUser(userId: string, reason?: string) {
  const session = await requireAdmin();
  const finalReason = reason || "Violation of platform policy";

  await auth.api.banUser({
    headers: await headers(),
    body: {
      userId,
      banReason: finalReason,
    },
  });
  await logAdminAction(session.user.id, "BAN_USER", userId, finalReason);

  revalidatePath("/dashboard/admin");
}

export async function unbanUser(userId: string) {
  const session = await requireAdmin();

  await auth.api.unbanUser({
    headers: await headers(),
    body: { userId },
  });
  await logAdminAction(session.user.id, "UNBAN_USER", userId);

  revalidatePath("/dashboard/admin");
}

// ── System settings ──────────────────────────────────────────────────────────
// Singleton row — there's always exactly one SystemSetting record, fetched
// or created on first read. Scoped to three settings that are genuinely
// live-toggleable: maintenanceMode and defaultNotificationsEnabled are read
// fresh on every signup inside auth.ts's databaseHooks.user.create.before
// hook (which runs per-request, unlike Better Auth's top-level config
// values such as requireEmailVerification, which are fixed at app startup
// and can't be changed without a redeploy). announcementMessage is read by
// the landing and sign-in pages.

export interface DisplaySystemSettings {
  announcementMessage:         string | null;
  maintenanceMode:             boolean;
  defaultNotificationsEnabled: boolean;
}

export async function getSystemSettings(): Promise<DisplaySystemSettings> {
  const settings = await prisma.systemSetting.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return {
    announcementMessage:         settings.announcementMessage,
    maintenanceMode:             settings.maintenanceMode,
    defaultNotificationsEnabled: settings.defaultNotificationsEnabled,
  };
}

export async function updateSystemSettings(data: Partial<DisplaySystemSettings>) {
  const session = await requireAdmin();

  await prisma.systemSetting.upsert({
    where:  { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  await logAdminAction(
    session.user.id,
    "UPDATE_SYSTEM_SETTINGS",
    undefined,
    JSON.stringify(data),
  );

  revalidatePath("/dashboard/admin");
  revalidatePath("/");
  revalidatePath("/signIn");
}