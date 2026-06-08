// import { auth }    from "@/lib/auth";
// import { headers }  from "next/headers";
// import { redirect } from "next/navigation";
// import Enable2FA    from "@/components/auth/Enable2FA";

// export const metadata = { title: "Set Up 2FA — FixIT" };

// export default async function Setup2FAPage() {
//   const session = await auth.api.getSession({
//     headers: await headers(),
//   });

//   // Middleware already handles unauthenticated users, but guard here too
//   if (!session) redirect("/signIn");

//   // If 2FA is already active, send straight to dashboard
//   if (session.user.twoFactorEnabled) redirect("/dashboard");

//   return (
//     <div className="min-h-screen bg-[#0A0B0E] flex items-center justify-center p-6">
//       <div className="w-full max-w-md space-y-6">

//         {/* Header */}
//         <div className="text-center">
//           <div className="flex items-center justify-center gap-2 mb-5">
//             <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
//               <circle cx="15" cy="15" r="15" fill="#F59E0B" fillOpacity="0.12" />
//               <path d="M15 7L8 10V15.5C8 19.8 11 23.8 15 25C19 23.8 22 19.8 22 15.5V10L15 7Z"
//                 fill="#F59E0B" fillOpacity="0.25" stroke="#F59E0B" strokeWidth="1.2" strokeLinejoin="round" />
//               <path d="M11.5 15.5L14 18L19 13"
//                 stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//             </svg>
//             <span className="text-[22px] font-bold tracking-tight text-zinc-100">
//               Fix<span className="text-amber-400">IT</span>
//             </span>
//           </div>
//           <h1 className="text-xl font-bold text-zinc-100 mb-2">
//             One last step
//           </h1>
//           <p className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">
//             FixIT requires two-factor authentication for all accounts.
//             Set it up below to access your dashboard.
//           </p>
//         </div>

//         {/* Enable 2FA card */}
//         <Enable2FA session={session} />

//       </div>
//     </div>
//   );
// }
