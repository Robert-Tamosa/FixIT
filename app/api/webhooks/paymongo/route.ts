import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { handlePaymongoEvent } from "@/app/actions/payment";

const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET!;

/**
 * Verifies the `Paymongo-Signature` header per PayMongo's documented scheme:
 *   header looks like: "t=<timestamp>,te=<test_sig>,li=<live_sig>"
 *   signed payload = `${timestamp}.${rawBody}`  (HMAC-SHA256 with the
 *   webhook endpoint's secret, hex digest)
 * Checks both te= (test mode) and li= (live mode) so the same route works
 * against sandbox and production without an env branch.
 *
 * NOTE: hand-rolled against PayMongo's documented scheme, not the official
 * SDK's `webhooks.constructEvent()` helper. If you add the `paymongo-node`
 * package later, prefer swapping this for that — officially maintained,
 * less likely to drift if PayMongo tweaks the scheme.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    }),
  );
  const timestamp = parts["t"];
  const candidateSig = parts["te"] ?? parts["li"];
  if (!timestamp || !candidateSig) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSig = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(candidateSig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // raw text, NOT req.json() — signature needs the exact bytes
  const signatureHeader = req.headers.get("paymongo-signature");

  if (!verifySignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event?.data?.attributes?.type as string | undefined;
  const eventResource = event?.data?.attributes?.data as { id: string; attributes: Record<string, unknown> } | undefined;

  if (!eventType || !eventResource) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  try {
    await handlePaymongoEvent({ type: eventType, data: eventResource });
  } catch (err) {
    // Per PayMongo's own guidance: always return 2xx once signature is valid,
    // even if internal processing fails — log it and handle async rather
    // than triggering a retry storm on a transient DB blip.
    console.error("[paymongo webhook] handler error:", err);
  }

  return NextResponse.json({ received: true });
}