import { MechanicSignupForm } from "@/components/mechanic-signup-form";

export default function MechanicSignupPage() {
  return (
    <>
      <div className="min-h-screen bg-[#080909] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="
        absolute -top-32 left-1/2 -translate-x-1/2
        w-[600px] h-[400px]
        bg-amber-400/[0.04]
        rounded-full
        blur-[100px]
      "
          />

          <div
            className="absolute inset-0 opacity-[0.018]"
            style={{
              backgroundImage:
                "radial-gradient(circle,#F59E0B 1px,transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 py-16">
          <MechanicSignupForm />
        </div>
      </div>
    </>
  );
}
