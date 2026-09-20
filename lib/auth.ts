import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { twoFactor } from "better-auth/plugins";
import { sendOTPEmail, sendSignupVerificationEmail } from "./email";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    "http://localhost:3000",
    process.env.BETTER_AUTH_URL ?? "",
  ].filter(Boolean),
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

  // ── Email verification ──────────────────────────────────────────────────
  // requireEmailVerification blocks password sign-in entirely until the
  // email is verified. sendOnSignIn is the safety net for existing accounts
  // that were created before this was turned on: instead of silently
  // locking them out with no path forward, Better Auth automatically fires
  // a fresh verification email the moment they attempt to sign in.
  // Social sign-in (Google/Facebook) is NOT gated by this setting — it has
  // its own separate per-provider opt-in, left off here since those
  // providers already verify the email themselves.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendSignupVerificationEmail(user.email, url);
    },
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
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

  // ── Mandatory 2FA — currently scoped to OWNER only ──────────────────────
  // Forcing twoFactorEnabled: true directly (rather than requiring each
  // user to call twoFactor.enable()) is the documented approach for
  // OTP-only enforcement — no TOTP secret or `twoFactor` table row is
  // needed for the OTP method, only the flag itself.
  //
  // TEMPORARY SCOPING: only OWNER accounts get this right now, because
  // Resend's unverified-domain restriction means only the email matching
  // your own Resend account can receive anything — MECHANIC/SHOP_OWNER/
  // ADMIN accounts would just fail to receive their OTP regardless of this
  // flag. Once a domain is verified in Resend, change the condition below
  // back to unconditional (`twoFactorEnabled: true`) — and decide
  // deliberately whether every role should require 2FA before this ships
  // for real, rather than leaving this test-driven scoping as the
  // permanent security posture by accident.
  //
  // IMPORTANT: spreading ...user here, not constructing a fresh object —
  // Better Auth has a known issue where a hook that omits fields from its
  // returned `data` can cause Prisma to error on the omitted ones.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              twoFactorEnabled: user.role === "OWNER",
            },
          };
        },
      },
    },
  },

  plugins: [
    twoFactor({
      otpOptions: {
        // Matches the "Valid for 10 minutes" wording hardcoded into the
        // email body in email.ts. Better Auth's own default is 3 minutes.
        period: 10,
        async sendOTP({ user, otp }) {
          if (process.env.NODE_ENV === "development") {
            console.log(`\n🔐 [FixIT DEV] OTP for ${user.email}: ${otp}\n`);
            return;
          }

          try {
            await sendOTPEmail(user.email, otp);
          } catch (err) {
            // Rethrown, not swallowed — Better Auth surfaces this as the
            // `error` returned from authClient.twoFactor.sendOtp(). Logged
            // here too since the client-facing message is deliberately
            // generic (avoids leaking Resend error internals to the user).
            console.error("[2FA] Resend email send failed:", err);
            throw new Error("Couldn't send the verification code — try again.");
          }
        },
      },
    }),
  ],
});