import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobPostChannel = "linkedin" | "naukri" | "indeed" | "internal";
export type JobPostChannelStatus = "pending" | "publishing" | "published" | "failed" | "manual";
export type JobPostStatus = "draft" | "published" | "closed";

export type JobPostRow = {
  id: string;
  agency_id: string;
  position_id: string | null;
  title: string;
  slug: string;
  description_md: string;
  location: string | null;
  employment_type: string | null;
  comp_min: number | null;
  comp_max: number | null;
  currency: string | null;
  tags: string[];
  status: JobPostStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  channels?: JobPostChannelRow[];
  applications_count?: number;
};

export type JobPostChannelRow = {
  id: string;
  job_post_id: string;
  channel: JobPostChannel;
  status: JobPostChannelStatus;
  external_post_id: string | null;
  external_url: string | null;
  error: string | null;
  published_at: string | null;
  last_synced_at: string | null;
};

export type JobApplicationRow = {
  id: string;
  job_post_id: string;
  channel: JobPostChannel;
  applicant_name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  cover_note: string | null;
  source_url: string | null;
  status: "new" | "reviewed" | "converted" | "rejected";
  candidate_id: string | null;
  created_at: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "post";
}

const upsertSchema = z.object({
  position_id: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(200),
  description_md: z.string().max(20_000).default(""),
  location: z.string().max(200).nullable().optional(),
  employment_type: z.string().max(80).nullable().optional(),
  comp_min: z.number().nullable().optional(),
  comp_max: z.number().nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  is_public: z.boolean().default(true),
  channels: z.array(z.enum(["linkedin", "naukri", "indeed", "internal"])).default(["internal"]),
});

export const listJobPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Scope to caller's agency. Non-agency users (clients, unassigned) see nothing.
    const { data: membership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership?.agency_id) return [] as JobPostRow[];
    const { data: posts, error } = await supabase
      .from("job_posts")
      .select("*, channels:job_post_channels(*)")
      .eq("agency_id", membership.agency_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (posts ?? []).map((p: any) => p.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("job_post_id")
        .in("job_post_id", ids);
      for (const a of apps ?? []) counts[a.job_post_id] = (counts[a.job_post_id] ?? 0) + 1;
    }
    return (posts ?? []).map((p: any) => ({
      ...p,
      channels: p.channels ?? [],
      applications_count: counts[p.id] ?? 0,
    })) as JobPostRow[];
  });

export const getJobPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: post, error } = await supabase
      .from("job_posts")
      .select("*, channels:job_post_channels(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return post as JobPostRow | null;
  });

export const createJobPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const baseSlug = slugify(data.title) + "-" + Math.random().toString(36).slice(2, 7);
    const { data: post, error } = await supabase
      .from("job_posts")
      .insert({
        position_id: data.position_id ?? null,
        title: data.title,
        slug: baseSlug,
        description_md: data.description_md ?? "",
        location: data.location ?? null,
        employment_type: data.employment_type ?? null,
        comp_min: data.comp_min ?? null,
        comp_max: data.comp_max ?? null,
        currency: data.currency ?? "INR",
        tags: data.tags ?? [],
        is_public: data.is_public,
        status: "draft",
        created_by: userId,
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.channels?.length) {
      const rows = data.channels.map((ch) => ({ job_post_id: post.id, channel: ch, status: "pending" as const }));
      const { error: chErr } = await supabase.from("job_post_channels").insert(rows as any);
      if (chErr) throw new Error(chErr.message);
    }
    return post as JobPostRow;
  });

export const updateJobPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: upsertSchema.partial().omit({ channels: true }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("job_posts").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteJobPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("job_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Build the per-channel formatted payload preview
function buildChannelPayload(post: { title: string; description_md: string; location: string | null }) {
  const header = `🚀 We're hiring — ${post.title}` + (post.location ? ` (${post.location})` : "");
  return `${header}\n\n${post.description_md}\n\n#hiring #jobs`;
}

export const publishJobPostChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      postId: z.string().uuid(),
      channels: z.array(z.enum(["linkedin", "naukri", "indeed", "internal"])).min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: post, error } = await supabase
      .from("job_posts")
      .select("*")
      .eq("id", data.postId)
      .maybeSingle();
    if (error || !post) throw new Error(error?.message ?? "Post not found");

    const results: Record<string, { status: JobPostChannelStatus; url?: string; error?: string }> = {};
    const payload = buildChannelPayload(post);

    for (const channel of data.channels) {
      try {
        if (channel === "internal") {
          // mark post itself published + public, channel published
          await supabase.from("job_posts").update({ status: "published", is_public: true }).eq("id", post.id);
          const url = `/jobs/${post.slug}`;
          await supabase.from("job_post_channels").update({
            status: "published",
            external_url: url,
            published_at: new Date().toISOString(),
            error: null,
          }).eq("job_post_id", post.id).eq("channel", channel);
          results[channel] = { status: "published", url };
        } else if (channel === "linkedin") {
          const lovableKey = process.env.LOVABLE_API_KEY;
          const liKey = process.env.LINKEDIN_API_KEY;
          if (!lovableKey || !liKey) {
            await supabase.from("job_post_channels").update({
              status: "manual",
              error: "LinkedIn connector not linked. Use Connect to enable one-click posting.",
            }).eq("job_post_id", post.id).eq("channel", channel);
            results[channel] = { status: "manual", error: "connector_not_linked" };
            continue;
          }
          // Fetch member URN
          const meRes = await fetch("https://connector-gateway.lovable.dev/linkedin/v2/userinfo", {
            headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": liKey },
          });
          if (!meRes.ok) throw new Error(`LinkedIn userinfo failed: ${meRes.status}`);
          const me = await meRes.json() as { sub?: string };
          const author = `urn:li:person:${me.sub}`;
          const body = {
            author,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: payload.slice(0, 2950) },
                shareMediaCategory: "NONE",
              },
            },
            visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
          };
          const r = await fetch("https://connector-gateway.lovable.dev/linkedin/v2/ugcPosts", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": liKey,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify(body),
          });
          if (!r.ok) {
            const txt = await r.text();
            throw new Error(`LinkedIn post failed (${r.status}): ${txt.slice(0, 200)}`);
          }
          const j = await r.json() as { id?: string };
          const externalId = j.id ?? null;
          const url = externalId ? `https://www.linkedin.com/feed/update/${externalId}` : null;
          await supabase.from("job_post_channels").update({
            status: "published",
            external_post_id: externalId,
            external_url: url,
            published_at: new Date().toISOString(),
            error: null,
          }).eq("job_post_id", post.id).eq("channel", channel);
          results[channel] = { status: "published", url: url ?? undefined };
        } else {
          // naukri / indeed — no public posting API; surface manual flow
          const compose =
            channel === "naukri"
              ? "https://www.naukri.com/recruit/post-a-job"
              : "https://employers.indeed.com/p/post-job";
          await supabase.from("job_post_channels").update({
            status: "manual",
            external_url: compose,
            error: null,
          }).eq("job_post_id", post.id).eq("channel", channel);
          results[channel] = { status: "manual", url: compose };
        }
      } catch (e: any) {
        await supabase.from("job_post_channels").update({
          status: "failed",
          error: String(e?.message ?? e),
        }).eq("job_post_id", post.id).eq("channel", channel);
        results[channel] = { status: "failed", error: String(e?.message ?? e) };
      }
    }
    return { results, payload };
  });

export const listJobApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("job_applications")
      .select("*")
      .eq("job_post_id", data.postId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as JobApplicationRow[];
  });

export const convertJobApplicationToCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      applicationId: z.string().uuid(),
      positionId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: app, error } = await supabase
      .from("job_applications").select("*").eq("id", data.applicationId).maybeSingle();
    if (error || !app) throw new Error(error?.message ?? "Application not found");

    const { data: cand, error: cErr } = await supabase
      .from("candidates")
      .insert({
        name: app.applicant_name,
        email: app.email,
        phone: app.phone,
        resume_url: app.resume_url,
        source: "inbound",
        created_by: userId,
        notes: app.cover_note,
      } as any)
      .select("id").single();
    if (cErr) throw new Error(cErr.message);

    if (data.positionId) {
      await supabase.from("applications").insert({
        candidate_id: cand.id,
        position_id: data.positionId,
        stage: "sourcing",
        created_by: userId,
      } as any);
    }
    await supabase.from("job_applications").update({
      status: "converted",
      candidate_id: cand.id,
    }).eq("id", data.applicationId);
    return { candidateId: cand.id };
  });

export const rejectJobApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("job_applications").update({ status: "rejected" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });