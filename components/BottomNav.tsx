"use client";

import { useRouter, usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard/owner",
    icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  },
  {
    label: "Bookings",
    href: "/dashboard/owner/bookings",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
  },
  {
    label: "Chats",
    href: "/dashboard/owner/chats",
    icon: "M2.003 5.884L10 12.882l7.997-6.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z M2 6.118v7.764A2 2 0 0 0 4 16h12a2 2 0 0 0 2-2V6.118l-8 7-8-7z",
  },
  {
    label: "Profile",
    href: "/dashboard/owner/profile",
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Active tab derived from the real URL, not click-tracked state — the
  // old version used useState("Home") set only on click, so a fresh page
  // load (or back/forward navigation) always showed Home as active
  // regardless of the actual current route, until you clicked something
  // else in that session.
  function isActive(href: string) {
    // Exact match for Home specifically — every other tab's route is
    // nested under it (/dashboard/owner is a literal prefix of
    // /dashboard/owner/bookings etc.), so prefix-matching alone would make
    // Home look active on every single owner page.
    if (href === "/dashboard/owner") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50
      bg-[#080909]/95 backdrop-blur-xl border-t border-white/[0.06]">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-3 pb-5">
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const active = isActive(href);
          return (
            <button
              key={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => router.push(href)}
              className="flex flex-col items-center gap-1.5 px-4 py-1 rounded-xl transition-all active:scale-95">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? "#F59E0B" : "#52525B"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true">
                <path d={icon} />
              </svg>
              <span
                className={`text-[10px] font-medium leading-none ${active ? "text-amber-400" : "text-zinc-600"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}