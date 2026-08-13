// Shared helper for calling Groq's vision-capable model. Uses the same
// GROQ_API_KEY env var the existing AI-diagnostics chat feature already
// relies on — no new credential to set up.
//
// Model: qwen/qwen3.6-27b — Groq's current multimodal model as of this
// writing (Aug 2026). The original choice here, meta-llama/llama-4-scout-
// 17b-16e-instruct, was deprecated and retired by Groq shortly after this
// was first written — confirmed via a live 404 model_not_found error, then
// verified against Groq's own docs. If this starts failing the same way
// again, check https://console.groq.com/docs/vision (Groq's vision-specific
// docs page, more reliable than the general model list for this) for the
// current multimodal model id and swap it in below — nothing else in this
// file needs to change.
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

/**
 * Sends one image + a strict "JSON only" instruction prompt to Groq's vision
 * model and returns the parsed JSON. Throws if the model didn't return valid
 * JSON (happens occasionally with instruction-following models — caller
 * should catch and set status FAILED rather than let a bad parse crash the
 * request).
 *
 * @param imageDataUrl  a full data URI, e.g. "data:image/jpeg;base64,/9j/4AA..."
 * @param prompt        instructions — MUST tell the model to respond with
 *                       ONLY a JSON object/array, no markdown fences, no preamble
 */
export async function callGroqVision<T = unknown>(
  imageDataUrl: string,
  prompt: string,
): Promise<T> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0.1, // low temperature — this is an extraction task, not creative writing
      max_completion_tokens: 1024,
      // qwen3.6-27b is a reasoning model — by default it wraps its thinking
      // in <think>...</think> before the actual answer, which breaks the
      // JSON.parse below. reasoning_effort: "none" is the qwen3-family way
      // to fully disable that (confirmed 404'd without this — the model
      // was returning "<think> The user wants..." instead of JSON).
      // reasoning_format: "hidden" is kept as a second layer in case a
      // future Groq update changes what "none" does — Groq's own docs note
      // hidden/parsed are required alongside JSON mode/tool calls anyway.
      reasoning_effort: "none",
      reasoning_format: "hidden",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq vision request failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw: string | undefined = json?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq vision returned no content");

  const cleaned = stripMarkdownFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Groq vision didn't return valid JSON: ${cleaned.slice(0, 300)}`);
  }
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    // Defense in depth: reasoning_effort/reasoning_format above should
    // already prevent <think> blocks from qwen3.6-27b, but strip any that
    // slip through anyway rather than trust that fully — this exact model
    // has already surprised us once.
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/** Rough safety net so a huge phone photo doesn't blow past Groq's ~20MB image limit or eat the free tier fast. Caller should downscale before this if possible — this just guards the request. */
export function assertReasonableImageSize(imageDataUrl: string) {
  // base64 is ~4/3 the size of the raw bytes
  const approxBytes = (imageDataUrl.length * 3) / 4;
  const MAX_BYTES = 15 * 1024 * 1024; // 15MB, under Groq's documented 20MB cap
  if (approxBytes > MAX_BYTES) {
    throw new Error("Photo is too large — try retaking it at a lower resolution");
  }
}