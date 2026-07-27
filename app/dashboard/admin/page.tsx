import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { headers }  from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboardView, {
  type AdminStats,
  type PendingMechanic,
  type PendingShop,
  type RecentBooking,
  type AdminUser,
} from "./_dashboard";

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/signIn");

  // ── 1. Stats ───────────────────────────────────────────────────────────────
  const [ownerCount, approvedCount, pendingCount, bookingCount] = await Promise.all([
    prisma.user.count({ where: { role: "OWNER" } }),
    prisma.user.count({ where: { role: "MECHANIC", mechanicProfile: { verificationStatus: "APPROVED" } } }),
    prisma.mechanicProfile.count({ where: { verificationStatus: "PENDING" } }),
    prisma.booking.count(),
  ]);

  const stats: AdminStats = {
    owners:               ownerCount,
    approvedMechanics:    approvedCount,
    pendingVerifications: pendingCount,
    totalBookings:        bookingCount,
  };

  // ── 2. Pending mechanic verification queue ─────────────────────────────────
  const rawPending = await prisma.user.findMany({
    where: {
      role: "MECHANIC",
      mechanicProfile: { verificationStatus: "PENDING" },
    },
    select: {
      id:        true,
      name:      true,
      email:     true,
      phone:     true,
      createdAt: true,
      mechanicProfile: {
        select: {
          shopName:          true,
          specialization:    true,
          yearsExperience:   true,
          certificationFile: true,
          bio:               true,
        },
      },
    },
    orderBy: { createdAt: "asc" }, // oldest applications first
  });

  const pendingMechanics: PendingMechanic[] = rawPending.map((u) => ({
    userId:            u.id,
    name:              u.name              ?? "Unknown",
    email:             u.email,
    phone:             u.phone,
    shopName:          u.mechanicProfile?.shopName          ?? null,
    specialization:    u.mechanicProfile?.specialization    ?? "—",
    yearsExperience:   u.mechanicProfile?.yearsExperience   ?? null,
    certificationFile: u.mechanicProfile?.certificationFile ?? null,
    bio:               u.mechanicProfile?.bio               ?? null,
    appliedAt:         u.createdAt.toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    }),
  }));

  // ── 3. Pending shop verification queue ─────────────────────────────────────
  const rawPendingShops = await prisma.repairShop.findMany({
    where: { verificationStatus: "PENDING" },
    select: {
      id:        true,
      name:      true,
      address:   true,
      phone:     true,
      services:  true,
      createdAt: true,
      owner: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" }, // oldest applications first
  });

  const pendingShops: PendingShop[] = rawPendingShops.map((s) => ({
    shopId:     s.id,
    name:       s.name,
    ownerName:  s.owner.name  ?? "Unknown",
    ownerEmail: s.owner.email,
    address:    s.address,
    phone:      s.phone,
    services:   s.services,
    appliedAt:  s.createdAt.toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    }),
  }));

  // ── 4. Recent bookings ─────────────────────────────────────────────────────
  const rawBookings = await prisma.booking.findMany({
    take:    15,
    orderBy: { createdAt: "desc" },
    select: {
      id:                 true,
      status:             true,
      problemDescription: true,
      createdAt:          true,
      owner:    { select: { name: true } },
      mechanic: { select: { name: true } },
      vehicle:  { select: { brand: true, model: true } },
    },
  });

  const recentBookings: RecentBooking[] = rawBookings.map((b) => ({
    id:                 b.id,
    status:             b.status,
    ownerName:          b.owner.name    ?? "Unknown Owner",
    mechanicName:       b.mechanic.name ?? "Unknown Mechanic",
    vehicleLabel:       `${b.vehicle.brand} ${b.vehicle.model}`,
    problemDescription: b.problemDescription,
    createdAt:          b.createdAt.toLocaleDateString("en-PH", {
      month: "short", day: "numeric",
    }),
  }));

  // ── 5. Recent users ────────────────────────────────────────────────────────
  const rawUsers = await prisma.user.findMany({
    take:    20,
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      name:         true,
      email:        true,
      role:         true,
      emailVerified: true,
      createdAt:    true,
      mechanicProfile: { select: { isVerified: true } },
    },
  });

  const recentUsers: AdminUser[] = rawUsers.map((u) => ({
    id:        u.id,
    name:      u.name ?? "Unknown",
    email:     u.email,
    role:      u.role,
    createdAt: u.createdAt.toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    }),
    verified: u.role === "MECHANIC"
      ? (u.mechanicProfile?.isVerified ?? false)
      : u.emailVerified,
  }));

  return (
    <AdminDashboardView
      adminName={session.user.name ?? "Admin"}
      stats={stats}
      pendingMechanics={pendingMechanics}
      pendingShops={pendingShops}
      recentBookings={recentBookings}
      recentUsers={recentUsers}
    />
  );
}