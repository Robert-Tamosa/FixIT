import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID as string,
  process.env.TWILIO_AUTH_TOKEN as string
);

/**
 * Sends an SMS OTP to the given phone number via Twilio.
 * @param toPhone - E.164 format, e.g. "+639171234567"
 * @param otp     - 6-digit OTP string
 */
export async function sendOTPViaSMS(toPhone: string, otp: string): Promise<void> {
  await client.messages.create({
    body: `[FixIT] Your verification code is ${otp}. Valid for 10 minutes. Do NOT share this code.`,
    from: process.env.TWILIO_PHONE_NUMBER as string,
    to: toPhone,
  });
}
