import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// injectionPoint must stay exactly this string — @serwist/next's build step
// looks for it verbatim to know where to splice in the generated precache
// manifest (JS/CSS chunks, etc). Don't rename or reformat this line.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache gives Next.js's own static assets, images, and fonts
  // sensible runtime caching out of the box (the standard Serwist/Next
  // recipe). The emergency guide's actual precaching happens via
  // additionalPrecacheEntries in next.config.ts, not here — that's what
  // guarantees the page is available on FIRST load with no network at all,
  // not just on a second visit after a runtime cache warms up.
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();