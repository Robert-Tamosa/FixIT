// Deliberately static: no auth check, no cookies/session read, no database
// call. That's not a style choice — it's what makes this precachable at
// build time via additionalPrecacheEntries in next.config.ts. Anything that
// makes this route dynamic (calling headers(), cookies(), or a per-request
// prisma call) breaks the offline guarantee, since Next can't prerender a
// dynamic route into static HTML for the service worker to precache.

export const dynamic = "force-static";

const EMERGENCY_NUMBERS: { label: string; number: string }[] = [
  { label: "National Emergency Hotline", number: "911" },
  { label: "PNP Hotline",                number: "117" },
  { label: "Philippine Red Cross",       number: "143" },
];

const SAFETY_STEPS: { title: string; body: string }[] = [
  {
    title: "Move off the road",
    body:  "Get the vehicle as far onto the shoulder or a safe area as possible. If you can't move it, stay inside with your seatbelt on rather than standing near traffic.",
  },
  {
    title: "Turn on hazard lights",
    body:  "Hazards on immediately, day or night. If you have a warning triangle or reflective device, place it about 30 meters behind the vehicle.",
  },
  {
    title: "Stay visible, stay safe",
    body:  "If you exit the vehicle, stay on the side away from traffic. At night or in low visibility, wear or hold something reflective if you have it.",
  },
  {
    title: "Call for help",
    body:  "Use the emergency numbers below if it's a safety situation, or open FixIT once you're back online to request a mechanic.",
  },
];

const TIRE_CHANGE_STEPS: string[] = [
  "Loosen the lug nuts slightly BEFORE jacking the car up — it's much harder once the wheel can spin freely.",
  "Place the jack under the vehicle's reinforced jack point (check your manual — not just anywhere on the frame).",
  "Raise the vehicle until the flat tire is a few centimeters off the ground.",
  "Remove the lug nuts fully, then the flat tire.",
  "Mount the spare, hand-tighten the lug nuts in a star pattern (not going around in a circle).",
  "Lower the vehicle back down, then fully tighten the lug nuts in the same star pattern.",
  "Drive cautiously to a shop — most spare tires are only rated for short distances at reduced speed.",
];

const JUMP_START_STEPS: string[] = [
  "Park the working vehicle close enough for the cables to reach, engines off, both in park/neutral with parking brakes on.",
  "Connect red (positive) clamp to the dead battery's positive terminal.",
  "Connect the other red clamp to the working battery's positive terminal.",
  "Connect black (negative) clamp to the working battery's negative terminal.",
  "Connect the final black clamp to an unpainted metal surface on the dead car's engine block — NOT the dead battery's negative terminal.",
  "Start the working vehicle, let it run a couple minutes, then try starting the dead vehicle.",
  "If it starts, leave both running for a few minutes before disconnecting cables in reverse order.",
];

export default function EmergencyGuidePage() {
  return (
    <div className="min-h-screen w-full bg-[#080909]">
      <div className="w-full max-w-lg mx-auto p-4 pb-16">

        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold
            text-emerald-400 bg-emerald-400/10 border border-emerald-400/20
            px-2.5 py-1 rounded-full mb-3">
            Works without internet
          </span>
          <h1 className="text-xl font-black text-zinc-100">Emergency Guide</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Basic roadside safety steps and emergency numbers — available even with no signal.
          </p>
        </div>

        {/* Emergency numbers */}
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-4 mb-5">
          <p className="text-sm font-semibold text-red-300 mb-3">Emergency Numbers (Philippines)</p>
          <div className="space-y-2">
            {EMERGENCY_NUMBERS.map((n) => (
              <a
                key={n.number}
                href={`tel:${n.number}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl
                  bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] transition-colors">
                <span className="text-sm text-zinc-300">{n.label}</span>
                <span className="text-sm font-bold text-red-300">{n.number}</span>
              </a>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2.5 leading-relaxed">
            Calling still requires signal — these numbers are just saved here so you don't need
            data to look them up.
          </p>
        </div>

        {/* Safety steps */}
        <div className="mb-5">
          <p className="text-sm font-semibold text-zinc-100 mb-3">If You Break Down</p>
          <div className="space-y-2.5">
            {SAFETY_STEPS.map((step, i) => (
              <div key={step.title}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="w-6 h-6 rounded-full bg-amber-400/15 border border-amber-400/30
                    flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold text-zinc-100">{step.title}</p>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed pl-8.5">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tire change */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 mb-5">
          <p className="text-sm font-semibold text-zinc-100 mb-3">Changing a Flat Tire</p>
          <ol className="space-y-2">
            {TIRE_CHANGE_STEPS.map((step, i) => (
              <li key={step} className="flex gap-2.5 text-xs text-zinc-400 leading-relaxed">
                <span className="text-amber-400 font-bold shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Jump start */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-zinc-100 mb-3">Jump-Starting a Battery</p>
          <ol className="space-y-2">
            {JUMP_START_STEPS.map((step, i) => (
              <li key={step} className="flex gap-2.5 text-xs text-zinc-400 leading-relaxed">
                <span className="text-amber-400 font-bold shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed">
            Order matters — always connect the last black clamp to bare metal on the engine, not
            the dead battery, to avoid sparking near battery gases.
          </p>
        </div>

      </div>
    </div>
  );
}