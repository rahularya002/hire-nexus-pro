import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TASK_STATES = [
  "Pending",
  "Ongoing",
  "Interview Pending",
  "Closed",
  "Reopened",
  "No-show",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const TASK_SLAS = ["ok", "warning", "breach"] as const;
export type TaskSla = (typeof TASK_SLAS)[number];

export const DEFAULT_TASK_KINDS = [
  "Call candidate",
  "Confirm interview",
  "Share shortlist",
  "Follow up with client",
  "Schedule interview round",
  "Collect feedback",
] as const;

export type TaskRow = {
  id: string;
  title: string;
  kind: string;
  state: TaskState;
  sla: TaskSla;
  due_at: string | null;
  due_label: string | null;
  assigned_to: string | null;
  client_id: string | null;
  position_id: string | null;
  candidate_id: string | null;
  application_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string; color: string | null } | null;
  position?: { id: string; title: string } | null;
  candidate?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string | null; email: string | null } | null;
};

const taskSchema = z.object({
  title: z.string().min(1).max(300),
  kind: z.string().min(1).max(100).optional(),
  state: z.enum(TASK_STATES).optional(),
  sla: z.enum(TASK_SLAS).optional(),
  due_at: z.string().datetime().optional().nullable(),
  due_label: z.string().max(100).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
  candidate_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
});

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "*, client:clients(id,name,color), position:positions(id,title), candidate:candidates(id,name), assignee:profiles!tasks_assigned_to_fkey(id,full_name,email)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      // Fallback without the optional FK join (no FK constraint yet)
      const { data: d2, error: e2 } = await supabase
        .from("tasks")
        .select(
          "*, client:clients(id,name,color), position:positions(id,title), candidate:candidates(id,name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (e2) throw new Error(e2.message);
      return (d2 ?? []) as TaskRow[];
    }
    return (data ?? []) as TaskRow[];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert(clean({ ...data, created_by: userId }))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TaskRow;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(taskSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("tasks")
      .update(clean(rest))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TaskRow;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveTaskState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), state: z.enum(TASK_STATES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("tasks")
      .update({ state: data.state })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TaskRow;
  });