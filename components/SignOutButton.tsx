"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      className="
        w-full
        rounded-3xl
        bg-gradient-to-r
        from-red-600
        to-pink-600
        px-5
        py-4
        text-white
        font-semibold
        transition-all
        duration-200
        hover:scale-[1.01]
        hover:from-red-500
        hover:to-pink-500
        shadow-lg
        shadow-red-500/20
      "
    >
      Sign Out
    </button>
  );
}