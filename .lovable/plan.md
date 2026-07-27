## Change
One-line guard fix in `src/lib/apify.server.ts` (email enrichment fallback):

- Replace `if (p.profile_url && process.env.APIFY_API_TOKEN)` with `if (p.profile_url && process.env.APIFY_API_KEY)` so the Apify contact-info-scraper fallback runs off the connector credential instead of the retired manual token.

## Not doing
- GitHub stays on the free public REST API.
- Naukri stays on mock profiles.

## Verify
Typecheck the change; no behavior change beyond the fallback branch now being reachable again.
