import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  // Next.js 16 defaults to Turbopack and refuses to start when it sees a
  // webpack() config function (which withSerwistInit below always injects)
  // with no corresponding turbopack key — it can't tell if that's
  // intentional. An empty object here satisfies that check. This doesn't
  // make Serwist itself Turbopack-compatible — dev mode still just runs
  // with Turbopack and no service worker at all, same as before, since
  // `disable: NODE_ENV === "development"` already turns Serwist off there.
  turbopack: {},
};

// Vercel sets this automatically on every build — used purely to version the
// precache entry below so a redeploy invalidates the cached emergency-guide
// HTML instead of serving a stale copy forever. Falls back to a fresh UUID
// for local builds where that env var isn't set, so caching still works,
// just without cross-build stability (fine for local dev).
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

const isDev = process.env.NODE_ENV === "development";

// Calling withSerwistInit(...) itself — not just applying the wrapper it
// returns — is what triggers @serwist/next's own "doesn't support
// Turbopack" warning under `next dev`. Guarding only the usage (previous
// version of this file) wasn't enough; the call has to be skipped too, so
// the whole thing lives inside this branch rather than at module top level.
export default isDev
  ? nextConfig
  : withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      cacheOnNavigation: true,
      disable: false, // this branch only runs when NOT dev, so always false here
      // This is the actual guarantee that /emergency-guide works with zero
      // network on first load — not just after a second visit warms a
      // runtime cache. The page must be a fully static route (no auth
      // check, no per-request data) for this to precache correctly.
      additionalPrecacheEntries: [
        { url: "/emergency-guide", revision },
      ],
    })(nextConfig);