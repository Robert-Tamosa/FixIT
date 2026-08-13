"use server";

import { auth }           from "@/lib/auth";
import { prisma }         from "@/lib/prisma";
import { headers }        from "next/headers";
import { revalidatePath } from "next/cache";

export type RatingState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

// ── Sentiment analysis via Anthropic ─────────────────────────────────────────

async function analyzeSentiment(comment: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: "Classify the sentiment of this mechanic review as exactly one word: POSITIVE, NEUTRAL, or NEGATIVE. Reply with only that word, nothing else." }],
          },
          contents: [{ role: "user", parts: [{ text: comment }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0 },
        }),
      }
    );
    const data = await res.json();
    const word = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .trim()
      .toUpperCase();
    if (["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(word)) return word;
    return "NEUTRAL";
  } catch {
    return "NEUTRAL";
  }
}

// ── Submit rating ─────────────────────────────────────────────────────────────

export async function submitRating(
  _prev: RatingState,
  formData: FormData
): Promise<RatingState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "error", message: "Not authenticated." };

  const bookingId = formData.get("bookingId") as string | null;
  const ratingRaw = formData.get("rating")    as string | null;
  const comment   = (formData.get("comment")  as string | null)?.trim() || null;

  if (!bookingId) return { status: "error", message: "Booking ID is required." };

  const rating = parseInt(ratingRaw ?? "0", 10);
  if (!rating || rating < 1 || rating > 5)
    return { status: "error", message: "Please select a rating between 1 and 5." };

  // Verify the booking belongs to this owner and is DONE. Also pull shopId
  // and shopRating alongside the existing mechanicId/rating fields — shop
  // bookings never get a mechanicId (no assignment step exists anymore),
  // so a rating for one of those has to go to ShopRating instead of
  // MechanicRating, which requires a real mechanicId and would reject null.
  const booking = await prisma.booking.findFirst({
    where: {
      id:      bookingId,
      ownerId: session.user.id,
      status:  "DONE",
    },
    select: {
      id: true,
      mechanicId: true,
      shopId: true,
      rating:     { select: { id: true } },
      shopRating: { select: { id: true } },
    },
  });

  if (!booking)
    return { status: "error", message: "Booking not found or not yet completed." };

  if (booking.rating || booking.shopRating)
    return { status: "error", message: "You have already rated this booking." };

  if (!booking.mechanicId && !booking.shopId)
    return { status: "error", message: "This booking has no mechanic or shop to rate." };

  // Analyze sentiment if there's a comment
  const sentiment = comment ? await analyzeSentiment(comment) : "NEUTRAL";

  if (booking.mechanicId) {
    // TS narrows mechanicId to `string` (not `string | null`) inside this
    // branch — that's what actually fixes the original type error, not
    // just a cast, since MechanicRating.mechanicId is a required field.
    await prisma.mechanicRating.create({
      data: {
        bookingId,
        mechanicId: booking.mechanicId,
        ownerId:    session.user.id,
        rating,
        comment,
        sentiment,
      },
    });
  } else if (booking.shopId) {
    // Matches the exact field set shop.ts's existing rateShop() uses —
    // ShopRating doesn't currently take a sentiment field there, so this
    // doesn't invent one for consistency's sake.
    await prisma.shopRating.create({
      data: {
        bookingId,
        shopId:  booking.shopId,
        ownerId: session.user.id,
        rating,
        comment,
      },
    });
  }

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/bookings");

  return { status: "success" };
}