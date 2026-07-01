import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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
  "estimatedCostRange": "string (e.g. ₱500–₱2,000)",
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured." }, { status: 500 });
  }

  try {
    const res = await fetch(GROQ_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens:  800,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMessage   },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Groq API error]", err);
      return NextResponse.json({ error: "Groq API error." }, { status: 502 });
    }

    const data    = await res.json();
    const raw     = data.choices?.[0]?.message?.content ?? "";
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