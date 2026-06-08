"use client";

import Link from "next/link";

export default function LandingPage() {
return ( <div className="min-h-screen bg-[#080909] text-zinc-100 overflow-hidden">

  {/* Ambient Background */}
  <div className="pointer-events-none absolute inset-0">
    <div
      className="
      absolute top-0 left-1/2 -translate-x-1/2
      w-[900px] h-[500px]
      bg-amber-400/[0.05]
      rounded-full blur-[140px]
    "
    />

    <div
      className="absolute inset-0 opacity-[0.02]"
      style={{
        backgroundImage:
          "radial-gradient(circle,#F59E0B 1px,transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
  </div>

  {/* navbar */}
  <nav className="relative z-20 border-b border-white/[0.06]">
    <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">

      <h1 className="text-3xl font-black">
        Fix<span className="text-amber-400">IT</span>
      </h1>

      <div className="flex items-center gap-4">
        <Link
          href="/signIn"
          className="
            px-5 py-2.5
            text-zinc-400
            hover:text-zinc-100
            transition
          "
        >
          Sign In
        </Link>

        <Link
          href="/signUp"
          className="
            px-5 py-2.5
            rounded-xl
            bg-amber-400
            text-[#080909]
            font-semibold
          "
        >
          Sign Up
        </Link>
      </div>
    </div>
  </nav>

  {/* Hero */}
  <section className="relative z-10">
    <div className="max-w-7xl mx-auto px-8 py-24">

      <div className="grid lg:grid-cols-2 gap-20 items-center">

        <div>

          <span
            className="
            inline-flex items-center
            px-4 py-2
            rounded-full
            bg-amber-400/10
            border border-amber-400/20
            text-amber-300
            text-sm
          "
          >
            Vehicle Diagnostics Platform
          </span>

          <h1
            className="
            mt-8
            text-6xl lg:text-7xl
            font-black
            leading-tight
          "
          >
            Diagnose.
            <br />
            Track.
            <br />
            Repair.
          </h1>

          <p
            className="
            mt-8
            text-xl
            text-zinc-400
            max-w-xl
            leading-relaxed
          "
          >
            FixIT helps vehicle owners identify issues,
            connect with mechanics, track repairs,
            and manage maintenance records from one platform.
          </p>

          <div className="mt-10 flex gap-4">

            <Link
              href="/signUp"
              className="
                px-8 py-4
                rounded-2xl
                bg-amber-400
                text-[#080909]
                font-bold
              "
            >
              Get Started
            </Link>

            <Link
              href="#features"
              className="
                px-8 py-4
                rounded-2xl
                border border-white/10
                bg-white/[0.03]
              "
            >
              Learn More
            </Link>

          </div>
        </div>

        {/* Dashboard Mockup */}
        <div
          className="
          rounded-[36px]
          border border-white/10
          bg-white/[0.03]
          backdrop-blur-xl
          p-8
        "
        >
          <div className="grid gap-4">

            <div className="rounded-3xl border border-white/10 p-6">
              <p className="text-zinc-500 text-sm">
                Vehicle Health
              </p>
              <h3 className="text-4xl font-black mt-2">
                92%
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div className="rounded-3xl border border-white/10 p-6">
                <h4 className="font-bold">
                  Diagnostics
                </h4>
                <p className="mt-2 text-zinc-500">
                  AI-assisted issue detection
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 p-6">
                <h4 className="font-bold">
                  Tracking
                </h4>
                <p className="mt-2 text-zinc-500">
                  Live repair progress
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  </section>

  {/* Features */}
  <section
    id="features"
    className="relative z-10 py-24"
  >
    <div className="max-w-7xl mx-auto px-8">

      <h2 className="text-5xl font-black text-center">
        Everything you need
      </h2>

      <p className="text-zinc-500 text-center mt-4">
        Designed for vehicle owners and mechanics.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">

        {[
          "AI Diagnostics",
          "Repair Tracking",
          "Booking System",
          "Maintenance Records",
        ].map((item) => (
          <div
            key={item}
            className="
              rounded-3xl
              border border-white/10
              bg-white/[0.03]
              p-8
            "
          >
            <h3 className="font-bold text-xl">
              {item}
            </h3>

            <p className="mt-3 text-zinc-500">
              Streamlined workflow and
              better vehicle management.
            </p>
          </div>
        ))}

      </div>

    </div>
  </section>

  {/* CTA */}
  <section className="relative z-10 pb-24">
    <div className="max-w-5xl mx-auto px-8">

      <div
        className="
        rounded-[40px]
        border border-white/10
        bg-white/[0.03]
        p-16
        text-center
      "
      >
        <h2 className="text-5xl font-black">
          Ready to get started?
        </h2>

        <p className="text-zinc-500 mt-4">
          Join FixIT today and simplify vehicle maintenance.
        </p>

        <Link
          href="/signUp"
          className="
            inline-flex
            mt-8
            px-8 py-4
            rounded-2xl
            bg-amber-400
            text-[#080909]
            font-bold
          "
        >
          Create Account
        </Link>
      </div>

    </div>
  </section>

</div>
);
}
