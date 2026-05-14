import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, User, BadgeCheck, Sparkles, Workflow, CalendarClock } from "lucide-react";

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
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a href="#product" className="hover:text-white">Product</a>
          <a href="#workflow" className="hover:text-white">Workflow</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <Link
          to="/dashboard"
          className="hidden items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 backdrop-blur hover:bg-white/10 sm:inline-flex"
        >
          Sign in <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-16 text-center md:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400">
          <BadgeCheck className="size-3.5" /> AI-Powered Recruitment OS
        </div>

        <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          The recruitment platform
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
            built for agencies.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-white/65 md:text-lg">
          Source, screen, schedule and place candidates 10× faster — with one workspace your whole team
          actually uses every day.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 px-7 py-3.5 text-sm font-semibold text-black shadow-[0_12px_30px_-10px_rgba(255,120,40,0.8)] transition hover:brightness-110"
          >
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            Enter workspace
          </Link>
          <Link
            to="/client"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            <Building2 className="size-4" />
            I'm a client
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            <User className="size-4" />
            I'm a candidate
          </button>
        </div>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Manage owners, managers, recruiters and freelancers under{" "}
          <span className="text-orange-400">employees</span> inside the workspace.
        </p>

        {/* Feature trio */}
        <div id="product" className="mx-auto mt-20 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {[
            { icon: Sparkles, title: "AI Talent Scout", body: "Ranks candidates against your JD in seconds." },
            { icon: Workflow, title: "Pipeline OS", body: "Drag-drop stages from sourced to placed." },
            { icon: CalendarClock, title: "Smart Scheduling", body: "Coordinate panel + candidate availability." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-orange-500/30 hover:bg-white/[0.05]"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-orange-500/15 text-orange-400">
                <f.icon className="size-4" />
              </div>
              <div className="mt-4 font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-white/60">{f.body}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} TalentFlow · Built for recruitment agencies and the clients they serve.
      </footer>
    </div>
  );
}
