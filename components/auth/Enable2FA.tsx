// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { authClient } from "@/lib/auth-client";

// interface Enable2FAProps {
//   session: {
//     user?: {
//       twoFactorEnabled?: boolean | null; // Prisma returns null, not undefined, for missing booleans
//     };
//   } | null;
// }

// export default function Enable2FA({ session }: Enable2FAProps) {
//   const router = useRouter();
//   const [password, setPassword]       = useState("");
//   const [loading, setLoading]         = useState(false);
//   const [error, setError]             = useState("");
//   const [justEnabled, setJustEnabled] = useState(false);

//   const isEnabled = session?.user?.twoFactorEnabled || justEnabled;

//   async function handleEnable(): Promise<void> {
//     if (!password) { setError("Please enter your password."); return; }
//     setLoading(true);
//     setError("");

//     const { error } = await authClient.twoFactor.enable({ password });

//     if (error) {
//       setError(error.message ?? "Failed to enable 2FA. Please try again.");
//       setLoading(false);
//     } else {
//       setJustEnabled(true);
//       setLoading(false);
//       setPassword("");
//       // Redirect to dashboard — layout will now allow access since 2FA is enabled
//       router.push("/dashboard");
//     }
//   }

//   // ── Already enabled ──────────────────────────────────────────────────────
//   if (isEnabled) {
//     return (
//       <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
//         <div className="flex items-center gap-3 mb-1">
//           <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
//             <path d="M10 2L4 4.5V10C4 14.1 6.8 17.9 10 19C13.2 17.9 16 14.1 16 10V4.5L10 2Z"
//               fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1.2" />
//             <path d="M7 10L9.2 12.2L13 8" stroke="#F59E0B" strokeWidth="1.4"
//               strokeLinecap="round" strokeLinejoin="round" />
//           </svg>
//           <span className="font-semibold text-amber-400 text-sm">
//             Two-factor authentication is active
//           </span>
//         </div>
//         <p className="text-zinc-400 text-sm pl-8">
//           Your account is protected. You&apos;ll receive a 6-digit SMS code every time you sign in.
//         </p>
//       </div>
//     );
//   }

//   // ── Not yet enabled ──────────────────────────────────────────────────────
//   return (
//     <div className="rounded-xl border border-white/[0.07] bg-[#12141A] p-5 space-y-4">
//       <div>
//         <h3 className="font-semibold text-zinc-100 text-sm mb-1">
//           Enable Two-Factor Authentication
//         </h3>
//         <p className="text-zinc-400 text-sm leading-relaxed">
//           Protect your account with SMS verification. Each time you sign in,
//           you&apos;ll receive a one-time code on your registered phone number.
//         </p>
//       </div>

//       <div className="space-y-2">
//         <label htmlFor="2fa-password" className="text-xs text-zinc-400">
//           Confirm your password to continue
//         </label>
//         <input
//           id="2fa-password"
//           type="password"
//           placeholder="Enter your password"
//           value={password}
//           onChange={(e) => { setPassword(e.target.value); setError(""); }}
//           onKeyDown={(e) => { if (e.key === "Enter") void handleEnable(); }}
//           disabled={loading}
//           className="w-full px-3.5 py-2.5 rounded-lg border border-white/10 bg-[#1A1D26]
//             text-zinc-100 text-sm placeholder:text-zinc-600 outline-none
//             focus:border-amber-400/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)]
//             disabled:opacity-50 transition-all duration-150"
//         />
//       </div>

//       {error && (
//         <p role="alert" className="flex items-center gap-2 text-[13px] text-orange-400">
//           <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
//             <circle cx="8" cy="8" r="7" stroke="#FB923C" strokeWidth="1.3" />
//             <path d="M8 5V8.5M8 11H8.01" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
//           </svg>
//           {error}
//         </p>
//       )}

//       <button
//         onClick={() => void handleEnable()}
//         disabled={loading || !password}
//         className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300
//           text-[#0A0B0E] font-semibold text-sm
//           transition-all duration-150 active:scale-[0.98]
//           disabled:opacity-40 disabled:cursor-not-allowed
//           flex items-center justify-center gap-2"
//       >
//         {loading ? (
//           <span aria-hidden="true"
//             className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
//         ) : (
//           "Enable 2FA"
//         )}
//       </button>
//     </div>
//   );
// }
