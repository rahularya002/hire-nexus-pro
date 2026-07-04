import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type Attachment = {
  id: string;
  name: string;
  sizeBytes: number;
  mime: string;
  bucket: string;
  path: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_role: "staff" | "client";
  author_name: string;
  initials: string;
  body: string;
  attachments: Attachment[];
  read_by_client_at: string | null;
  read_by_staff_at: string | null;
  created_at: string;
};

export type ThreadRow = {
  id: string;
  client_id: string | null;
  agency_id: string | null;
  kind: "client_recruiter" | "client_manager" | "team_room" | "team_dm";
  participant_a?: string | null;
  participant_b?: string | null;
  subject: string | null;
  pinned: boolean;
  last_message_at: string | null;
  created_at: string;
  client?: {
    id: string;
    name: string;
    color: string | null;
    contact_name: string | null;
  } | null;
  other_participant?: {
    user_id: string;
    name: string;
    initials: string;
  } | null;
  last_message?: MessageRow | null;
  unread_count?: number;
};

function normalizeAttachments(a: Json): Attachment[] {
  if (!Array.isArray(a)) return [];
  return a as unknown as Attachment[];
}

async function ensureThreadFor(
  ctx: { supabase: any },
  clientId: string,
  kind: "client_recruiter" | "client_manager" = "client_recruiter",
): Promise<string> {
  const { data: existing } = await ctx.supabase
    .from("message_threads")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await ctx.supabase
    .from("message_threads")
    .insert({ client_id: clientId, kind })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Ensure a thread exists for every client so staff list isn't empty
    const { data: clientsList } = await supabase.from("clients").select("id");
    for (const c of clientsList ?? []) {
      await ensureThreadFor({ supabase }, c.id, "client_recruiter");
    }

    const { data: threads, error } = await supabase
      .from("message_threads")
      .select("id, client_id, agency_id, kind, subject, pinned, last_message_at, created_at")
      .in("kind", ["client_recruiter", "client_manager"])
      .order("pinned", { ascending: false })
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const clientIds = Array.from(new Set((threads ?? []).map((t: any) => t.client_id)));
    const clientMap = new Map<string, { id: string; name: string; color: string | null; contact_name: string | null }>();
    if (clientIds.length) {
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, name, color, contact_name")
        .in("id", clientIds);
      for (const c of (clientRows ?? []) as any[]) clientMap.set(c.id, c);
    }

    const threadIds = (threads ?? []).map((t: any) => t.id);
    const lastMap = new Map<string, MessageRow>();
    const unreadMap = new Map<string, number>();
    if (threadIds.length) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false });
      for (const m of msgs ?? []) {
        const row: MessageRow = {
          ...(m as any),
          attachments: normalizeAttachments((m as any).attachments),
        };
        if (!lastMap.has(row.thread_id)) lastMap.set(row.thread_id, row);
        if (row.sender_role === "client" && !row.read_by_staff_at) {
          unreadMap.set(row.thread_id, (unreadMap.get(row.thread_id) ?? 0) + 1);
        }
      }
    }

    return (threads ?? []).map((t: any) => ({
      ...t,
      client: clientMap.get(t.client_id) ?? null,
      last_message: lastMap.get(t.id) ?? null,
      unread_count: unreadMap.get(t.id) ?? 0,
    })) as ThreadRow[];
  });

export const getOrCreateThreadForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        kind: z.enum(["client_recruiter", "client_manager"]).optional(),
      })
      .optional()
      .parse(d) ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let clientId = data?.clientId;
    const kind = data?.kind ?? "client_recruiter";
    if (!clientId) {
      const { data: own } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!own?.id) throw new Error("No client account is linked to this user.");
      clientId = own.id;
    }
    const id = await ensureThreadFor({ supabase }, clientId, kind);
    const { data: thread } = await supabase
      .from("message_threads")
      .select("id, client_id, agency_id, kind, subject, pinned, last_message_at, created_at")
      .eq("id", id)
      .single();
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, color, contact_name")
      .eq("id", clientId)
      .maybeSingle();
    return { ...(thread as any), client: client ?? null } as ThreadRow;
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (msgs ?? []).map((m: any) => ({
      ...m,
      attachments: normalizeAttachments(m.attachments),
    })) as MessageRow[];
  });

const attachmentSchema = z.object({
  id: z.string().max(120),
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(0),
  mime: z.string().min(1).max(200),
  bucket: z.string().min(1).max(80),
  path: z.string().min(1).max(500),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        body: z.string().max(8000).default(""),
        attachments: z.array(attachmentSchema).max(10).default([]),
        senderRole: z.enum(["staff", "client"]),
        authorName: z.string().min(1).max(200),
        initials: z.string().min(1).max(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trimmed = data.body.trim();
    if (!trimmed && data.attachments.length === 0) {
      throw new Error("Message is empty.");
    }
    const stamp =
      data.senderRole === "staff"
        ? { read_by_staff_at: new Date().toISOString() }
        : { read_by_client_at: new Date().toISOString() };
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        thread_id: data.threadId,
        sender_id: userId,
        sender_role: data.senderRole,
        author_name: data.authorName,
        initials: data.initials.toUpperCase().slice(0, 4),
        body: trimmed,
        attachments: data.attachments as unknown as Json,
        ...stamp,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      ...(row as any),
      attachments: normalizeAttachments((row as any).attachments),
    } as MessageRow;
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        viewer: z.enum(["staff", "client"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const col: "read_by_staff_at" | "read_by_client_at" =
      data.viewer === "staff" ? "read_by_staff_at" : "read_by_client_at";
    const otherRole = data.viewer === "staff" ? "client" : "staff";
    const update: Record<string, string> = { [col]: new Date().toISOString() };
    const { error } = await supabase
      .from("messages")
      .update(update as any)
      .eq("thread_id", data.threadId)
      .eq("sender_role", otherRole)
      .is(col, null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSignedAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bucket: z.string().min(1).max(80),
        path: z.string().min(1).max(500),
        expiresIn: z.number().int().min(30).max(3600).default(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from(data.bucket)
      .createSignedUrl(data.path, data.expiresIn);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });