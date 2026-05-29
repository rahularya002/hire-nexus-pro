import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Plug,
  Sparkles,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  CalendarClock,
  Plus,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { SCOUT_SOURCES } from "@/lib/scout-sources";
import {
  listSourceSettings,
  upsertSourceSetting,
  getIntegrationStatus,
  getServiceIntegrationStatus,
  type SourceSettingRow,
} from "@/lib/admin-settings.functions";
import {
  INTEGRATIONS,
  INTEGRATION_CATEGORY_ORDER,
  CATEGORY_LABELS,
  type Integration,
  type IntegrationCategory,
} from "@/lib/integrations";
import {
  listInterviewRoundTemplates,
  createInterviewRoundTemplate,
  updateInterviewRoundTemplate,
  deleteInterviewRoundTemplate,
  type InterviewRoundTemplate,
} from "@/lib/interview-templates.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings")({
  ssr: false,
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <AppShell>
      <AdminSettingsInner />
    </AppShell>
  );
}

function AdminSettingsInner() {
  const { roles, profileLoaded } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin") || roles.includes("lead_recruiter");

  useEffect(() => {
    if (profileLoaded && !isAdmin) navigate({ to: "/" });
  }, [profileLoaded, isAdmin, navigate]);

  const fetchSettings = useServerFn(listSourceSettings);
  const fetchStatus = useServerFn(getIntegrationStatus);
  const fetchServiceStatus = useServerFn(getServiceIntegrationStatus);

  const { data: settings = [] } = useQuery({
    queryKey: ["scout-source-settings"],
    queryFn: () => fetchSettings(),
    enabled: isAdmin,
  });
  const { data: status } = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => fetchStatus(),
    enabled: isAdmin,
  });
  const { data: serviceStatus = {} } = useQuery({
    queryKey: ["service-integration-status"],
    queryFn: () => fetchServiceStatus(),
    enabled: isAdmin,
  });

  if (!profileLoaded) return null;
  if (!isAdmin) return null;

  return (
    <div className="max-w-4xl space-y-8">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground shadow-sm">
          <SettingsIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Master settings</h1>
          <p className="text-sm text-muted-foreground">Manage integrations, sourcing actors, and AI configuration.</p>
        </div>
      </header>

      <Section icon={Plug} title="Service integrations" subtitle="External services this workspace can use. Grouped by purpose.">
        {INTEGRATION_CATEGORY_ORDER.map((cat) => {
          const items = INTEGRATIONS.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground pt-2">
                {CATEGORY_LABELS[cat]}
              </h3>
              {items.map((i) => (
                <IntegrationRow
                  key={i.id}
                  integration={i}
                  connected={!!serviceStatus[i.id]}
                />
              ))}
            </div>
          );
        })}
      </Section>

      <Section icon={Sparkles} title="Sourcing actors" subtitle="Channels available in Talent Scout. Toggle visibility per channel.">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
            <div className="col-span-3">Channel</div>
            <div className="col-span-5">Actor slug</div>
            <div className="col-span-2">Cost / 1k</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {SCOUT_SOURCES.map((s) => (
            <SourceRow key={s.id} source={s} settings={settings} />
          ))}
        </div>
      </Section>

      <Section icon={Sparkles} title="AI ranking" subtitle="Used after Apify returns results to score candidates against the JD.">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-sm">
          <KV k="Model" v="google/gemini-2.5-flash" />
          <KV k="Max candidates ranked per run" v="50" />
          <KV k="Approx. cost per 200 candidates" v="< $0.05" />
          <p className="text-xs text-muted-foreground pt-2">
            Ranking only runs when a position is selected and the JD is at least 20 chars long. Rejected matches are remembered per position and skipped on future runs.
          </p>
        </div>
      </Section>

      <Section
        icon={CalendarClock}
        title="Interview rounds"
        subtitle="Custom round types available when scheduling interviews. Each round can default to recruiter or client conducted."
      >
        <InterviewRoundTemplates />
      </Section>
    </div>
  );
}

function InterviewRoundTemplates() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInterviewRoundTemplates);
  const createFn = useServerFn(createInterviewRoundTemplate);
  const updateFn = useServerFn(updateInterviewRoundTemplate);
  const deleteFn = useServerFn(deleteInterviewRoundTemplate);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["interview-round-templates"],
    queryFn: () => listFn(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["interview-round-templates"] });

  const createMut = useMutation({
    mutationFn: (vars: { name: string; default_conducted_by: "recruiter" | "client"; default_duration_minutes: number }) =>
      createFn({ data: vars }),
    onSuccess: invalidate,
  });
  const updateMut = useMutation({
    mutationFn: (vars: { id: string } & Partial<InterviewRoundTemplate>) =>
      updateFn({ data: vars as any }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  const [name, setName] = useState("");
  const [conductor, setConductor] = useState<"recruiter" | "client">("recruiter");
  const [duration, setDuration] = useState(60);

  const onAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMut.mutate(
      { name: trimmed, default_conducted_by: conductor, default_duration_minutes: duration },
      {
        onSuccess: () => {
          setName("");
          setConductor("recruiter");
          setDuration(60);
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
        <div className="col-span-5">Round name</div>
        <div className="col-span-3">Default conductor</div>
        <div className="col-span-2">Duration</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      {isLoading && (
        <div className="p-4 text-xs text-muted-foreground">Loading templates…</div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground">
          No custom rounds yet. Built-in rounds (HR Screen, Technical, Hiring Manager, Panel, CEO, Culture Fit, Case Study) are always available.
        </div>
      )}

      {rows.map((t) => (
        <div key={t.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center border-t border-border text-sm">
          <div className="col-span-5 font-medium truncate">
            {t.name}
            {t.archived && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">Archived</span>}
          </div>
          <div className="col-span-3">
            <select
              value={t.default_conducted_by}
              onChange={(e) =>
                updateMut.mutate({ id: t.id, default_conducted_by: e.target.value as any })
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="recruiter">Recruiter</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min={5}
              max={600}
              defaultValue={t.default_duration_minutes}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== t.default_duration_minutes) updateMut.mutate({ id: t.id, default_duration_minutes: v });
              }}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-xs"
            />
            <span className="text-[10px] text-muted-foreground ml-1">min</span>
          </div>
          <div className="col-span-2 flex justify-end gap-1">
            <button
              onClick={() => updateMut.mutate({ id: t.id, archived: !t.archived })}
              className="h-7 px-2 rounded-md border border-border text-[11px] hover:bg-secondary"
            >
              {t.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete round "${t.name}"? Existing interviews keep their label.`)) {
                  deleteMut.mutate(t.id);
                }
              }}
              className="size-7 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center border-t border-border bg-secondary/20">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Technical Round 2"
          className="col-span-5 h-8 rounded-md border border-input bg-background px-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <select
          value={conductor}
          onChange={(e) => setConductor(e.target.value as "recruiter" | "client")}
          className="col-span-3 h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="recruiter">Recruiter</option>
          <option value="client">Client</option>
        </select>
        <input
          type="number"
          min={5}
          max={600}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 60)}
          className="col-span-2 h-8 w-20 rounded-md border border-input bg-background px-2 text-xs"
        />
        <div className="col-span-2 flex justify-end">
          <button
            onClick={onAdd}
            disabled={!name.trim() || createMut.isPending}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="size-3" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof Plug; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground -mt-1">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function IntegrationRow({
  integration,
  connected,
}: {
  integration: Integration;
  connected: boolean;
}) {
  const locked = !integration.hasIntegration;
  const Icon = integration.icon;
  const state: "connected" | "available" | "locked" = locked
    ? "locked"
    : connected
      ? "connected"
      : "available";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 flex items-start gap-3",
        locked && "opacity-60",
      )}
    >
      <div className="size-9 rounded-lg bg-secondary/60 grid place-items-center shrink-0">
        {locked ? (
          <Lock className="size-4 text-muted-foreground" />
        ) : (
          <Icon className="size-4 text-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{integration.label}</span>
          {state === "connected" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <CheckCircle2 className="size-3" /> Connected
            </span>
          )}
          {state === "available" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <XCircle className="size-3" /> Not configured
            </span>
          )}
          {state === "locked" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="size-3" /> Coming soon
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
        {integration.docsHint && (
          <p className="text-[11px] text-muted-foreground mt-1.5">{integration.docsHint}</p>
        )}
      </div>
      <div className="shrink-0">
        {state === "connected" && (
          <span className="text-[11px] text-muted-foreground">Managed in Cloud → Secrets</span>
        )}
        {state === "available" && (
          <span className="text-[11px] text-primary">Open Cloud → Secrets to connect</span>
        )}
      </div>
    </div>
  );
}

function SourceRow({ source, settings }: { source: (typeof SCOUT_SOURCES)[number]; settings: SourceSettingRow[] }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(upsertSourceSetting);
  const override = settings.find((x) => x.source_id === source.id);
  const initialEnabled = override?.enabled ?? source.hasActor;
  const initialSlug = override?.actor_slug ?? source.defaultActorSlug ?? "";
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slug, setSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setEnabled(override?.enabled ?? source.hasActor);
    setSlug(override?.actor_slug ?? source.defaultActorSlug ?? "");
  }, [override, source.hasActor, source.defaultActorSlug]);

  const Icon = source.icon;
  const dirty =
    enabled !== initialEnabled || (source.hasActor && slug !== initialSlug);

  async function save() {
    if (!source.hasActor) return;
    setSaving(true);
    try {
      await saveFn({
        data: {
          source_id: source.id,
          enabled,
          actor_slug: slug || null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["scout-source-settings"] });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 text-sm">
      <div className="col-span-3 flex items-center gap-2 min-w-0">
        {source.hasActor ? <Icon className="size-4 text-muted-foreground" /> : <Lock className="size-4 text-muted-foreground" />}
        <span className="truncate">{source.label}</span>
      </div>
      <div className="col-span-5">
        {source.hasActor ? (
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="username~actor-name"
            className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background"
          />
        ) : (
          <span className="text-xs text-muted-foreground italic">No actor wired yet</span>
        )}
      </div>
      <div className="col-span-2 text-xs text-muted-foreground">{source.costPer1k ?? "—"}</div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        {source.hasActor ? (
          <>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={cn(
                "h-5 w-9 rounded-full transition relative",
                enabled ? "bg-primary" : "bg-muted",
              )}
              aria-label="Toggle enabled"
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-background shadow transition",
                  enabled ? "left-[18px]" : "left-0.5",
                )}
              />
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="h-7 px-2 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-secondary/60 disabled:opacity-40"
              title={savedAt ? "Saved" : "Save changes"}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            </button>
          </>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="size-3" /> Locked
          </span>
        )}
      </div>
    </div>
  );
}