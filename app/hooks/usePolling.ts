"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the server for fresh data by calling router.refresh() on an interval.
 * router.refresh() re-runs the current route's Server Components (re-fetching
 * from the DB) without a full page reload — client-only state (open modals,
 * scroll position, etc.) is preserved.
 *
 * IMPORTANT: this alone does NOT update state that was copied into a
 * useState on mount (e.g. `useState(initialActiveJob)`) — React ignores new
 * values passed to useState after the first render. Any component using
 * this hook also needs a companion effect syncing its local state to the
 * incoming prop:
 *
 *   useEffect(() => { setActiveJob(initialActiveJob); }, [initialActiveJob]);
 *
 * Pass a shorter interval for screens where fast feedback matters (e.g. an
 * emergency request waiting on mechanic response) and a longer one for less
 * time-sensitive views, to keep DB load reasonable.
 */
export function usePolling(intervalMs: number = 6000) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      // Don't poll while the tab is backgrounded — no point re-fetching for
      // a screen nobody's looking at, and it cuts unnecessary DB load.
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);
}