import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MapPin, Briefcase } from "lucide-react";

const getPublicPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: post } = await client
      .from("job_posts")
      .select("id,title,slug,description_md,location,employment_type,tags,agency_id,status,is_public")
      .eq("slug", data.slug)
      .eq("status", "published")
      .eq("is_public", true)
      .maybeSingle();
    return post as null | {
      id: string; title: string; slug: string; description_md: string;
      location: string | null; employment_type: string | null; tags: string[];
      agency_id: string; status: string; is_public: boolean;
    };
  });

const submitPublicApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      postId: z.string().uuid(),
      applicant_name: z.string().min(1).max(120),
      email: z.string().email().max(200),
      phone: z.string().max(40).optional(),
      cover_note: z.string().max(4000).optional(),
      resume_url: z.string().url().max(800).optional().or(z.literal("")),
      _hp: z.string().max(0).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: post } = await client
      .from("job_posts")
      .select("id,agency_id,status,is_public")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post || post.status !== "published" || !post.is_public) {
      throw new Error("Post not available");
    }
    const { error } = await client.from("job_applications").insert({
      job_post_id: post.id,
      agency_id: post.agency_id,
      channel: "internal",
      applicant_name: data.applicant_name,
      email: data.email,
      phone: data.phone ?? null,
      cover_note: data.cover_note ?? null,
      resume_url: data.resume_url || null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const Route = createFileRoute("/jobs/$slug")({
  loader: async ({ params }) => {
    const post = await getPublicPost({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.post?.title ?? "Job";
    const d = (loaderData?.post?.description_md ?? "").slice(0, 155);
    return {
      meta: [
        { title: `${t} — Careers` },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  notFoundComponent: () => <div className="p-10 text-center text-muted-foreground">Job not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{String(error)}</div>,
  component: PublicJobPage,
});

function PublicJobPage() {
  const { post } = Route.useLoaderData();
  const submit = useServerFn(submitPublicApplication);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ applicant_name: "", email: "", phone: "", cover_note: "", resume_url: "", _hp: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: { postId: post.id, ...form } as any });
      setDone(true);
      toast.success("Application submitted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-xs text-muted-foreground">Careers</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
          {post.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {post.location}</span>}
          {post.employment_type && <span className="inline-flex items-center gap-1"><Briefcase className="size-3.5" /> {post.employment_type}</span>}
        </div>

        <article className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{post.description_md}</article>

        <div className="mt-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Apply</h2>
          {done ? (
            <p className="text-sm text-muted-foreground mt-3">Thanks! We've received your application and will be in touch.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3 mt-4">
              <input type="text" value={form._hp} onChange={(e) => setForm({ ...form, _hp: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input required placeholder="Full name" value={form.applicant_name} onChange={(e) => setForm({ ...form, applicant_name: e.target.value })} className="h-10 px-3 rounded-md border border-input bg-background text-sm" />
                <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 px-3 rounded-md border border-input bg-background text-sm" />
                <input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 px-3 rounded-md border border-input bg-background text-sm" />
                <input placeholder="Resume URL (optional)" value={form.resume_url} onChange={(e) => setForm({ ...form, resume_url: e.target.value })} className="h-10 px-3 rounded-md border border-input bg-background text-sm" />
              </div>
              <textarea placeholder="Cover note" rows={4} value={form.cover_note} onChange={(e) => setForm({ ...form, cover_note: e.target.value })} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
              <button disabled={busy} className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
                {busy && <Loader2 className="size-4 animate-spin" />} Submit application
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}