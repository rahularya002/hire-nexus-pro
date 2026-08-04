import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleConnection = {
  id: string;
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string;
};

export function googleClientId() {
  const v = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");
  return v;
}
export function googleClientSecret() {
  const v = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET not configured");
  return v;
}

export function googleRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/google-oauth/callback`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refresh_token: string) {
  const body = new URLSearchParams({
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export async function fetchGoogleUserEmail(access_token: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return (await res.json()) as { email: string };
}

export async function getConnectionForUser(userId: string): Promise<GoogleConnection | null> {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GoogleConnection | null) ?? null;
}

export async function getValidAccessToken(userId: string): Promise<GoogleConnection | null> {
  const conn = await getConnectionForUser(userId);
  if (!conn) return null;
  const expiresAt = new Date(conn.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return conn;
  // refresh
  let refreshed: Awaited<ReturnType<typeof refreshAccessToken>>;
  try {
    refreshed = await refreshAccessToken(conn.refresh_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Refresh token revoked/expired: the connection is dead. Remove it so the
    // app shows "not connected" and the user can re-authorize, instead of 500ing.
    if (msg.includes("invalid_grant")) {
      await supabaseAdmin.from("google_calendar_connections").delete().eq("id", conn.id);
      return null;
    }
    throw e;
  }
  const new_expires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, expires_at: new_expires })
    .eq("id", conn.id);
  if (error) throw new Error(error.message);
  return { ...conn, access_token: refreshed.access_token, expires_at: new_expires };
}

type EventArgs = {
  summary: string;
  description?: string;
  startISO: string;
  durationMinutes: number;
  attendees: { email: string; displayName?: string }[];
  createMeet: boolean;
};

export async function createCalendarEvent(accessToken: string, args: EventArgs) {
  const endISO = new Date(new Date(args.startISO).getTime() + args.durationMinutes * 60_000).toISOString();
  const body: any = {
    summary: args.summary,
    description: args.description,
    start: { dateTime: args.startISO },
    end: { dateTime: endISO },
    attendees: args.attendees,
  };
  if (args.createMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  const url = `${CAL_BASE}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar create failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; hangoutLink?: string; htmlLink?: string };
}

export async function patchCalendarEvent(
  accessToken: string,
  eventId: string,
  patch: Partial<EventArgs>,
) {
  const body: any = {};
  if (patch.summary) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.startISO && patch.durationMinutes) {
    body.start = { dateTime: patch.startISO };
    body.end = { dateTime: new Date(new Date(patch.startISO).getTime() + patch.durationMinutes * 60_000).toISOString() };
  }
  if (patch.attendees) body.attendees = patch.attendees;
  const url = `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar patch failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; hangoutLink?: string };
}

export async function deleteCalendarEvent(accessToken: string, eventId: string) {
  const url = `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete failed: ${res.status} ${await res.text()}`);
  }
}