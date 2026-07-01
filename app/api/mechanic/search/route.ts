import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/mechanics/search
// Params: q, specialization, available, minRating

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const q              = searchParams.get("q")?.trim()            ?? "";
  const specialization = searchParams.get("specialization")?.trim() ?? "";
  const availableOnly  = searchParams.get("available")             === "true";
  const minRating      = parseFloat(searchParams.get("minRating")  ?? "0") || 0;

  try {
    // ── Build the Prisma where clause ──────────────────────────────────────────
    const mechanics = await prisma.user.findMany({
      where: {
        role: "MECHANIC",

        // Keyword search across name, shop name, and specialization
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { mechanicProfile: { shopName:       { contains: q, mode: "insensitive" } } },
            { mechanicProfile: { specialization: { contains: q, mode: "insensitive" } } },
          ],
        } : {}),

        mechanicProfile: {
          verificationStatus: "APPROVED",
          // Specialization chip filter
          ...(specialization ? { specialization: { contains: specialization, mode: "insensitive" } } : {}),
        },

        // Availability filter — no active bookings
        ...(availableOnly ? {
          bookingsAsMechanic: {
            none: { status: { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] } },
          },
        } : {}),
      },

      select: {
        id:   true,
        name: true,
        mechanicProfile: {
          select: {
            shopName:         true,
            specialization:   true,
            yearsExperience:  true,
            bio:              true,
            latitude:         true,
            longitude:        true,
          },
        },
        _count: { select: { ratingsReceived: true } },
      },

      take: 30,
    });

    if (mechanics.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // ── Compute average ratings ────────────────────────────────────────────────
    const ids       = mechanics.map((m) => m.id);
    const avgRatings = await prisma.mechanicRating.groupBy({
      by:    ["mechanicId"],
      where: { mechanicId: { in: ids } },
      _avg:  { rating: true },
    });
    const ratingMap = new Map(avgRatings.map((r) => [r.mechanicId, r._avg.rating ?? 0]));

    // ── Find which mechanics are currently busy ────────────────────────────────
    const busyIds = await prisma.booking
      .findMany({
        where:  { mechanicId: { in: ids }, status: { in: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] } },
        select: { mechanicId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.mechanicId)));

    // ── Transform + apply minRating filter + sort ──────────────────────────────
    const results = mechanics
      .map((m) => ({
        id:              m.id,
        name:            m.name ?? "Unknown",
        initials:        (m.name ?? "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
        shopName:        m.mechanicProfile?.shopName        ?? null,
        specialization:  m.mechanicProfile?.specialization  ?? "General",
        yearsExperience: m.mechanicProfile?.yearsExperience ?? null,
        bio:             m.mechanicProfile?.bio             ?? null,
        rating:          Math.round((ratingMap.get(m.id) ?? 0) * 10) / 10,
        reviews:         m._count.ratingsReceived,
        available:       !busyIds.has(m.id),
        latitude:        m.mechanicProfile?.latitude        ?? null,
        longitude:       m.mechanicProfile?.longitude       ?? null,
      }))
      .filter((m) => m.rating >= minRating || m.reviews === 0) // include unrated mechanics
      .sort((a, b) => {
        // Available mechanics first, then by rating
        if (a.available !== b.available) return a.available ? -1 : 1;
        return b.rating - a.rating;
      });

    return NextResponse.json({ results });

  } catch (err) {
    console.error("[mechanics/search]", err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}