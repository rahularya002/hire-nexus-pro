/**
 * "Needs your call" queue. The point of this screen is that a recruiter with
 * fifteen minutes can finish it: strongest items first, band filters, search,
 * multi-select and bulk decisions.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileText, Loader2, Search, Sparkles, Wand2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KIND_LABEL, OutcomeBadge, relTime, txt } from "@/components/email-archive/shared";
import {
  approveReviewItem,
  bulkReviewDecision,
  listReviewQueue,
  rejectReviewItem,
  retriageReviewQueue,
} from "@/lib/email-import.functions";

const PAGE = 50;

type Band = "all" | "likely" | "borderline" | "weak";

const CHIPS = [
  { key: "resume", label: "Has resume" },
  { key: "mine", label: "Only my inbox" },
  { key: "recent", label: "Last 12 months" },
] as const;

function whyChip(reason: string | null, hasResume: boolean) {
  const r = txt(reason) ?? "";
  if (!hasResume || /no resume/i.test(r)) return "No resume attached — profile may be in the body";
  if (/uncertain|possible|might|unclear/i.test(r)) return "Signals conflict — needs a human read";
  return "Partial profile — confirm this is a real person";
}

export function ReviewQueue() {
  const qc = useQueryClient();
  const queueFn = useServerFn(listReviewQueue);
  const approveFn = useServerFn(approveReviewItem);
  const rejectFn = useServerFn(rejectReviewItem);
  const bulkFn = useServerFn(bulkReviewDecision);
  const retriageFn = useServerFn(retriageReviewQueue);

  const [search, setSearch] = useState("");
  const [band, setBand] = useState<Band>("likely");
  const [chips, setChips] = useState<string[]>([]);
  const [sort, setSort] = useState("confidence");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);

  const params = {
    search: search.trim() || undefined,
    band,
    hasResume: chips.includes("resume") || undefined,
    mine: chips.includes("mine") || undefined,
    withinDays: chips.includes("recent") ? 365 : undefined,
    sort,
    limit,
  };

  const queue = useQuery({
    queryKey: ["email-archive-review", params],
    queryFn: () => queueFn({ data: params }),
  });

  const items = queue.data?.items ?? [];
  const bands = queue.data?.bands ?? { likely: 0, borderline: 0, weak: 0, total: 0 };
  const matched = queue.data?.matched ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["email-archive-review"] });
    qc.invalidateQueries({ queryKey: ["email-archive-people"] });
  };

  const single = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (approve) await approveFn({ data: { id } });
      else await rejectFn({ data: { id } });
    },
    onSuccess: (_r, v) => {
      toast.success(v.approve ? "Candidate added to the archive." : "Marked as no candidate.");
      setSelected((s) => s.filter((x) => x !== v.id));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update this item"),
  });

  const bulk = useMutation({
    mutationFn: (v: { ids: string[]; approve: boolean }) => bulkFn({ data: v }),
    onSuccess: (r, v) => {
      if (v.approve) {
        toast.success(
          `Imported ${r.approved} candidate${r.approved === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} had no saved content` : ""}.`,
        );
      } else {
        toast.success(`Dismissed ${r.dismissed} item${r.dismissed === 1 ? "" : "s"}.`);
      }
      setSelected([]);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk action failed"),
  });

  const retriage = useMutation({
    mutationFn: () => retriageFn(),
    onSuccess: (r) => {
      toast.success(
        r.imported
          ? `Auto-imported ${r.imported} trusted item${r.imported === 1 ? "" : "s"} · ${r.kept} still need your call.`
          : `Nothing cleared the trust bar — ${r.kept} still need your call.`,
      );
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not re-triage the queue"),
  });

  const busy = single.isPending || bulk.isPending || retriage.isPending;

  const allSelected = items.length > 0 && selected.length === items.length;
  const toggleAll = () => setSelected(allSelected ? [] : items.map((i) => i.id));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  /** Keyboard triage: J/K to move, A to import, X to dismiss. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /input|textarea|select/i.test(el.tagName)) return;
      if (!items.length || busy) return;
      const k = e.key.toLowerCase();
      if (k === "j") setCursor((c) => Math.min(items.length - 1, c + 1));
      else if (k === "k") setCursor((c) => Math.max(0, c - 1));
      else if (k === "a" || k === "x") {
        const it = items[Math.min(cursor, items.length - 1)];
        if (!it) return;
        if (k === "a" && !it.has_payload) {
          toast.error("This email has no saved content to import. Re-run recovery instead.");
          return;
        }
        single.mutate({ id: it.id, approve: k === "a" });
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, cursor, busy, single]);

  useEffect(() => {
    setCursor(0);
  }, [band, sort, search, chips.length]);

  const bandOptions: { key: Band; label: string; count: number }[] = useMemo(
    () => [
      { key: "likely", label: "Likely candidates", count: bands.likely },
      { key: "borderline", label: "Borderline", count: bands.borderline },
      { key: "weak", label: "Weak signal", count: bands.weak },
      { key: "all", label: "Everything", count: bands.total },
    ],
    [bands],
  );

  const dismissWeak = async () => {
    const res = await queueFn({ data: { band: "weak", limit: 200, sort: "confidence" } });
    if (!res.items.length) {
      toast.info("No weak-signal items left.");
      return;
    }
    bulk.mutate({ ids: res.items.map((i) => i.id), approve: false });
  };

  const toggleChip = (k: string) =>
    setChips((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  return (
    <section className="space-y-4 min-w-0 w-full">
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium">Clear the queue in a few minutes</div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
              We only ask when we genuinely cannot tell whether a person is in the email. Start with the strongest
              band, use <kbd className="px-1 rounded bg-secondary">J</kbd>/
              <kbd className="px-1 rounded bg-secondary">K</kbd> to move and{" "}
              <kbd className="px-1 rounded bg-secondary">A</kbd>/<kbd className="px-1 rounded bg-secondary">X</kbd> to
              decide.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => retriage.mutate()}>
              {retriage.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              Auto-import trusted items
            </Button>
            {bands.weak > 0 && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={dismissWeak}>
                Dismiss all weak ({bands.weak})
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the queue — sender, subject, company, keyword…"
          className="pl-9 h-11"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {bandOptions.map((b) => (
          <button
            type="button"
            key={b.key}
            onClick={() => setBand(b.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              band === b.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {b.label} <span className="opacity-70">{b.count}</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {CHIPS.map((c) => (
          <button
            type="button"
            key={c.key}
            onClick={() => toggleChip(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              chips.includes(c.key)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
        <div className="ml-auto">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confidence">Strongest signal first</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            Select all shown
          </label>
          <span>
            Showing {items.length} of {matched} in this filter · {bands.total} in the queue
          </span>
        </div>
      )}

      {selected.length > 0 && (
        <div className="sticky top-2 z-10 rounded-xl border border-primary/40 bg-card p-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => bulk.mutate({ ids: selected, approve: true })}>
              {bulk.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Import {selected.length}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => bulk.mutate({ ids: selected, approve: false })}
            >
              <XCircle className="size-3.5" /> Dismiss {selected.length}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {queue.isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading the queue…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={bands.total === 0 ? CheckCircle2 : Sparkles}
          title={bands.total === 0 ? "Queue clear — nothing needs your call" : "Nothing matches this filter"}
          description={
            bands.total === 0
              ? "Everything we recovered was decided automatically. New uncertain emails will land here after your next recovery."
              : `There are still ${bands.total} items in other bands. Try "Everything", or clear the search.`
          }
          action={
            bands.total > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBand("all");
                  setSearch("");
                  setChips([]);
                }}
              >
                Show everything
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 min-w-0">
          {items.map((it, idx) => {
            const hasResume = it.attachment_names.length > 0;
            return (
              <div
                key={it.id}
                onMouseEnter={() => setCursor(idx)}
                className={`rounded-xl border bg-card p-4 overflow-hidden transition-colors ${
                  idx === cursor ? "border-primary/60" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selected.includes(it.id)}
                    onCheckedChange={() => toggle(it.id)}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{it.subject ?? "(no subject)"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {it.from_name ?? it.from_email ?? "Unknown sender"} · {relTime(it.sent_at)}
                        </div>
                      </div>
                      <OutcomeBadge artifact={it.artifact_type} score={it.confidence} state="needs_review" />
                    </div>
                    {it.snippet && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 break-words">{it.snippet}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-border px-2 py-0.5 shrink-0">
                        {whyChip(it.reason, hasResume)}
                      </span>
                      <span>{KIND_LABEL[it.email_kind ?? "other"] ?? "Other"}</span>
                      {hasResume && (
                        <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
                          <FileText className="size-3 shrink-0" />
                          <span className="truncate">{it.attachment_names.join(", ")}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={busy || !it.has_payload}
                        onClick={() => single.mutate({ id: it.id, approve: true })}
                      >
                        <CheckCircle2 className="size-3.5" /> Yes, it's a candidate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => single.mutate({ id: it.id, approve: false })}
                      >
                        <XCircle className="size-3.5" /> No candidate
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length < matched && (
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Load {Math.min(PAGE, matched - items.length)} more
            </Button>
          )}
        </div>
      )}
    </section>
  );
}