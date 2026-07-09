import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone, ExternalLink, Users, Loader2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { listJobPosts, type JobPostRow } from "@/lib/posting.functions";

export const Route = createFileRoute("/posting/")({
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

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-success/10 text-success"
      : status === "failed"
      ? "bg-destructive/10 text-destructive"
      : status === "manual"
      ? "bg-warning/10 text-warning"
      : status === "publishing"
      ? "bg-info/10 text-info"
      : "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{status}</span>;
}

function Page() {
  const fetchPosts = useServerFn(listJobPosts);
  const { data: posts = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["job-posts"],
    queryFn: () => fetchPosts(),
    retry: 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job posting</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish a role to LinkedIn, Naukri, Indeed, and your careers page — then watch applicants flow in.
          </p>
        </div>
        <Link
          to="/posting/new"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90"
        >
          <Plus className="size-4" /> New post
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading posts…</div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 flex items-start gap-3">
          <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm">Couldn't load job posts</div>
            <p className="text-xs text-muted-foreground mt-1 break-words">
              {(error as Error)?.message ?? "Something went wrong."}
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium disabled:opacity-60"
            >
              {isFetching && <Loader2 className="size-3 animate-spin" />} Retry
            </button>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}

function PostCard({ post }: { post: JobPostRow }) {
  const status = post.status ?? "draft";
  const count = post.applications_count ?? 0;
  return (
    <Link
      to="/posting/$postId"
      params={{ postId: post.id }}
      className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{post.title ?? "Untitled"}</h3>
            <StatusPill status={status} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {post.location ?? "Remote / unspecified"} · created {post.created_at ? new Date(post.created_at).toLocaleDateString() : "—"}
          </div>
        </div>
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Users className="size-3.5" /> {count} applicant{count === 1 ? "" : "s"}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(post.channels ?? []).map((ch) => (
          <div key={ch.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-secondary/60">
            <span className="font-medium">{CHANNEL_LABEL[ch.channel] ?? ch.channel}</span>
            <StatusPill status={ch.status} />
            {ch.external_url && (
              <a
                href={ch.external_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto size-12 rounded-xl bg-info/10 text-info grid place-items-center">
        <Megaphone className="size-6" />
      </div>
      <h2 className="mt-4 font-semibold">No job posts yet</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
        Compose a post once and publish it to LinkedIn, Naukri, Indeed, and your careers page in a single click.
      </p>
      <Link
        to="/posting/new"
        className="mt-5 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-foreground text-background text-sm font-medium"
      >
        <Plus className="size-4" /> Create your first post
      </Link>
    </div>
  );
}