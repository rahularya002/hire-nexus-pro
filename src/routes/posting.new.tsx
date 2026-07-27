import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { listPositions } from "@/lib/positions.functions";
import { createJobPost, publishJobPostChannels, type JobPostChannel } from "@/lib/posting.functions";
import { useJdAutofill } from "@/hooks/use-jd-autofill";
import { GenerateDescriptionButton } from "@/components/generate-description-button";

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
  const [experience, setExperience] = useState("");
  const [compMin, setCompMin] = useState<string>("");
  const [compMax, setCompMax] = useState<string>("");
  const [currency, setCurrency] = useState<string>("INR");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [channels, setChannels] = useState<JobPostChannel[]>(["internal", "linkedin", "naukri", "indeed"]);
  const [busy, setBusy] = useState(false);

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === positionId),
    [positions, positionId],
  );

  const jd = useJdAutofill({
    title,
    description,
    setDescription,
    context: {
      companyName: selectedPosition?.client?.name ?? null,
      location,
      experience,
      employmentType: employment,
      salary: compMin || compMax ? `${compMin || "?"}–${compMax || "?"} ${currency === "INR" ? "LPA" : currency}` : null,
      skills: tags.split(",").map((t) => t.trim()).filter(Boolean),
    },
  });

  function applyPositionPrefill(id: string) {
    setPositionId(id);
    const p = positions.find((x) => x.id === id);
    if (!p) return;
    setTitle(p.title);
    setLocation(p.location ?? "");
    setExperience(p.experience ?? "");
    // Try to parse "12-18" / "12 to 18" from the position salary string
    const s = (p.salary ?? "").toString();
    const m = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–to]+)\s*(\d+(?:\.\d+)?)/i);
    if (m) { setCompMin(m[1]); setCompMax(m[2]); }
    else {
      const one = s.match(/(\d+(?:\.\d+)?)/);
      if (one) { setCompMin(one[1]); setCompMax(""); }
    }
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
          experience: experience.trim() || null,
          comp_min: compMin.trim() ? Number(compMin) : null,
          comp_max: compMax.trim() ? Number(compMax) : null,
          currency: currency || "INR",
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
              onBlur={jd.onTitleBlur}
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
          <Field label="Experience">
            <input
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="3-6 years"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </Field>
          <Field label="Salary range (LPA)">
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 px-2 rounded-md border border-input bg-background text-sm w-20"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
              <input
                value={compMin}
                onChange={(e) => setCompMin(e.target.value)}
                placeholder="Min"
                inputMode="decimal"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              />
              <input
                value={compMax}
                onChange={(e) => setCompMax(e.target.value)}
                placeholder="Max"
                inputMode="decimal"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
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

        <Field
          label="Description"
          action={
            <GenerateDescriptionButton onClick={jd.generate} loading={jd.generating} hasDescription={!!description.trim()} />
          }
        >
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

function Field({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {action}
      </div>
      {children}
    </label>
  );
}