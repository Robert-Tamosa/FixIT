import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface VehicleContext {
  brand: string;
  model: string;
  yearModel: number | null;
  mileage: number | null;
}

export interface EmergencyAnalysis {
  diagnosis: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedSpecialization: string;
  estimatedCostMin: number;
  estimatedCostMax: number;
}

const SPECIALIZATIONS = [
  "Engine Repair",
  "Transmission",
  "Electrical Systems",
  "Brakes & Suspension",
  "Tire Service",
  "Battery & Starting",
  "Cooling System",
  "General Mechanic",
];

/**
 * Sends the vehicle context + owner's problem description to Groq and asks for
 * a structured JSON diagnosis. Falls back to a conservative default if the
 * model output can't be parsed, so the booking flow never blocks on AI failure.
 */
export async function analyzeEmergencySymptoms(
  vehicle: VehicleContext,
  problemDescription: string,
): Promise<EmergencyAnalysis> {
  const prompt = `You are an automotive diagnostic assistant helping triage an emergency roadside assistance request.

Vehicle: ${vehicle.yearModel ?? "Unknown year"} ${vehicle.brand} ${vehicle.model}
Mileage: ${vehicle.mileage ?? "Unknown"} km
Owner's description of the problem: "${problemDescription}"

Respond with ONLY a JSON object (no markdown, no preamble) in this exact shape:
{
  "diagnosis": "<one or two sentence probable diagnosis>",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedSpecialization": "<one of: ${SPECIALIZATIONS.join(", ")}>",
  "estimatedCostMin": <number, PHP>,
  "estimatedCostMax": <number, PHP>
}

Severity guide: CRITICAL = unsafe to drive / immediate danger (e.g. brake failure, smoke, overheating badly).
HIGH = vehicle likely undriveable. MEDIUM = drivable but needs prompt attention. LOW = minor issue.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      diagnosis: parsed.diagnosis ?? "Unable to determine a specific diagnosis from the description.",
      severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(parsed.severity)
        ? parsed.severity
        : "MEDIUM",
      recommendedSpecialization: SPECIALIZATIONS.includes(parsed.recommendedSpecialization)
        ? parsed.recommendedSpecialization
        : "General Mechanic",
      estimatedCostMin: Number(parsed.estimatedCostMin) || 500,
      estimatedCostMax: Number(parsed.estimatedCostMax) || 3000,
    };
  } catch {
    // AI failure shouldn't block an emergency request — degrade gracefully.
    return {
      diagnosis: "Automated diagnosis unavailable — a general mechanic will assess on arrival.",
      severity: "MEDIUM",
      recommendedSpecialization: "General Mechanic",
      estimatedCostMin: 500,
      estimatedCostMax: 3000,
    };
  }
}