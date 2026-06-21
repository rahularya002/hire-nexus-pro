import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Megaphone, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/sourcing/")({
  component: () => (
    <AppShell>
      <SourcingHub />
    </AppShell>
  ),
});

function SourcingHub() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sourcing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bring candidates into your pipeline — by hunting them down or by broadcasting your role.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Link
          to="/scout"
          className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/60 hover:shadow-md transition relative overflow-hidden"
        >
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br from-primary/15 to-purple/15 blur-2xl" />
          <div className="relative">
            <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Sparkles className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">AI Scouting</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Auto-source matched candidates from LinkedIn, Naukri, GitHub and your internal DB. Best for niche or
              passive-talent roles where you want to reach out yourself.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Open scout <ArrowRight className="size-4 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </Link>

        <Link
          to="/posting"
          className="group rounded-2xl border border-border bg-card p-6 hover:border-info/60 hover:shadow-md transition relative overflow-hidden"
        >
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br from-info/15 to-success/15 blur-2xl" />
          <div className="relative">
            <div className="size-11 rounded-xl bg-info/10 text-info grid place-items-center">
              <Megaphone className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Job Posting</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Publish a job to LinkedIn, Naukri, Indeed and your own careers page in one click. Inbound applicants land
              straight in your pipeline.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-info">
              Open posting <ArrowRight className="size-4 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}