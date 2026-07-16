import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Copy, RefreshCw, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getJobPost,
  listJobApplications,
  publishJobPostChannels,
  convertJobApplicationToCandidate,
  rejectJobApplication,
  type JobPostChannel,
} from "@/lib/posting.functions";

export const Route = createFileRoute("/posting/$postId")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  naukri: "Naukri",
  indeed: "Indeed",
  internal: "Careers page",
};

function Page() {
  const { postId } = Route.useParams();
  const qc = useQueryClient();
  const fetchPost = useServerFn(getJobPost);
  const fetchApps = useServerFn(listJobApplications);
  const publish = useServerFn(publishJobPostChannels);
  const convert = useServerFn(convertJobApplicationToCandidate);
  const reject = useServerFn(rejectJobApplication);

  const { data: post, isLoading } = useQuery({
    queryKey: ["job-post", postId],
    queryFn: () => fetchPost({ data: { id: postId } }),
  });
  const { data: apps = [] } = useQuery({
    queryKey: ["job-applications", postId],
    queryFn: () => fetchApps({ data: { postId } }),
  });

  const [busyCh, setBusyCh] = useState<string | null>(null);

  async function republish(ch: JobPostChannel) {
    setBusyCh(ch);
    try {
      const res = await publish({ data: { postId, channels: [ch] } });
      const r = res.results[ch];
      if (r?.status === "failed") toast.error(r.error ?? "Publish failed");
      else if (r?.status === "manual") toast.message("Open the compose tab to finish posting");
      else toast.success(`Published to ${CHANNEL_LABEL[ch]}`);
      qc.invalidateQueries({ queryKey: ["job-post", postId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusyCh(null);
    }
  }

  async function handleConvert(appId: string) {
    try {
      await convert({ data: { applicationId: appId, positionId: post?.position_id ?? null } });
      toast.success("Converted to candidate");
      qc.invalidateQueries({ queryKey: ["job-applications", postId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function handleReject(appId: string) {
    try {
      await reject({ data: { id: appId } });
      qc.invalidateQueries({ queryKey: ["job-applications", postId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>;
  }
  if (!post) {
    return <div className="text-sm text-muted-foreground">Post not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link to="/posting" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3" /> Back to posts
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              {post.location ?? "—"} · {post.employment_type ?? "Full-time"}
              {post.experience ? ` · ${post.experience}` : ""}
              {(post.comp_min != null || post.comp_max != null)
                ? ` · ${post.comp_min ?? ""}${post.comp_max != null ? `–${post.comp_max}` : ""} ${(post.currency ?? "INR") === "INR" ? "LPA" : (post.currency ?? "")}`
                : ""}
              {" · "}status <b>{post.status}</b>
            </div>
          </div>
          {post.status === "published" && (
            <a
              href={`/jobs/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm px-3 h-9 rounded-md border border-border hover:bg-secondary/60"
            >
              <ExternalLink className="size-3.5" /> View careers page
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Channels</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {(post.channels ?? []).map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{CHANNEL_LABEL[c.channel] ?? c.channel}</div>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary/70">{c.status}</span>
              </div>
              {c.error && <div className="text-xs text-destructive mt-1">{c.error}</div>}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {c.external_url && (
                  <a
                    href={c.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" /> Open
                  </a>
                )}
                {(c.channel === "naukri" || c.channel === "indeed") && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${post.title}\n\n${post.description_md}`);
                      toast.success("Copied — paste into the compose tab");
                    }}
                    className="text-xs inline-flex items-center gap-1 px-2 h-7 rounded-md border border-border hover:bg-secondary/60"
                  >
                    <Copy className="size-3" /> Copy JD
                  </button>
                )}
                <button
                  disabled={busyCh === c.channel}
                  onClick={() => republish(c.channel as JobPostChannel)}
                  className="text-xs inline-flex items-center gap-1 px-2 h-7 rounded-md border border-border hover:bg-secondary/60 ml-auto disabled:opacity-60"
                >
                  {busyCh === c.channel ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  {c.status === "published" ? "Republish" : "Publish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Applicants ({apps.length})</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet. Share the careers page link to start collecting.</p>
        ) : (
          <div className="divide-y divide-border">
            {apps.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{a.applicant_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.email ?? "—"} {a.phone ? `· ${a.phone}` : ""} · via {a.channel} · {new Date(a.created_at).toLocaleDateString()}
                  </div>
                  {a.cover_note && <div className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-xl">{a.cover_note}</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary/70">{a.status}</span>
                  {a.resume_url && (
                    <a href={a.resume_url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 h-7 rounded-md border border-border inline-flex items-center gap-1 hover:bg-secondary/60">
                      <ExternalLink className="size-3" /> Resume
                    </a>
                  )}
                  {a.status !== "converted" && a.status !== "rejected" && (
                    <>
                      <button onClick={() => handleConvert(a.id)} className="text-xs px-2 h-7 rounded-md bg-foreground text-background inline-flex items-center gap-1">
                        <UserPlus className="size-3" /> Convert
                      </button>
                      <button onClick={() => handleReject(a.id)} className="text-xs px-2 h-7 rounded-md border border-border inline-flex items-center gap-1 hover:bg-secondary/60">
                        <X className="size-3" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}