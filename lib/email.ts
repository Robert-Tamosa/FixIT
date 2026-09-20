import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY as string);

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
  const { error } = await resend.emails.send({
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
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: "Verify your FixIT account",
    html: `<p>Welcome to FixIT — click below to verify your email address:</p>
           <p><a href="${url}">${url}</a></p>
           <p>If you didn't create this account, you can ignore this email.</p>`,
  });
  if (error) throw new Error(error.message ?? "Resend failed to send the verification email.");
}