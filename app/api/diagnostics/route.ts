import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `You are FixIT's AI Vehicle Diagnostic Assistant. You help vehicle owners in the Philippines identify possible causes of their vehicle problems and recommend next steps.

STRICT RULES:
- Only answer questions related to vehicle symptoms, car problems, or automotive issues.
- If the user asks something unrelated to vehicles, politely redirect them.
- Always recommend consulting a verified FixIT mechanic for confirmation and repair.
- Keep responses practical, clear, and concise.
- Use Philippine context when relevant (local roads, weather, fuel types available).

RESPONSE FORMAT — always respond in this exact JSON structure:
{
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "possibleCauses": [
    { "cause": "string", "likelihood": "HIGH" | "MEDIUM" | "LOW", "explanation": "string" }
  ],
  "recommendations": ["string"],
  "partsToCheck": ["string"],
  "estimatedCostRange": "string (e.g. P500-P2,000)",
  "mechanicSpecialty": "ENGINE_REPAIR" | "ELECTRICAL" | "BRAKES" | "TIRES" | "AIRCON" | "DIAGNOSTICS",
  "safeToDrive": boolean,
  "summary": "string (1-2 sentence plain summary)"
}

Respond ONLY with valid JSON. No markdown, no backticks, no extra text.`;

export async function POST(req: NextRequest) {
  const { symptoms, vehicleInfo } = await req.json();

  if (!symptoms?.trim()) {
    return NextResponse.json({ error: "Symptoms are required." }, { status: 400 });
  }

  const userMessage = vehicleInfo
    ? `Vehicle: ${vehicleInfo}\n\nSymptoms: ${symptoms}`
    : `Symptoms: ${symptoms}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured." }, { status: 500 });
  }

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Gemini API error]", err);
      return NextResponse.json({ error: "Gemini API error." }, { status: 502 });
    }

    const data = await res.json();
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed  = JSON.parse(cleaned);

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("[Diagnostics route error]", err);
    return NextResponse.json(
      { error: "Failed to analyze symptoms. Please try again." },
      { status: 500 }
    );
  }
}