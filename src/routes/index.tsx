import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, BadgeCheck, UserRound, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0807] text-white">
      {/* Ambient orange glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,120,40,0.28),transparent_60%)] blur-2xl" />
        <div className="absolute bottom-0 right-0 size-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,80,40,0.18),transparent_60%)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 font-bold text-black shadow-[0_8px_24px_-8px_rgba(255,120,40,0.7)]">
            T
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">TalentFlow</div>
            <div className="text-[11px] text-white/50">Recruitment OS</div>
          </div>
        </div>
        <Link
          to="/login"
          className="hidden items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 backdrop-blur hover:bg-white/10 sm:inline-flex"
        >
          Sign in <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-180px)] max-w-3xl flex-col items-center justify-center px-6 pb-24 pt-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400">
          <BadgeCheck className="size-3.5" /> AI-Powered Recruitment OS
        </div>

        <h1 className="mx-auto mt-7 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Hire smarter.
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
            Together.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-white/65 md:text-lg">
          One workspace where recruitment agencies and their clients move every role from open to placed.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            to="/login"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 px-7 py-3.5 text-sm font-semibold text-black shadow-[0_12px_30px_-10px_rgba(255,120,40,0.8)] transition hover:brightness-110 sm:w-auto"
          >
            I&apos;m agency
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
          >
            <UserRound className="size-4" />
            I'm a recruiter
          </Link>
          <Link
            to="/client/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
          >
            <Building2 className="size-4" />
            I'm a client
          </Link>
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
          >
            <ShieldCheck className="size-4" />
            Super Admin
          </Link>
        </div>

        <p className="mt-8 text-xs text-white/40">
          Choose your portal · switch anytime
        </p>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} TalentFlow · Built for recruitment agencies and the clients they serve.
      </footer>
    </div>
  );
}
