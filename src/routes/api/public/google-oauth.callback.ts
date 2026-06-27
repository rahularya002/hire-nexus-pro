import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        const closeHtml = (msg: string, ok: boolean) => `<!doctype html><html><body style="font-family:system-ui;padding:24px;background:#0a0a0a;color:#fafafa">
<h2>${ok ? "✓ Google Calendar connected" : "× Connection failed"}</h2>
<p>${msg}</p>
<p style="opacity:.6">Redirecting you back to Settings…</p>
<script>try{window.opener&&window.opener.postMessage({type:"google-oauth",ok:${ok}},"*");window.close();}catch(e){}setTimeout(()=>{if(!window.closed)window.location.replace("/settings?google=${ok ? "ok" : "err"}");},1200);</script>
</body></html>`;

        if (errorParam) {
          return new Response(closeHtml(`Google returned: ${errorParam}`, false), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          });
        }
        if (!code || !state) {
          return new Response(closeHtml("Missing code or state", false), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          });
        }
        const userId = state.split(".")[0];
        if (!userId) {
          return new Response(closeHtml("Invalid state", false), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          });
        }

        try {
          const { exchangeCodeForTokens, fetchGoogleUserEmail, googleRedirectUri } =
            await import("@/lib/google-calendar.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const origin = `${url.protocol}//${url.host}`;
          const redirectUri = googleRedirectUri(origin);
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (!tokens.refresh_token) {
            return new Response(
              closeHtml("Google did not return a refresh token. Revoke access in your Google account and try again.", false),
              { status: 400, headers: { "Content-Type": "text/html" } },
            );
          }
          const userInfo = await fetchGoogleUserEmail(tokens.access_token);
          const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error } = await supabaseAdmin
            .from("google_calendar_connections")
            .upsert(
              {
                user_id: userId,
                google_email: userInfo.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at,
                scopes: tokens.scope,
              },
              { onConflict: "user_id" },
            );
          if (error) throw new Error(error.message);

          return new Response(closeHtml(`Connected as ${userInfo.email}`, true), {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        } catch (e) {
          return new Response(closeHtml((e as Error).message, false), {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }
      },
    },
  },
});