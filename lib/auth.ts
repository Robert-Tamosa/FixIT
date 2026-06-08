import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { twoFactor } from "better-auth/plugins";
import { sendOTPViaSMS } from "./twilio";

console.log("Google ID exists:", !!process.env.GOOGLE_CLIENT_ID);
console.log("Google Secret exists:", !!process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  logger: {
    level: "debug",
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    },
  },
  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          if (process.env.NODE_ENV === "development") {
            // DEV: check your Next.js terminal for the code — no SMS sent
            console.log(`\n🔐 [FixIT DEV] OTP for ${user.email}: ${otp}\n`);
          } else {
            const phone = (user as { phone?: string | null }).phone;
            if (!phone) throw new Error("No phone number on file.");
            await sendOTPViaSMS(phone, otp);
          }
        },
      },
    }),
  ],
});
