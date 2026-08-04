import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export type GoogleConnectionStatus = {
  connected: boolean;
  google_email: string | null;
  gmail_enabled: boolean;
};

export const getMyGoogleConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleConnectionStatus> => {
    const { data, error } = await context.supabase
      .from("google_calendar_connections")
      .select("google_email, scopes")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      connected: !!data,
      google_email: data?.google_email ?? null,
      gmail_enabled: !!data?.scopes?.includes("gmail.readonly"),
    };
  });

export const startGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { googleClientId, googleRedirectUri } = await import("./google-calendar.server");
    const host = getRequestHost();
    void host;
    const redirectUri = googleRedirectUri(data.origin);
    const state = `${context.userId}.${crypto.randomUUID()}`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", googleClientId());
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return { authUrl: url.toString(), state };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Revokes only Gmail access for the archive feature, keeping the shared
// connection row (and therefore Calendar/Meet sync) intact.
export const disconnectGmailAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("google_calendar_connections")
      .select("id, scopes")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: true };
    const remaining = (data.scopes ?? "")
      .split(/\s+/)
      .filter((s) => s && !s.includes("gmail."))
      .join(" ");
    const { error: upErr } = await context.supabase
      .from("google_calendar_connections")
      .update({ scopes: remaining })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });