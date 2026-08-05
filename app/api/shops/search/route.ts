import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/shops/search
// Params: q, minRating
//
// Sibling to /api/mechanics/search rather than a branch inside it — RepairShop
// and ShopRating are a distinct model pair from MechanicProfile/MechanicRating
// with different filtering concerns (a `services` array instead of
// `specialization`, `isVerified` instead of `verificationStatus`, no
// individual "busy" concept). Same response envelope (`{ results: [...] }`)
// and the same availability-first, rating-second sort, so the client can
// merge both result sets without special-casing the shape.

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q         = searchParams.get("q")?.trim() ?? "";
  const minRating = parseFloat(searchParams.get("minRating") ?? "0") || 0;

  try {
    const shops = await prisma.repairShop.findMany({
      where: {
        isVerified: true,

        // Keyword search across name and address. Services aren't included
        // here — Prisma array filters need `has`/`hasSome` (exact element
        // match), which doesn't do partial-text matching the way `contains`
        // does for strings. A services facet (chip filter, like the
        // specialization chip on mechanic search) would be a better fit for
        // that than cramming it into free-text search.
        ...(q ? {
          OR: [
            { name:    { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },

      select: {
        id:        true,
        name:      true,
        address:   true,
        services:  true,
        latitude:  true,
        longitude: true,
        ratings:   { select: { rating: true } },
        mechanics: { select: { isAvailable: true } },
      },

      take: 30,
    });

    // ── Transform + compute derived fields ─────────────────────────────────────
    const results = shops
      .map((s) => {
        const avgRating = s.ratings.length
          ? s.ratings.reduce((sum, r) => sum + r.rating, 0) / s.ratings.length
          : 0;
        const availableMechanicCount = s.mechanics.filter((m) => m.isAvailable).length;

        return {
          id:                     s.id,
          kind:                   "shop" as const,
          name:                   s.name,
          initials:               s.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
          specialization:         s.services.slice(0, 2).join(", ") || "General repair",
          rating:                 Math.round(avgRating * 10) / 10,
          reviews:                s.ratings.length,
          available:              availableMechanicCount > 0,
          availableMechanicCount,
          address:                s.address,
          latitude:               s.latitude,
          longitude:              s.longitude,
        };
      })
      .filter((s) => s.rating >= minRating || s.reviews === 0) // include unrated shops
      .sort((a, b) => {
        // Shops with at least one available mechanic first, then by rating —
        // same ordering rule as mechanic search, for a consistent merged list.
        if (a.available !== b.available) return a.available ? -1 : 1;
        return b.rating - a.rating;
      });

    return NextResponse.json({ results });

  } catch (err) {
    console.error("[shops/search]", err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}