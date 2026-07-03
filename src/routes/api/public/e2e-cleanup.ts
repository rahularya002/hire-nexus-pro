import { createFileRoute } from "@tanstack/react-router";

// One-off: deletes the pre-created non-superadmin test auth users so the
// real super-admin / agency-admin onboarding flows can recreate them.
// Delete this file after use.

const EMAILS_TO_DELETE = [
  "agency1@gmail.com",
  "agency2@gmail.com",
  "recruiter1@gmail.com",
  "recruiter2@gmail.com",
  "recruiter3@gmail.com",
  "recruiter4@gmail.com",
  "client1@gmail.com",
  "client2@gmail.com",
];

export const Route = createFileRoute("/api/public/e2e-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bootstrap-token") ?? "";
        const expected = process.env.E2E_BOOTSTRAP_TOKEN ?? "";
        if (!expected || token !== expected) {
          return new Response("forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Find user IDs by email
        const idMap = new Map<string, string>();
        let page = 1;
        while (true) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
          if (error) return new Response(error.message, { status: 500 });
          for (const u of data.users) {
            if (u.email && EMAILS_TO_DELETE.includes(u.email.toLowerCase())) {
              idMap.set(u.email.toLowerCase(), u.id);
            }
          }
          if (data.users.length < 200) break;
          page++;
        }

        const results: Array<{ email: string; deleted: boolean; error?: string }> = [];
        for (const email of EMAILS_TO_DELETE) {
          const id = idMap.get(email);
          if (!id) {
            results.push({ email, deleted: false, error: "not found" });
            continue;
          }
          const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
          results.push({ email, deleted: !error, error: error?.message });
        }

        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});