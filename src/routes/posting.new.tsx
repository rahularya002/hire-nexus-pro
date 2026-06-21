import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { listPositions } from "@/lib/positions.functions";
import { createJobPost, publishJobPostChannels, type JobPostChannel } from "@/lib/posting.functions";

export const Route = createFileRoute("/posting/new")({
  component: () => (
    <AppShell>
      <NewPost />
    </AppShell>
  ),
});

const ALL_CHANNELS: { id: JobPostChannel; label: string; hint: string }[] = [
  { id: "internal", label: "Careers page", hint: "Hosted by us" },
  { id: "linkedin", label: "LinkedIn", hint: "One-click via connector" },
  { id: "naukri", label: "Naukri", hint: "Compose + open" },
  { id: "indeed", label: "Indeed", hint: "Compose + open" },
];

function NewPost() {
  const navigate = useNavigate();
  const fetchPositions = useServerFn(listPositions);
  const createPost = useServerFn(createJobPost);
  const publish = useServerFn(publishJobPostChannels);

  const { data: positions = [] } = useQuery({
    queryKey: ["positions-open-for-posting"],
    queryFn: () => fetchPositions(),
  });

  const [mode, setMode] = useState<"position" | "free">("position");
  const [positionId, setPositionId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [employment, setEmployment] = useState("Full-time");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [channels, setChannels] = useState<JobPostChannel[]>(["internal", "linkedin", "naukri", "indeed"]);
  const [busy, setBusy] = useState(false);

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === positionId),
    [positions, positionId],
  );

  function applyPositionPrefill(id: string) {
    setPositionId(id);
    const p = positions.find((x) => x.id === id);
    if (!p) return;
    setTitle(p.title);
    setLocation(p.location ?? "");
    setDescription(p.description ?? "");
    setTags((p.skills ?? []).join(", "));
  }

  function toggleChannel(c: JobPostChannel) {
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  async function handleSave(publishNow: boolean) {
    if (!title.trim()) {
      toast.error("Add a title");
      return;
    }
    if (channels.length === 0) {
      toast.error("Pick at least one channel");
      return;
    }
    setBusy(true);
    try {
      const post = await createPost({
        data: {
          position_id: mode === "position" ? positionId || null : null,
          title: title.trim(),
          description_md: description,
          location: location || null,
          employment_type: employment || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          is_public: true,
          channels,
        },
      });
      if (publishNow) {
        const res = await publish({ data: { postId: post.id, channels } });
        const fails = Object.entries(res.results).filter(([, v]) => v.status === "failed");
        if (fails.length) toast.warning(`Published with ${fails.length} channel error(s)`);
        else toast.success("Post published");
      } else {
        toast.success("Saved as draft");
      }
      navigate({ to: "/posting/$postId", params: { postId: post.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link to="/posting" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3" /> Back to posts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2 flex items-center gap-2">
          <Megaphone className="size-5 text-info" /> New job post
        </h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex gap-1 p-1 bg-secondary/60 rounded-lg w-fit text-sm">
          <button
            type="button"
            onClick={() => setMode("position")}
            className={`px-3 py-1.5 rounded-md ${mode === "position" ? "bg-card shadow-sm font-medium" : ""}`}
          >
            From a position
          </button>
          <button
            type="button"
            onClick={() => setMode("free")}
            className={`px-3 py-1.5 rounded-md ${mode === "free" ? "bg-card shadow-sm font-medium" : ""}`}
          >
            Free-form
          </button>
        </div>

        {mode === "position" && (
          <Field label="Position">
            <select
              value={positionId}
              onChange={(e) => applyPositionPrefill(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Select an open position…</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.client?.name ? `— ${p.client.name}` : ""}
                </option>
              ))}
            </select>
            {selectedPosition && (
              <p className="text-xs text-muted-foreground mt-1.5">Prefilled from position. Edit freely below.</p>
            )}
          </Field>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Senior Backend Engineer"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bengaluru / Remote"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </Field>
          <Field label="Employment type">
            <input
              value={employment}
              onChange={(e) => setEmployment(e.target.value)}
              placeholder="Full-time"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </Field>
          <Field label="Tags / skills (comma separated)">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="node, postgres, aws"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
            placeholder={"What the role does, who you're looking for, perks, how to apply…"}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Renders as text on each channel. LinkedIn is capped at ~3000 characters.</p>
        </Field>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Channels</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {ALL_CHANNELS.map((c) => {
              const on = channels.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleChannel(c.id)}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    on ? "border-primary/60 bg-primary/5" : "border-border bg-background hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className={`size-3.5 rounded border ${on ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSave(false)}
            className="h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary/60 disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSave(true)}
            className="h-9 px-3 rounded-md bg-foreground text-background text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />} Publish now
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}