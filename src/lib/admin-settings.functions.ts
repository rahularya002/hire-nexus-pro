import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTEGRATIONS } from "@/lib/integrations";

export type SourceSettingRow = {
  source_id: string;
  enabled: boolean;
  actor_slug: string | null;
  updated_at: string;
  updated_by: string | null;
};

export const listSourceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("scout_source_settings")
      .select("source_id, enabled, actor_slug, updated_at, updated_by");
    if (error) throw new Error(error.message);
    return (data ?? []) as SourceSettingRow[];
  });

const upsertSchema = z.object({
  source_id: z.string().min(1).max(64),
  enabled: z.boolean(),
  actor_slug: z.string().min(1).max(255).nullable().optional(),
});

export const upsertSourceSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scout_source_settings")
      .upsert(
        {
          source_id: data.source_id,
          enabled: data.enabled,
          actor_slug: data.actor_slug ?? null,
          updated_by: userId,
        } as never,
        { onConflict: "source_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Status of optional integrations the app can use. Booleans only — never returns the secret value. */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      apify: Boolean(process.env.APIFY_API_KEY && process.env.LOVABLE_API_KEY),
      lovableAi: Boolean(process.env.LOVABLE_API_KEY),
    };
  });

/** Probe every integration's env vars server-side and return a map of id → connected. */
export const getServiceIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const out: Record<string, boolean> = {};
    for (const i of INTEGRATIONS) {
      if (!i.envVars || i.envVars.length === 0) {
        out[i.id] = false;
        continue;
      }
      // ANY env var present → considered connected. Never return the value.
      out[i.id] = i.envVars.some((name) => Boolean(process.env[name]));
    }
    return out;
  });