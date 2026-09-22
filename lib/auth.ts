import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { twoFactor } from "better-auth/plugins";
import { sendOTPEmail, sendSignupVerificationEmail } from "./email";
import { after } from "next/server";

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
      if (process.env.NODE_ENV === "development") {
        console.log(`\n📧 [FixIT DEV] Verification link for ${user.email}: ${url}\n`);
        return;
      }

      // Deliberately NOT awaited directly here — Better Auth's own docs
      // warn against awaiting an email send in this callback (a timing-
      // attack surface) and specifically call out serverless platforms as
      // needing waitUntil/after() so the function doesn't terminate before
      // the send actually finishes. On Vercel, an awaited fetch here can
      // get cut off mid-flight the moment the response goes out — a very
      // plausible silent cause behind "account created, but no email ever
      // arrives" even with fully correct Resend config on our end.
      //
      // Tradeoff: because this now runs AFTER the response is already
      // sent, a failure here can no longer surface back to the client as
      // an inline error — only this console.error, visible in Vercel's
      // function logs. Given the alternative was a send that could be
      // killed mid-flight with no logging at all, this is still the
      // better failure mode, just a different one to know about.
      after(async () => {
        try {
          await sendSignupVerificationEmail(user.email, url);
        } catch (err) {
          console.error("[email-verification] Resend send failed:", err);
        }
      });
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

          // Same after()-based fix as sendVerificationEmail above, and the
          // same tradeoff: a send failure here can no longer surface back
          // to authClient.twoFactor.sendOtp()'s `error` field, since this
          // runs after the response is already sent. Check Vercel's
          // function logs (this console.error) if a code seems to never
          // arrive despite the UI showing no error.
          after(async () => {
            try {
              await sendOTPEmail(user.email, otp);
            } catch (err) {
              console.error("[2FA] Resend email send failed:", err);
            }
          });
        },
      },
    }),
  ],
});