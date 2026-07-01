# Naukri scraping + LinkedIn email enrichment

## 1. Naukri via Apify

Naukri doesn't expose a public API and blocks unauth scraping aggressively. The realistic path is an Apify actor that logs in with a recruiter Naukri account (cookie-based) and pulls candidate profiles from resdex-style search results.

### Actor choice
Use a hosted community actor as the default and let it be overridden via env:
- Default: `jupri/naukri-scraper` (or `dtrungtin/naukri-scraper` — both public on Apify store; keyword + location + pagination input).
- Override: `APIFY_NAUKRI_ACTOR` env var.
- Naukri Resdex (paid candidate DB with emails/phones) requires a logged-in recruiter session cookie. That is added as an optional secret `NAUKRI_COOKIE`; without it we get public job-seeker profiles only (name, headline, current company, location, experience, skills — no email/phone).

### Wiring
- `src/lib/apify.server.ts`
  - Add `naukri` to `APIFY_ACTORS`.
  - Add `normalizeNaukri()` mapping fields: `name`, `title`/`designation` → headline, `currentCompany`, `location`, `totalExperience` → experience_years, `keySkills`/`skills` → skills, `email`, `mobile`/`phone`, `profileUrl`.
  - Extend `buildActorInput()` with a `naukri` branch: `{ keyword, location, experience, maxItems, cookie: process.env.NAUKRI_COOKIE }`.
  - Extend `normalizeForSource()`.
- `src/lib/scout-sources.ts`: add a Naukri source entry (`hasActor: true`, cost `~$3/1k`).
- `src/lib/apify.functions.ts`: include `naukri` in the source fan-out and merge results the same way LinkedIn/GitHub are merged.
- Add secret request for `APIFY_API_TOKEN` (already present) + optional `NAUKRI_COOKIE` for Resdex-grade enrichment.

### UI
- `src/components/scout-results.tsx` + sourcing hub already iterate sources — Naukri will appear automatically once added to `SCOUT_SOURCES`. Add a Naukri icon (`Briefcase`) and a small note when `NAUKRI_COOKIE` is missing: "Add recruiter cookie to unlock emails and phone numbers".

## 2. LinkedIn emails

LinkedIn does not expose emails in public profile scrapes — no Apify actor for public search returns them reliably. Two workable options:

### Option A (recommended): email-finder enrichment step
After ranking, for shortlisted candidates only (cost control), call an email-finder actor/API with `{ firstName, lastName, company/domain }` and merge the result into `email`:
- Default actor: `apify/contact-info-scraper` or `harvestapi~linkedin-email-finder` (env override `APIFY_EMAIL_FINDER_ACTOR`).
- Alternative provider: Hunter.io / Apollo / Snov.io via API key secret (`HUNTER_API_KEY` etc.) — cheaper and more accurate than LinkedIn-specific finders.
- Add a small `enrichEmails(profiles)` helper in `apify.server.ts` and call it in `apify.functions.ts` only for the top-N ranked profiles.

### Option B: switch LinkedIn actor
`harvestapi~linkedin-profile-search` returns emails only when the profile publicly lists one (rare). Switching to `harvestapi~linkedin-profile-scraper` (detail actor) and feeding it URLs from the search step returns the "Contact info" block including public email when the viewer would see it — but requires a LinkedIn session cookie (`LINKEDIN_COOKIE` secret) and doubles cost. Include as optional path behind a flag.

### Plan
Ship Option A by default (email-finder enrichment on shortlisted profiles) and expose Option B as an opt-in via env if the user provides a LinkedIn cookie.

## Secrets to request
- `NAUKRI_COOKIE` (optional, unlocks Naukri emails/phones)
- `HUNTER_API_KEY` **or** rely on `APIFY_API_TOKEN` for the email-finder actor
- `LINKEDIN_COOKIE` (optional, opt-in for deep LinkedIn scrape)

## Open questions
1. For Naukri: OK to default to the public job-seeker scraper and treat Resdex (with `NAUKRI_COOKIE`) as an opt-in upgrade?
2. For LinkedIn emails: use an Apify email-finder actor (no extra key) or Hunter.io (better hit rate, needs `HUNTER_API_KEY`)?
3. Should email enrichment run for every scouted profile, or only for candidates the recruiter clicks "Shortlist" on (to control cost)?
