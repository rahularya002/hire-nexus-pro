import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Database, Search, Briefcase, MapPin, Building2, Plus, Loader2, SearchX, CheckCircle2, XCircle, Send, CalendarClock, Trophy, History as HistoryIcon, X, Pencil, FileText, Upload, FileSpreadsheet, Download, UploadCloud, Sparkles } from "lucide-react";
import { CvDropImport, type CvDropImportHandle } from "@/components/cv-drop-import";
import { TableRowsSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CandidateSourcesPanel } from "@/components/candidate-sources-panel";
import { useAuth } from "@/lib/auth/auth-context";
import {
  useGridSession,
  setGridFilters,
  setGridNlQuery,
  setGridOpenCandidate,
  resetGridFilters,
  hasActiveFilters,
} from "@/lib/candidate-grid-session";
import {
  createCandidate,
  listCandidates,
  listApplications,
  updateCandidate,
  getResumeSignedUrl,
  attachCvToCandidate,
  searchCandidatePool,
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABEL,
  STAGE_LABEL,
  type ApplicationRow,
  type ApplicationStage,
  type CandidateRow,
  type CandidateStatus,
} from "@/lib/candidates.functions";
import { createDocument } from "@/lib/documents.functions";
import { uploadCvFile } from "@/lib/upload-cv";
import { listClients, type ClientRow } from "@/lib/clients.functions";
import { initialsOf } from "@/lib/display";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { EditCandidateDialog } from "@/components/edit-candidate-dialog";

export const Route = createFileRoute("/database")({
  component: () => <AppShell><Page /></AppShell>,
  head: () => ({
    meta: [
      { title: "Candidate Grid · TalentFlow talent database" },
      {
        name: "description",
        content:
          "Scan, filter and open every structured candidate in your talent pool — roles, experience, compensation, skills, sources and pipeline status in one recruiter grid.",
      },
      { property: "og:title", content: "Candidate Grid · TalentFlow" },
      {
        property: "og:description",
        content: "The recruiter workspace for your structured candidate intelligence pool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type MatchInfo = { score: number; matched: string[]; missing: string[]; tier: string };

const UNKNOWN = "—";
const yearsOf = (...vals: (string | null | undefined)[]) => {
  for (const v of vals) {
    const m = (v ?? "").match(/(\d{1,2}(?:\.\d)?)/);
    if (m) return Number(m[1]);
  }
  return null;
};
const ctcLabel = (v: number | null) => (v == null ? UNKNOWN : `₹${v} LPA`);

const STATUS_TONE: Record<CandidateStatus, string> = {
  new: "bg-secondary text-secondary-foreground",
  contacted: "bg-info/15 text-info",
  screening: "bg-purple/15 text-purple",
  shortlisted: "bg-emerald-500/15 text-emerald-600",
  submitted: "bg-primary/15 text-primary",
  placed: "bg-emerald-500/20 text-emerald-600",
  on_hold: "bg-warning/15 text-warning",
  rejected: "bg-destructive/15 text-destructive",
};

function Page() {
  const { filters: f, nlQuery, openCandidateId } = useGridSession();
  const [nlDraft, setNlDraft] = useState(nlQuery);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const dropRef = useRef<CvDropImportHandle | null>(null);
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const fetchCandidates = useServerFn(listCandidates);
  const addCandidate = useServerFn(createCandidate);
  const fetchClients = useServerFn(listClients);
  const poolSearch = useServerFn(searchCandidatePool);
  const qc = useQueryClient();

  const { data: candidates = [], isLoading, isError } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => fetchCandidates(),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  // Natural-language search answers from the structured pool — no Gmail rescan.
  const { data: nl, isFetching: nlLoading, isError: nlError } = useQuery({
    queryKey: ["candidate-pool-search", nlQuery],
    queryFn: () => poolSearch({ data: { query: nlQuery } }),
    enabled: nlQuery.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  const matchMap = useMemo(() => {
    const m = new Map<string, MatchInfo>();
    for (const r of nl?.results ?? []) {
      m.set(r.candidate.id, { score: r.score, matched: r.matched, missing: r.missing, tier: r.tier });
    }
    return m;
  }, [nl]);

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => addCandidate({ data: data as never }),
    onSuccess: () => {
      toast.success("Candidate added");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nlActive = nlQuery.trim().length >= 2;
  /** Kept in sync with the header cells so full-width states span the table. */
  const colCount = matchMap.size > 0 ? 13 : 12;




  const rows = useMemo(() => {
    // While a natural-language search is in flight, never fall back to the full
    // pool — that would flash unrelated candidates as if they matched.
    const base = nlActive ? (nl ? nl.results.map((r) => r.candidate) : []) : candidates;

    const needle = f.q.toLowerCase().trim();
    const has = (v: string | null | undefined, term: string) =>
      !!v && v.toLowerCase().includes(term.toLowerCase().trim());
    const minY = f.minYears.trim() === "" ? null : Number(f.minYears);
    const ctcMin = f.ctcMin.trim() === "" ? null : Number(f.ctcMin);
    const ctcMax = f.ctcMax.trim() === "" ? null : Number(f.ctcMax);
    const expMax = f.expectedMax.trim() === "" ? null : Number(f.expectedMax);
    const wantedSkills = f.skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

    return base.filter((c) => {
      if (needle) {
        const hay = [c.name, c.role, c.location, c.email, c.current_company, c.phone, c.industry, ...(c.skills ?? [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
        if (!hay) return false;
      }
      if (f.role && !has(c.role, f.role)) return false;
      if (f.company) {
        const inCurrent = has(c.current_company, f.company);
        const inPast = (c.previous_companies ?? []).some((p) => has(p, f.company));
        if (!inCurrent && !inPast) return false;
      }
      if (f.location && !has(c.location, f.location)) return false;
      if (f.industry && !has(c.industry, f.industry)) return false;
      if (f.noticePeriod && !has(c.notice_period, f.noticePeriod)) return false;
      if (wantedSkills.length) {
        const own = (c.skills ?? []).map((s) => s.toLowerCase());
        if (!wantedSkills.every((s) => own.some((o) => o.includes(s)))) return false;
      }
      if (minY != null) {
        const y = yearsOf(c.experience, c.relevant_experience);
        if (y == null || y < minY) return false;
      }
      if (ctcMin != null || ctcMax != null) {
        const cur = c.current_ctc ?? c.salary_min ?? c.salary_max;
        if (cur == null) return false;
        if (ctcMin != null && cur < ctcMin) return false;
        if (ctcMax != null && cur > ctcMax) return false;
      }
      if (expMax != null) {
        const exp = c.expected_ctc ?? c.salary_max;
        if (exp == null || exp > expMax) return false;
      }
      if (f.source !== "all" && c.source !== f.source) return false;
      if (f.status !== "all" && c.status !== f.status) return false;
      if (f.owner === "mine" && c.owner_id !== myId) return false;
      if (f.owner === "unassigned" && c.owner_id) return false;
      if (f.client === "unassigned" && c.source_client_id) return false;
      if (f.client !== "all" && f.client !== "unassigned" && c.source_client_id !== f.client) return false;
      return true;
    });
  }, [candidates, nl, nlActive, f, myId]);

  // A search result can legitimately sit outside the first page of the pool, so
  // resolve the open candidate from both sources before giving up.
  const selected = useMemo(
    () =>
      candidates.find((c) => c.id === openCandidateId) ??
      nl?.results.find((r) => r.candidate.id === openCandidateId)?.candidate ??
      null,
    [candidates, nl, openCandidateId],
  );


  function runNlSearch() {
    setGridNlQuery(nlDraft.trim());
  }

  return (
    <CvDropImport ref={dropRef} className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Talent intelligence</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Database className="size-5 text-primary" /> Candidate grid
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every structured candidate you have discovered — scan, filter, and open a full profile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => dropRef.current?.openPicker()} className="gap-2">
            <UploadCloud className="size-4" /> Upload CVs
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
            <FileSpreadsheet className="size-4" /> Bulk import
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> Add candidate</Button>
        </div>
      </div>

      {/* Natural-language search over the structured pool */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary" />
            <input
              value={nlDraft}
              onChange={(e) => setNlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runNlSearch(); }}
              placeholder="Describe who you need — e.g. fashion designers with 3+ years in Delhi or Mumbai"
              className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <Button onClick={runNlSearch} disabled={nlDraft.trim().length < 2} className="gap-2">
            {nlLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
          </Button>
          {nlQuery && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs"
              onClick={() => { setNlDraft(""); setGridNlQuery(""); }}>
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>
        {nlQuery && !nlLoading && !nlError && (
          <div className="text-[11px] text-muted-foreground">
            Matched on role relevance for “{nlQuery}” · {nl?.results.length ?? 0} candidate
            {(nl?.results.length ?? 0) === 1 ? "" : "s"} in your database
          </div>
        )}
        {nlError && <div className="text-[11px] text-destructive">Search failed. Try again in a moment.</div>}
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quick find</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={f.q} onChange={(e) => setGridFilters({ q: e.target.value })}
              placeholder="Name, email, company…" className="h-9 pl-8 w-56" />
          </div>
        </div>
        <FilterInput label="Designation" value={f.role} onChange={(v) => setGridFilters({ role: v })} placeholder="e.g. Fashion Designer" />
        <FilterInput label="Company" value={f.company} onChange={(v) => setGridFilters({ company: v })} placeholder="Current or past" />
        <FilterInput label="Location" value={f.location} onChange={(v) => setGridFilters({ location: v })} placeholder="e.g. Mumbai" />
        <FilterInput label="Skills (all of)" value={f.skills} onChange={(v) => setGridFilters({ skills: v })} placeholder="comma separated" />
        <FilterInput label="Industry / function" value={f.industry} onChange={(v) => setGridFilters({ industry: v })} placeholder="e.g. Apparel" />
        <FilterInput label="Notice period" value={f.noticePeriod} onChange={(v) => setGridFilters({ noticePeriod: v })} placeholder="e.g. 30 days" className="w-40" />
        <FilterInput label="Min experience (yrs)" value={f.minYears} onChange={(v) => setGridFilters({ minYears: v })} placeholder="3" className="w-32" />
        <FilterInput label="Current CTC min" value={f.ctcMin} onChange={(v) => setGridFilters({ ctcMin: v })} placeholder="LPA" className="w-28" />
        <FilterInput label="Current CTC max" value={f.ctcMax} onChange={(v) => setGridFilters({ ctcMax: v })} placeholder="LPA" className="w-28" />
        <FilterInput label="Expected CTC ≤" value={f.expectedMax} onChange={(v) => setGridFilters({ expectedMax: v })} placeholder="LPA" className="w-28" />
        <FilterSelect label="Status" value={f.status} onChange={(v) => setGridFilters({ status: v })}
          options={[{ value: "all", label: "All statuses" }, ...CANDIDATE_STATUSES.map((s) => ({ value: s, label: CANDIDATE_STATUS_LABEL[s] }))]} />
        <FilterSelect label="Source" value={f.source} onChange={(v) => setGridFilters({ source: v })}
          options={[
            { value: "all", label: "All sources" },
            { value: "inbound", label: "Inbound / mailbox" },
            { value: "manual", label: "Manual" },
            { value: "scout", label: "Scout" },
            { value: "referral", label: "Referral" },
            { value: "database", label: "Database" },
          ]} />
        <FilterSelect label="Owner" value={f.owner} onChange={(v) => setGridFilters({ owner: v })}
          options={[
            { value: "all", label: "Anyone" },
            { value: "mine", label: "Owned by me" },
            { value: "unassigned", label: "Unassigned" },
          ]} />
        <FilterSelect label="Source client" value={f.client} onChange={(v) => setGridFilters({ client: v })}
          options={[
            { value: "all", label: "All clients" },
            { value: "unassigned", label: "Unassigned" },
            ...clients.map((c: ClientRow) => ({ value: c.id, label: c.name })),
          ]} />
        {hasActiveFilters(f) && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={resetGridFilters}>
            <X className="size-3.5" /> Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto self-center">{rows.length} candidates</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Candidate</th>
                {matchMap.size > 0 && <th className="text-left font-medium px-2 py-2.5">Match</th>}
                <th className="text-left font-medium px-2 py-2.5">Designation / experience</th>
                <th className="text-left font-medium px-2 py-2.5">Current company</th>
                <th className="text-left font-medium px-2 py-2.5">Location</th>
                <th className="text-left font-medium px-2 py-2.5">Skills</th>
                <th className="text-left font-medium px-2 py-2.5">Current CTC</th>
                <th className="text-left font-medium px-2 py-2.5">Expected</th>
                <th className="text-left font-medium px-2 py-2.5">Notice</th>
                <th className="text-left font-medium px-2 py-2.5">Industry</th>
                <th className="text-left font-medium px-2 py-2.5">Status</th>
                <th className="text-left font-medium px-2 py-2.5">Source</th>
                <th className="text-left font-medium px-2 py-2.5">CV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(isLoading || (nlActive && nlLoading && !nl)) && <TableRowsSkeleton rows={6} cols={colCount} />}
              {isError && !isLoading && (
                <tr><td colSpan={colCount} className="px-4 py-8 text-center text-xs text-destructive">
                  Could not load your candidates. Refresh to try again.
                </td></tr>
              )}
              {nlActive && nlError && (
                <tr><td colSpan={colCount} className="px-4 py-8 text-center text-xs text-destructive">
                  Search failed, so no results are shown. Try again in a moment.
                </td></tr>
              )}
              {!isLoading && !isError && !(nlActive && (nlError || (nlLoading && !nl))) && rows.length === 0 && (
                <tr><td colSpan={colCount} className="px-4 py-8">

                  <EmptyState
                    icon={f.q || nlQuery || hasActiveFilters(f) ? SearchX : Database}
                    title={nlQuery ? "No candidates match that brief" : f.q || hasActiveFilters(f) ? "No matches found" : "No candidates yet"}
                    description={
                      nlQuery
                        ? `Nobody in your database matches “${nlQuery}”. Try the Mailbox to discover new people.`
                        : f.q || hasActiveFilters(f)
                          ? "Adjust or clear the filters to see more candidates."
                          : 'Click "Add candidate", upload CVs, or add people from the Mailbox.'
                    }
                    className="border-0 bg-transparent p-0"
                  />
                </td></tr>
              )}
              {rows.map((c: CandidateRow) => {
                const match = matchMap.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-secondary/30 transition"
                    onClick={() => setGridOpenCandidate(c.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-[11px] font-semibold shrink-0">
                          {initialsOf(c.name)}
                        </div>
                        <div className="leading-tight min-w-0">
                          <button className="font-medium hover:text-primary hover:underline text-left truncate max-w-[200px]">
                            {c.name}
                          </button>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{c.email ?? UNKNOWN}</div>
                        </div>
                      </div>
                    </td>
                    {matchMap.size > 0 && (
                      <td className="px-2 py-3">
                        {match ? (
                          <span className="text-xs font-semibold text-primary">{match.score}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{UNKNOWN}</span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-3">
                      <div className="text-xs truncate max-w-[200px]">{c.role ?? UNKNOWN}</div>
                      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Briefcase className="size-3" />{c.experience ?? UNKNOWN}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{c.current_company ?? UNKNOWN}</span>
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" />{c.location ?? UNKNOWN}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {c.skills?.length ? (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {c.skills.slice(0, 3).map((s) => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/70">{s}</span>
                          ))}
                          {c.skills.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{c.skills.length - 3}</span>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">{UNKNOWN}</span>}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {c.current_ctc != null ? ctcLabel(c.current_ctc) : formatSalaryRange(c.salary_min, c.salary_max, c.salary)}
                    </td>
                    <td className="px-2 py-3 text-xs">{ctcLabel(c.expected_ctc)}</td>
                    <td className="px-2 py-3 text-xs">{c.notice_period ?? UNKNOWN}</td>
                    <td className="px-2 py-3 text-xs truncate max-w-[140px]">{c.industry ?? UNKNOWN}</td>
                    <td className="px-2 py-3">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_TONE[c.status] ?? "bg-secondary"}`}>
                        {CANDIDATE_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs capitalize">{c.source}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <CvCellButton candidate={c} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddCandidateDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(d) => create.mutate(d as never)}
        submitting={create.isPending}
        clients={clients}
      />
      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        clients={clients}
      />
      <CandidateDetailSheet
        candidate={selected}
        match={selected ? (matchMap.get(selected.id) ?? null) : null}
        matchQuery={nlQuery}
        onClose={() => setGridOpenCandidate(null)}
      />
   </CvDropImport>
  );
}

function FilterInput({
  label, value, onChange, placeholder, className,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`h-9 ${className ?? "w-44"}`} />
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 w-44"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CandidateDetailSheet({
  candidate,
  match,
  matchQuery,
  onClose,
}: {
  candidate: CandidateRow | null;
  match: MatchInfo | null;
  matchQuery: string;
  onClose: () => void;
}) {
  const fetchApps = useServerFn(listApplications);
  const [editing, setEditing] = useState(false);
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["candidate-history", candidate?.id],
    queryFn: () => fetchApps({ data: { candidateId: candidate!.id } }),
    enabled: !!candidate,
  });

  return (
    <Sheet open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {candidate && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-sm font-semibold">
                  {initialsOf(candidate.name)}
                </div>
                <div className="leading-tight min-w-0">
                  <div className="truncate">{candidate.name}</div>
                  <div className="text-xs font-normal text-muted-foreground truncate">
                    {candidate.role ?? UNKNOWN}
                    {candidate.current_company ? ` · ${candidate.current_company}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </SheetTitle>
              <SheetDescription className="sr-only">Candidate profile, sources and history</SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="profile" className="mt-5">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                {match && <TabsTrigger value="match">Match</TabsTrigger>}
                <TabsTrigger value="history" className="gap-1.5">
                  History
                  {apps.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      {apps.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 text-sm">
                <Section title="Overview">
                  <Row k="Email" v={candidate.email} />
                  <Row k="Phone" v={candidate.phone} />
                  <Row k="Designation" v={candidate.role} />
                  <Row k="Current company" v={candidate.current_company} />
                  <Row k="Location" v={candidate.location} />
                  <Row k="Total experience" v={candidate.experience} />
                  <Row k="Relevant experience" v={candidate.relevant_experience} />
                </Section>
                <Section title="Professional profile">
                  <Row k="Skills" v={candidate.skills?.length ? candidate.skills.join(", ") : null} />
                  <Row k="Industry / function" v={candidate.industry} />
                  <Row k="Previous companies" v={candidate.previous_companies?.length ? candidate.previous_companies.join(", ") : null} />
                  <Row k="Education" v={candidate.education} />
                </Section>
                <Section title="Compensation & availability">
                  <Row k="Current CTC" v={candidate.current_ctc != null ? ctcLabel(candidate.current_ctc) : null} />
                  <Row k="Expected CTC" v={candidate.expected_ctc != null ? ctcLabel(candidate.expected_ctc) : null} />
                  <Row k="Salary range" v={formatSalaryRange(candidate.salary_min, candidate.salary_max, candidate.salary)} />
                  <Row k="Notice period" v={candidate.notice_period} />
                  <Row k="Availability" v={candidate.availability} />
                </Section>
                <Section title="Recruiter information">
                  <Row k="Status" v={CANDIDATE_STATUS_LABEL[candidate.status] ?? candidate.status} />
                  <Row k="Owner" v={candidate.owner_id ? "Assigned" : "Unassigned"} />
                  <Row k="Source" v={candidate.source} />
                  <Row k="Source client" v={candidate.source_client?.name ?? null} />
                  <Row k="Last contacted" v={candidate.last_contacted_at ? new Date(candidate.last_contacted_at).toLocaleDateString() : null} />
                  <Row k="Notes" v={candidate.notes} />
                  <CvRow candidate={candidate} />
                  {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url} target="_blank" rel="noreferrer"
                      className="text-primary text-xs underline">View LinkedIn profile</a>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="sources" className="space-y-3">
                <CandidateSourcesPanel candidateId={candidate.id} />
              </TabsContent>

              {match && (
                <TabsContent value="match" className="space-y-3">
                  <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                    <div className="text-2xl font-semibold leading-none text-primary">{match.score}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      Match for “{matchQuery}”
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Occupation evidence: {match.tier === "specific" ? "exact occupation match" : match.tier === "related" ? "adjacent occupation" : match.tier === "generic" ? "generic role family" : "no role evidence"}
                    </div>
                  </div>
                  {match.matched.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Why this matched</div>
                      <ul className="space-y-1">
                        {match.matched.map((m) => (
                          <li key={m} className="text-xs inline-flex items-center gap-1.5 mr-2">
                            <CheckCircle2 className="size-3 text-emerald-600" />{m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {match.missing.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Unknown or missing</div>
                      <ul className="space-y-1">
                        {match.missing.map((m) => (
                          <li key={m} className="text-xs inline-flex items-center gap-1.5 mr-2">
                            <XCircle className="size-3 text-muted-foreground" />{m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="history" className="space-y-3">
                {isLoading && <div className="text-xs text-muted-foreground py-6">Loading history…</div>}
                {!isLoading && apps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <HistoryIcon className="size-6 text-muted-foreground mx-auto mb-2" />
                    <div className="text-xs text-muted-foreground">
                      This candidate hasn't been shared with any client yet.
                    </div>
                  </div>
                )}
                {!isLoading && apps.length > 0 && <HistorySummary apps={apps} />}
                <ul className="space-y-2">
                  {[...apps]
                    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
                    .map((a: ApplicationRow) => (
                      <HistoryItem key={a.id} app={a} />
                    ))}
                </ul>
              </TabsContent>
            </Tabs>
            <EditCandidateDialog
              open={editing}
              onOpenChange={setEditing}
              candidate={candidate}
              invalidateKeys={[["candidates"], ["candidate-history", candidate.id]]}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</div>
      <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">{children}</div>
    </div>
  );
}

/** Label / value line. Unknown values always render as an em dash, never invented. */
function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{k}</span>
      <span className="text-xs break-words">{v ?? UNKNOWN}</span>
    </div>
  );
}




function CvRow({ candidate }: { candidate: CandidateRow }) {
  const qc = useQueryClient();
  const signFn = useServerFn(getResumeSignedUrl);
  const updateFn = useServerFn(updateCandidate);
  const createDocFn = useServerFn(createDocument);
  const [opening, setOpening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function openCv() {
    setOpening(true);
    try {
      const { url } = await signFn({ data: { candidateId: candidate.id } });
      if (!url) throw new Error("No CV on file");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open CV");
    } finally {
      setOpening(false);
    }
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setUploading(true);
    try {
      const up = await uploadCvFile(f);
      await updateFn({ data: { id: candidate.id, resume_url: up.path } });
      await createDocFn({
        data: {
          name: up.name,
          kind: "resume",
          candidate_id: candidate.id,
          storage_bucket: "documents",
          storage_path: up.path,
          mime: up.mime,
          size_bytes: up.size,
        },
      });
      toast.success("CV uploaded");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidate-history", candidate.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex gap-3 py-1 items-center">
      <span className="text-xs text-muted-foreground w-32 shrink-0">CV / Resume</span>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      {candidate.resume_url ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={openCv} disabled={opening}>
            {opening ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3.5" />}
            Open CV
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3.5" />}
            Replace
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3.5" />}
          Upload CV
        </Button>
      )}
    </div>
  );
}

const STAGE_META: Partial<Record<ApplicationStage, { tone: string; Icon: typeof Send }>> = {
  shared_with_client:   { tone: "bg-info/15 text-info",          Icon: Send },
  client_shortlist:     { tone: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 },
  client_rejected:      { tone: "bg-destructive/15 text-destructive", Icon: XCircle },
  interview_scheduled:  { tone: "bg-purple/15 text-purple",      Icon: CalendarClock },
  rounds:               { tone: "bg-purple/15 text-purple",      Icon: CalendarClock },
  offered:              { tone: "bg-emerald-500/15 text-emerald-600", Icon: Trophy },
  closed:               { tone: "bg-secondary text-secondary-foreground", Icon: CheckCircle2 },
};

function HistorySummary({ apps }: { apps: ApplicationRow[] }) {
  const clients = new Set(apps.map((a) => a.position?.client?.id).filter(Boolean));
  const shortlisted = apps.filter((a) => ["client_shortlist", "interview_scheduled", "rounds", "offered"].includes(a.stage)).length;
  const rejected = apps.filter((a) => a.stage === "client_rejected").length;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Clients" value={clients.size} />
      <Stat label="Shortlisted" value={shortlisted} tone="text-emerald-600" />
      <Stat label="Rejected" value={rejected} tone="text-destructive" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className={`text-lg font-semibold leading-none ${tone ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function HistoryItem({ app: a }: { app: ApplicationRow }) {
  const meta = STAGE_META[a.stage] ?? { tone: "bg-secondary text-secondary-foreground", Icon: Send };
  const Icon = meta.Icon;
  const dot = a.position?.client?.color ?? "hsl(var(--muted-foreground))";
  const rejected = a.stage === "client_rejected";
  const date = new Date(a.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <li className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full shrink-0" style={{ background: dot }} />
          <div className="text-sm font-medium truncate">{a.position?.client?.name ?? "Client"}</div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.tone}`}>
          <Icon className="size-3" />
          {STAGE_LABEL[a.stage] ?? a.stage}
        </span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        <span className="truncate">{a.position?.title ?? "—"}</span>
        {a.match_score != null && <span>· {a.match_score}% match</span>}
        <span>· {date}</span>
      </div>
      {rejected && a.notes && (
        <div className="text-xs text-destructive/90 rounded-md bg-destructive/5 border border-destructive/15 px-2 py-1.5">
          <span className="font-medium">Reason:</span> {a.notes}
        </div>
      )}
    </li>
  );
}

function AddCandidateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  clients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: { name: string; email?: string; phone?: string; role?: string; location?: string; experience?: string; current_company?: string; linkedin_url?: string; salary?: string; skills?: string[]; resume_url?: string; source_client_id?: string | null }) => void;
  // salary_min/salary_max are added below in the handler
  submitting: boolean;
  clients: ClientRow[];
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", location: "", experience: "", current_company: "", linkedin_url: "", salary_min: "", salary_max: "", source_client_id: "" });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const createDocFn = useServerFn(createDocument);

  function addSkill() {
    const v = skillInput.trim();
    if (!v || skills.includes(v)) { setSkillInput(""); return; }
    setSkills([...skills, v].slice(0, 40));
    setSkillInput("");
  }

  function reset() {
    setForm({ name: "", email: "", phone: "", role: "", location: "", experience: "", current_company: "", linkedin_url: "", salary_min: "", salary_max: "", source_client_id: "" });
    setSkills([]);
    setSkillInput("");
    setCvFile(null);
  }

  async function handleSubmit() {
    let resumePath: string | undefined;
    if (cvFile) {
      setUploadingCv(true);
      try {
        const up = await uploadCvFile(cvFile);
        resumePath = up.path;
        // Best-effort document record; attach candidate_id afterwards would need id, skip here.
        try {
          await createDocFn({ data: {
            name: up.name, kind: "resume",
            storage_bucket: "documents", storage_path: up.path,
            mime: up.mime, size_bytes: up.size,
          }});
        } catch { /* non-fatal */ }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "CV upload failed");
        setUploadingCv(false);
        return;
      }
      setUploadingCv(false);
    }
    onSubmit({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      role: form.role.trim() || undefined,
      location: form.location.trim() || undefined,
      experience: form.experience.trim() || undefined,
      current_company: form.current_company.trim() || undefined,
      linkedin_url: form.linkedin_url.trim() || undefined,
      skills: skills.length ? skills : undefined,
      resume_url: resumePath,
      source_client_id: form.source_client_id || null,
      ...(form.salary_min.trim() !== "" ? { salary_min: Number(form.salary_min) } : {}),
      ...(form.salary_max.trim() !== "" ? { salary_max: Number(form.salary_max) } : {}),
    } as Parameters<typeof onSubmit>[0]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>Add a new candidate to your talent database.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current role"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
            <Field label="Current company"><Input value={form.current_company} onChange={(e) => setForm({ ...form, current_company: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Experience"><Input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="e.g. 7 yrs" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="LinkedIn URL"><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Salary min (LPA)"><NumberInput min={0} value={form.salary_min} onChange={(v) => setForm({ ...form, salary_min: v })} placeholder="12" /></Field>
              <Field label="Salary max (LPA)"><NumberInput min={0} value={form.salary_max} onChange={(v) => setForm({ ...form, salary_max: v })} placeholder="18" /></Field>
            </div>
          </div>
          <Field label="Source client (optional)">
            <select
              value={form.source_client_id}
              onChange={(e) => setForm({ ...form, source_client_id: e.target.value })}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Skills">
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="Add a skill and press Enter"
              />
              <Button type="button" variant="outline" onClick={addSkill}><Plus className="size-4" /></Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary font-medium">
                    {s}
                    <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <Field label="CV / Resume (PDF, DOC, DOCX, TXT — max 10 MB)">
            <div className="flex items-center gap-2">
              <Input type="file" accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
              {cvFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCvFile(null)}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
            {cvFile && (
              <div className="text-[11px] text-muted-foreground mt-1 truncate">
                <FileText className="inline size-3 mr-1" />{cvFile.name} · {(cvFile.size / 1024).toFixed(0)} KB
              </div>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting || uploadingCv || !form.name.trim()}
            onClick={handleSubmit}
          >
            {submitting || uploadingCv ? <Loader2 className="size-4 animate-spin" /> : "Add candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function formatSalaryRange(min: number | null, max: number | null, fallback: string | null): string {
  if (min != null && max != null) {
    return min === max ? `₹${min} LPA` : `₹${min}–${max} LPA`;
  }
  if (min != null) return `≥ ₹${min} LPA`;
  if (max != null) return `≤ ₹${max} LPA`;
  return fallback ?? "—";
}

function CvCellButton({ candidate }: { candidate: CandidateRow }) {
  const qc = useQueryClient();
  const signFn = useServerFn(getResumeSignedUrl);
  const updateFn = useServerFn(updateCandidate);
  const createDocFn = useServerFn(createDocument);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const { url } = await signFn({ data: { candidateId: candidate.id } });
      if (!url) throw new Error("No CV on file");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open CV");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      const up = await uploadCvFile(f);
      await updateFn({ data: { id: candidate.id, resume_url: up.path } });
      await createDocFn({ data: {
        name: up.name, kind: "resume", candidate_id: candidate.id,
        storage_bucket: "documents", storage_path: up.path,
        mime: up.mime, size_bytes: up.size,
      }}).catch(() => {});
      toast.success("CV uploaded");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      {candidate.resume_url ? (
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={open} disabled={busy}
          title="Open CV">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5 text-primary" />}
          Open
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => fileRef.current?.click()} disabled={busy} title="Upload CV">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload
        </Button>
      )}
    </>
  );
}

type BulkRow = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  location?: string;
  experience?: string;
  current_company?: string;
  linkedin_url?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  skills?: string[];
  cv_filename?: string;
  _error?: string;
};

const BULK_COLUMNS: { key: keyof BulkRow; aliases: string[] }[] = [
  { key: "name", aliases: ["name", "full name", "candidate", "candidate name"] },
  { key: "email", aliases: ["email", "email address", "e-mail"] },
  { key: "phone", aliases: ["phone", "mobile", "contact", "phone number"] },
  { key: "role", aliases: ["role", "current role", "title", "job title", "designation"] },
  { key: "current_company", aliases: ["company", "current company", "employer", "organisation", "organization"] },
  { key: "location", aliases: ["location", "city", "based in"] },
  { key: "experience", aliases: ["experience", "years of experience", "exp", "yoe"] },
  { key: "linkedin_url", aliases: ["linkedin", "linkedin url", "linkedin profile"] },
  { key: "salary", aliases: ["salary", "ctc", "compensation", "package"] },
  { key: "salary_min", aliases: ["salary min", "salary minimum", "min salary", "ctc min", "min ctc", "salary min lpa"] },
  { key: "salary_max", aliases: ["salary max", "salary maximum", "max salary", "ctc max", "max ctc", "salary max lpa"] },
  { key: "skills", aliases: ["skills", "key skills", "tech stack"] },
  { key: "cv_filename", aliases: ["cv", "cv file", "cv filename", "resume", "resume file", "resume filename", "cv name"] },
];

function normHeader(h: string) {
  return String(h ?? "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

function mapRow(raw: Record<string, unknown>): BulkRow {
  const out: BulkRow = { name: "" };
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) normalized[normHeader(k)] = v;
  for (const col of BULK_COLUMNS) {
    for (const alias of col.aliases) {
      if (alias in normalized && normalized[alias] != null && String(normalized[alias]).trim() !== "") {
        const val = String(normalized[alias]).trim();
        if (col.key === "skills") {
          out.skills = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean).slice(0, 40);
        } else if (col.key === "salary_min" || col.key === "salary_max") {
          const n = Number(val.replace(/[^0-9.]/g, ""));
          if (Number.isFinite(n)) (out as Record<string, unknown>)[col.key] = n;
        } else {
          (out as Record<string, unknown>)[col.key] = val;
        }
        break;
      }
    }
  }
  if (!out.name) out._error = "Missing name";
  return out;
}

function BulkImportDialog({ open, onOpenChange, clients }: { open: boolean; onOpenChange: (o: boolean) => void; clients: ClientRow[] }) {
  const qc = useQueryClient();
  const addCandidate = useServerFn(createCandidate);
  const attachCv = useServerFn(attachCvToCandidate);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; ok: number; failed: number } | null>(null);
  const [sourceClientId, setSourceClientId] = useState<string>("");
  const [imported, setImported] = useState<{ id: string; name: string; cvFilename?: string }[]>([]);
  const [cvStatuses, setCvStatuses] = useState<Record<string, { status: "queued" | "uploading" | "attached" | "already" | "failed"; candidateName?: string; error?: string }>>({});
  const cvInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setRows([]); setFileName(""); setProgress(null); setSourceClientId("");
    setImported([]); setCvStatuses({});
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setParsing(true);
    setFileName(f.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const mapped = json.map(mapRow).filter((r) => r.name || r._error);
      if (mapped.length === 0) throw new Error("No rows found. Make sure the first sheet has a header row.");
      setRows(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
      setFileName("");
    } finally {
      setParsing(false);
    }
  }

  function downloadTemplate() {
    // Simple CSV template — Excel opens it natively.
    const headers = ["name", "email", "phone", "role", "current_company", "location", "experience", "linkedin_url", "salary_min", "salary_max", "skills", "cv_filename"];
    const sample = ["Jane Doe", "jane@example.com", "+91 90000 00000", "Senior Engineer", "Acme", "Bengaluru", "7 years", "https://linkedin.com/in/jane", "35", "50", "React, Node, TypeScript", "jane_doe.pdf"];
    const csv = headers.join(",") + "\n" + sample.map((v) => `"${v.replace(/"/g, '""')}"`).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "candidates-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    const valid = rows.filter((r) => !r._error);
    if (valid.length === 0) { toast.error("Nothing valid to import"); return; }
    setImporting(true);
    let ok = 0, failed = 0;
    setProgress({ done: 0, ok: 0, failed: 0 });
    const importedRows: { id: string; name: string; cvFilename?: string }[] = [];
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        const created = await addCandidate({ data: {
          name: r.name,
          email: r.email, phone: r.phone, role: r.role,
          location: r.location, experience: r.experience,
          current_company: r.current_company, linkedin_url: r.linkedin_url,
          salary: r.salary, skills: r.skills,
          salary_min: r.salary_min, salary_max: r.salary_max,
          source_client_id: sourceClientId || null,
        }});
        importedRows.push({ id: created.id, name: created.name, cvFilename: r.cv_filename });
        ok++;
      } catch (e) {
        failed++;
        // Attach message back onto the row for UI
        r._error = e instanceof Error ? e.message : "Failed";
      }
      setProgress({ done: i + 1, ok, failed });
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ["candidates"] });
    setImported(importedRows);
    toast.success(`Imported ${ok} · ${failed} failed`);
    // Keep dialog open so the user can attach CVs in step 2.
  }

  function normalizeFilename(s: string) {
    return s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function normalizeName(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function matchCandidateForFile(f: File): { id: string; name: string } | null {
    const fn = normalizeFilename(f.name);
    if (!fn) return null;
    // 1) exact cv_filename match (case-insensitive)
    for (const c of imported) {
      if (c.cvFilename && c.cvFilename.trim().toLowerCase() === f.name.trim().toLowerCase()) {
        return { id: c.id, name: c.name };
      }
    }
    // 2) normalized cv_filename equality
    for (const c of imported) {
      if (c.cvFilename && normalizeFilename(c.cvFilename) === fn) return { id: c.id, name: c.name };
    }
    // 3) filename contains normalized name (or vice versa) — must be unique to be trusted
    const candidates = imported.filter((c) => {
      const n = normalizeName(c.name);
      if (!n) return false;
      return fn.includes(n) || n.includes(fn);
    });
    if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].name };
    return null;
  }

  async function handleCvPicked(files: File[]) {
    if (!files.length) return;
    // Seed statuses
    setCvStatuses((prev) => {
      const next = { ...prev };
      for (const f of files) next[f.name] = { status: "queued" };
      return next;
    });
    for (const f of files) {
      const match = matchCandidateForFile(f);
      if (!match) {
        setCvStatuses((p) => ({ ...p, [f.name]: { status: "failed", error: "No match — rename file to match candidate name" } }));
        continue;
      }
      setCvStatuses((p) => ({ ...p, [f.name]: { status: "uploading", candidateName: match.name } }));
      try {
        const up = await uploadCvFile(f);
        const res = await attachCv({ data: {
          candidateId: match.id,
          storagePath: up.path,
          fileName: up.name,
          mime: up.mime,
          sizeBytes: up.size,
        }});
        setCvStatuses((p) => ({
          ...p,
          [f.name]: {
            status: res.status === "already_has_cv" ? "already" : "attached",
            candidateName: res.name,
          },
        }));
      } catch (e) {
        setCvStatuses((p) => ({ ...p, [f.name]: { status: "failed", candidateName: match.name, error: e instanceof Error ? e.message : "Failed" } }));
      }
    }
    qc.invalidateQueries({ queryKey: ["candidates"] });
  }

  async function manualAttach(fileName: string, candidateId: string, file: File) {
    const target = imported.find((c) => c.id === candidateId);
    setCvStatuses((p) => ({ ...p, [fileName]: { status: "uploading", candidateName: target?.name } }));
    try {
      const up = await uploadCvFile(file);
      const res = await attachCv({ data: {
        candidateId,
        storagePath: up.path,
        fileName: up.name,
        mime: up.mime,
        sizeBytes: up.size,
      }});
      setCvStatuses((p) => ({
        ...p,
        [fileName]: {
          status: res.status === "already_has_cv" ? "already" : "attached",
          candidateName: res.name,
        },
      }));
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      setCvStatuses((p) => ({ ...p, [fileName]: { status: "failed", candidateName: target?.name, error: e instanceof Error ? e.message : "Failed" } }));
    }
  }

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.length - validCount;
  const attachingBusy = Object.values(cvStatuses).some((s) => s.status === "uploading" || s.status === "queued");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> Bulk import candidates
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx, .xls) or CSV file. First row must be a header row with columns like <code>name</code>, <code>email</code>, <code>phone</code>, <code>role</code>, <code>skills</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              disabled={parsing || importing}
              className="max-w-sm" />
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="size-3.5" /> Download template
            </Button>
            {parsing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Tag all rows with source client (optional)</Label>
            <select
              value={sourceClientId}
              onChange={(e) => setSourceClientId(e.target.value)}
              disabled={importing}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 max-w-sm"
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">Useful when importing legacy candidates that came from a specific client.</p>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{fileName}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="size-3" /> {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="size-3" /> {errorCount} issue{errorCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-border overflow-hidden max-h-[360px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">#</th>
                      <th className="text-left font-medium px-2 py-2">Name</th>
                      <th className="text-left font-medium px-2 py-2">Email</th>
                      <th className="text-left font-medium px-2 py-2">Role</th>
                      <th className="text-left font-medium px-2 py-2">Company</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/5" : ""}>
                        <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium">{r.name || <span className="text-destructive">—</span>}</td>
                        <td className="px-2 py-1.5">{r.email ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.role ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.current_company ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {r._error ? (
                            <span className="text-destructive">{r._error}</span>
                          ) : (
                            <span className="text-emerald-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {progress && (
                <div className="text-xs text-muted-foreground">
                  Progress: {progress.done} / {validCount} · {progress.ok} added · {progress.failed} failed
                </div>
              )}
            </>
          )}

          {imported.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold inline-flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary" /> Step 2 · Attach CVs (optional)
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Drop CV files below — each is matched to a candidate by the <code>cv_filename</code> column,
                  or by the candidate's name if the filename contains it. Unmatched files can be assigned manually.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length) void handleCvPicked(files);
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => cvInputRef.current?.click()} className="gap-1.5" disabled={attachingBusy}>
                  <UploadCloud className="size-3.5" /> Choose CV files
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {imported.length} candidate{imported.length === 1 ? "" : "s"} ready to receive a CV
                </span>
              </div>

              {Object.keys(cvStatuses).length > 0 && (
                <div className="rounded-md border border-border overflow-hidden max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">File</th>
                        <th className="text-left font-medium px-2 py-2">Candidate</th>
                        <th className="text-left font-medium px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(cvStatuses).map(([fName, s]) => (
                        <tr key={fName}>
                          <td className="px-3 py-1.5 truncate max-w-[220px]" title={fName}>{fName}</td>
                          <td className="px-2 py-1.5">
                            {s.status === "failed" && !s.candidateName ? (
                              <ManualAttachSelect
                                imported={imported}
                                onPick={(id) => {
                                  // We no longer have the File object; user must reselect.
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = ".pdf,.doc,.docx,.txt";
                                  input.onchange = () => {
                                    const f = input.files?.[0];
                                    if (f) void manualAttach(fName, id, f);
                                  };
                                  input.click();
                                }}
                              />
                            ) : (
                              <span className="text-muted-foreground">{s.candidateName ?? "—"}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {s.status === "queued" && <span className="text-muted-foreground">Queued</span>}
                            {s.status === "uploading" && (
                              <span className="inline-flex items-center gap-1 text-primary">
                                <Loader2 className="size-3 animate-spin" /> Attaching…
                              </span>
                            )}
                            {s.status === "attached" && (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="size-3" /> Attached
                              </span>
                            )}
                            {s.status === "already" && (
                              <span className="text-amber-600">Already had a CV</span>
                            )}
                            {s.status === "failed" && (
                              <span className="text-destructive">{s.error ?? "Failed"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing || attachingBusy}>
            {imported.length > 0 ? "Done" : "Cancel"}
          </Button>
          {imported.length === 0 && (
            <Button
              onClick={runImport}
              disabled={importing || parsing || validCount === 0}
              className="gap-2"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Import {validCount > 0 ? `${validCount} candidate${validCount === 1 ? "" : "s"}` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualAttachSelect({ imported, onPick }: { imported: { id: string; name: string }[]; onPick: (id: string) => void }) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        e.currentTarget.value = "";
        if (v) onPick(v);
      }}
      className="h-7 rounded-md border border-input bg-card px-1.5 text-[11px]"
    >
      <option value="">Assign to…</option>
      {imported.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}