import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarClock, Video, MapPin, Users } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { clientPositions } from "@/lib/client-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/interviews")({
  component: () => <ClientShell><Page /></ClientShell>,
});

type Tab = "today" | "upcoming" | "past";

interface Row {
  id: string;
  date: string;
  time: string;
  candidate: string;
  initials: string;
  positionId: string;
  positionTitle: string;
  panel: string;
  mode: string;
  bucket: Tab;
}

const ROWS: Row[] = [
  { id: "i1", date: "Today",   time: "10:30 AM", candidate: "Arjun Malhotra",  initials: "AM", positionId: "cp-1", positionTitle: "Head of E-commerce",         panel: "Vikram Shah + Anita Desai", mode: "Google Meet", bucket: "today" },
  { id: "i2", date: "Today",   time: "3:00 PM",  candidate: "Sneha Kulkarni",  initials: "SK", positionId: "cp-1", positionTitle: "Head of E-commerce",         panel: "Vikram Shah + Rohit Bal",   mode: "On-site, BKC", bucket: "today" },
  { id: "i3", date: "May 16",  time: "11:00 AM", candidate: "Karan Verma",     initials: "KV", positionId: "cp-1", positionTitle: "Head of E-commerce",         panel: "Tech Round — Anish",        mode: "Zoom",         bucket: "upcoming" },
  { id: "i4", date: "May 17",  time: "11:30 AM", candidate: "Sneha Kulkarni",  initials: "SK", positionId: "cp-1", positionTitle: "Head of E-commerce",         panel: "CEO Round",                 mode: "On-site, BKC", bucket: "upcoming" },
  { id: "i5", date: "May 18",  time: "4:00 PM",  candidate: "Ishita Banerjee", initials: "IB", positionId: "cp-2", positionTitle: "Visual Merchandiser",        panel: "Brand panel",               mode: "Google Meet", bucket: "upcoming" },
  { id: "i6", date: "May 09",  time: "11:00 AM", candidate: "Rahul Pillai",    initials: "RP", positionId: "cp-3", positionTitle: "Boutique Manager — Bandra",  panel: "Store Director",            mode: "On-site",      bucket: "past" },
  { id: "i7", date: "May 06",  time: "5:00 PM",  candidate: "Karan Verma",     initials: "KV", positionId: "cp-1", positionTitle: "Head of E-commerce",         panel: "Screening — Aarav",         mode: "Zoom",         bucket: "past" },
];

function Page() {
  const [tab, setTab] = useState<Tab>("today");
  const rows = ROWS.filter((r) => r.bucket === tab);
  const counts = { today: ROWS.filter(r=>r.bucket==="today").length, upcoming: ROWS.filter(r=>r.bucket==="upcoming").length, past: ROWS.filter(r=>r.bucket==="past").length };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Calendar</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" /> Interviews
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All scheduled candidate interviews across your requirements.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
        {([
          { id: "today",    label: `Today (${counts.today})` },
          { id: "upcoming", label: `Upcoming (${counts.upcoming})` },
          { id: "past",     label: `Past (${counts.past})` },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition",
              tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No interviews in this view.</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center gap-4 hover:bg-secondary/40 transition flex-wrap">
            <div className="text-center shrink-0 w-16">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.date}</div>
              <div className="text-base font-semibold text-primary tabular-nums">{r.time}</div>
            </div>
            <div className="size-10 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
              {r.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.candidate}</div>
              <Link to="/client/positions/$positionId" params={{ positionId: r.positionId }}
                className="text-xs text-muted-foreground hover:text-primary truncate block">
                {r.positionTitle}
              </Link>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-1"><Users className="size-3" />{r.panel}</span>
                <span className="inline-flex items-center gap-1">
                  {r.mode.toLowerCase().includes("on-site") ? <MapPin className="size-3" /> : <Video className="size-3" />}
                  {r.mode}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.bucket === "past" ? (
                <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                  Submit feedback
                </button>
              ) : (
                <>
                  <button className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary">
                    Reschedule
                  </button>
                  <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1">
                    <Video className="size-3.5" /> Join
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}