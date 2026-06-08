import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Routes that do NOT require authentication.
 * Keep /setup-2fa here so logged-in users without 2FA can still reach it.
 */
const PUBLIC_PATHS = [
  "/",
  "/signIn",
  "/signUp",
  "/mechanicSignUp",
  "/verify-otp",
  "/setup-2fa",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // No session cookie → send to login
  const session = getSessionCookie(req);
  if (!session) {
    const signInUrl = new URL("/signIn", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname); // preserve intended destination
    return NextResponse.redirect(signInUrl);
  }

  // NOTE: We cannot check twoFactorEnabled here because middleware runs on
  // the edge and cannot query the database. That check lives in
  // app/dashboard/layout.tsx (a Server Component) instead.
  return NextResponse.next();
}

export const config = {
  // Protect everything except Next.js internals, static files, and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};