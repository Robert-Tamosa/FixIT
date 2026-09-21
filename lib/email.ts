import { Resend } from "resend";

// Constructing Resend at module top level (the previous version of this
// file) runs the instant this module is imported — including during
// Next.js's build-time "page data collection" step for /api/auth/[...all],
// which imports auth.ts -> this file. If RESEND_API_KEY isn't present in
// Vercel's BUILD environment specifically (which can be scoped differently
// from its runtime/production environment), that top-level construction
// throws and crashes the entire build before the app ever runs — even
// though nothing at build time actually needs to send an email.
//
// Lazy singleton instead: the client is only constructed the first time
// one of the functions below actually runs, which only happens at request
// time, when RESEND_API_KEY is reliably available.
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set.");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// onboarding@resend.dev works without verifying a domain, but Resend
// restricts unverified-domain sending to only the email address your
// Resend account itself is registered under — same category of limitation
// as Twilio's trial-account verified-recipient restriction. Testing with
// your app's actual demo accounts (owner/mechanic/shop test emails) will
// need a verified domain in the Resend dashboard, or you'll only be able
// to receive at your own Resend account email until then.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "FixIT <onboarding@resend.dev>";

/**
 * Sends the 6-digit 2FA OTP code by email. Used as the sendOTP delivery
 * mechanism for Better Auth's twoFactor plugin (otpOptions.sendOTP).
 */
export async function sendOTPEmail(toEmail: string, otp: string): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: "Your FixIT verification code",
    text: `Your verification code is ${otp}. Valid for 10 minutes. Do NOT share this code with anyone.`,
  });
  if (error) throw new Error(error.message ?? "Resend failed to send the OTP email.");
}

/**
 * Sends the signup email-verification link. Used as
 * emailVerification.sendVerificationEmail in auth.ts.
 */
export async function sendSignupVerificationEmail(toEmail: string, url: string): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: "Verify your FixIT account",
    html: `<p>Welcome to FixIT — click below to verify your email address:</p>
           <p><a href="${url}">${url}</a></p>
           <p>If you didn't create this account, you can ignore this email.</p>`,
  });
  if (error) throw new Error(error.message ?? "Resend failed to send the verification email.");
}