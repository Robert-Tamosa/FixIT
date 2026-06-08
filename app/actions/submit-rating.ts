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

  // Verify the booking belongs to this owner and is DONE
  const booking = await prisma.booking.findFirst({
    where: {
      id:      bookingId,
      ownerId: session.user.id,
      status:  "DONE",
    },
    select: { id: true, mechanicId: true, rating: { select: { id: true } } },
  });

  if (!booking)
    return { status: "error", message: "Booking not found or not yet completed." };

  if (booking.rating)
    return { status: "error", message: "You have already rated this booking." };

  // Analyze sentiment if there's a comment
  const sentiment = comment ? await analyzeSentiment(comment) : "NEUTRAL";

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

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/bookings");

  return { status: "success" };
}
