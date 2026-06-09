import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InterviewConductor = "recruiter" | "client";

export type InterviewRoundTemplate = {
  id: string;
  name: string;
  default_conducted_by: InterviewConductor;
  default_duration_minutes: number;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  default_conducted_by: z.enum(["recruiter", "client"]).optional(),
  default_duration_minutes: z.number().int().min(5).max(600).optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
  archived: z.boolean().optional(),
});

export const listInterviewRoundTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("interview_round_templates")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as InterviewRoundTemplate[];
  });

export const createInterviewRoundTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_round_templates")
      .insert({ ...data, created_by: userId } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InterviewRoundTemplate;
  });

export const updateInterviewRoundTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(templateSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("interview_round_templates")
      .update(rest)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InterviewRoundTemplate;
  });

export const deleteInterviewRoundTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("interview_round_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });