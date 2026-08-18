import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

interface MechanicInput {
  id:              string;
  name:            string;
  specialization:  string;
  rating:          number;
  reviews:         number;
  available:       boolean;
  yearsExperience: number | null;
  shopName:        string | null;
}

export interface MatchResult {
  mechanicId:  string;
  matchScore:  number;  // 0–100
  reason:      string;
}

// ── POST /api/mechanics/match ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    problem:   string;
    mechanics: MechanicInput[];
  };

  const { problem, mechanics } = body;

  if (!problem?.trim()) {
    return NextResponse.json({ error: "Problem description is required." }, { status: 400 });
  }
  if (!mechanics?.length) {
    return NextResponse.json({ error: "No mechanics to evaluate." }, { status: 400 });
  }

  // ── Build the mechanics list for the prompt ───────────────────────────────
  const mechanicsList = mechanics
    .map((m, i) => [
      `${i + 1}. ID: ${m.id}`,
      `   Name: ${m.name}${m.shopName ? ` (${m.shopName})` : ""}`,
      `   Specialty: ${m.specialization}`,
      `   Experience: ${m.yearsExperience != null ? `${m.yearsExperience} years` : "not specified"}`,
      `   Rating: ${m.rating > 0 ? `${m.rating}/5 (${m.reviews} reviews)` : "no ratings yet"}`,
      `   Available now: ${m.available ? "Yes" : "No — currently on a job"}`,
    ].join("\n"))
    .join("\n\n");

  const systemPrompt = `You are FixIT's intelligent mechanic matching engine for the Philippines.
Your job is to rank mechanics from BEST to WORST match for a given vehicle problem.

Return ONLY a valid JSON array — no markdown, no explanation outside the JSON.

Format:
[
  {
    "mechanicId": "the_id_string",
    "matchScore": 85,
    "reason": "One clear sentence explaining why this mechanic is the right fit."
  }
]

Scoring guide:
- 90–100: Perfect specialist — their exact specialty matches the problem
- 70–89:  Strong match — relevant expertise, likely to resolve the issue
- 50–69:  Capable — can probably handle it but not their primary specialty
- 30–49:  Weak match — general mechanic, not ideal for this specific issue
- 0–29:   Poor match — specialty is unrelated

Rules:
- Always include ALL mechanics in the response, even poor matches
- Boost score by 5–10 points for mechanics who are available right now
- Boost score by 3–5 points for mechanics with 4.5+ rating
- Penalize score by 10 points if mechanic is currently busy
- Keep reasons concise and specific to the problem described`;

  const userMessage = `Vehicle Problem: "${problem.trim()}"

Mechanics to evaluate:
${mechanicsList}

Rank all ${mechanics.length} mechanics from best to worst match.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_tokens:  1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
      ],
    });

    const raw     = completion.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const matches: MatchResult[] = JSON.parse(cleaned);

    // Ensure sorted by matchScore descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({ matches });

  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("[mechanics/match] JSON parse error:", err);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 502 }
      );
    }
    console.error("[mechanics/match] Groq error:", err);
    return NextResponse.json(
      { error: "Matching service temporarily unavailable." },
      { status: 503 }
    );
  }
}