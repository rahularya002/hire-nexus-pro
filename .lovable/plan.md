## Goal
Stop using the manually-stored `APIFY_API_TOKEN` and route all Apify calls through your newly connected Apify connector (gateway-backed).

## Steps

1. **Link the connection to this project**
   Your "Pawan's Apify" connection exists in the workspace but is not yet linked to this project. I'll open the connect card so it gets linked — that injects `APIFY_API_KEY` into the server runtime.

2. **Rewrite the Apify call helper** (`src/lib/apify.server.ts`)
   Replace the direct `api.apify.com/v2/...?token=` call in `callApifyActor` with a gateway call:
   - Base: `https://connector-gateway.lovable.dev/apify` (already includes `/v2`)
   - Path: `/acts/{actorId}/run-sync-get-dataset-items?timeout=...`
   - Headers: `Authorization: Bearer ${LOVABLE_API_KEY}`, `X-Connection-Api-Key: ${APIFY_API_KEY}`
   - No token in the URL anymore.
   - On non-OK responses, log and surface the gateway status + body (keeps the current error message shape).

3. **Update status/integration reporting**
   - `src/lib/admin-settings.functions.ts`: `apify` status becomes `Boolean(process.env.APIFY_API_KEY && process.env.LOVABLE_API_KEY)`.
   - `src/lib/integrations.ts`: change the Apify entry to `kind: "connector"`, `connectorId: "apify"`, `envVars: ["APIFY_API_KEY"]`, and update the hint to "Connected via the Apify connector".

4. **Verify**
   Make a live gateway call (e.g. `/users/me`) from the sandbox to confirm credentials work, then run a small LinkedIn actor search through the Scout flow path to confirm dataset items come back.

## Notes
- Actor IDs stay the same (`harvestapi~linkedin-profile-search`, etc.), still overridable via env.
- The old `APIFY_API_TOKEN` secret becomes unused; I can delete it after the connector path is verified if you'd like.
