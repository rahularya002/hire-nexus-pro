import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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