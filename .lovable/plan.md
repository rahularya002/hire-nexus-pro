# Agency Dashboard Revamp

Goal: give the agency head a single cockpit that answers "who's working, on what, and where are the risks", and remove empty-looking sections.

## New layout (admin persona only; recruiter view unchanged)

```text
[ Header: greeting + status + AI Scout ]
[ Daily digest (kept, wired to real activity counts) ]

Row A — Team pulse
[ Team KPIs: Total | Online now | Logged in today | Active this week ]
[ Recruiter roster table                                             ]
  cols: recruiter · status dot · login time today · # clients · # open roles · actions today · last activity

Row B — Client & pipeline health
[ Clients by recruiter          ] [ Inactive / quiet clients ]
  grouped list, each recruiter     (kept, expanded to 6)
  → chips of assigned clients

Row C — Upcoming
[ Today's interviews (kept) ] [ Next 7 days interviews (new) ] [ Open positions (kept) ]

Row D — Tasks (kept, with pill tabs) + SLA breaches
```

## Data wiring

- **Team KPIs + roster**: reuse `listTodayRecruiterLogins` (already exists) + `getAgencyRoster` from `src/lib/team.functions.ts` (already returns assigned clients + 7-day action counts). No new server fns needed.
- **Clients by recruiter**: derive client-map from the roster's `owned`/assignment data — group client chips under each recruiter card.
- **Next 7 days interviews**: add a `scope: "upcoming"` branch to `listInterviews` (or filter client-side from a `range` fetch) and render a compact day-grouped list.
- **Inactive clients**: keep current 14-day rule but show up to 6 and add a "last activity" relative label.

## Filling empty sections

Empty states you saw ("Inactive/quiet clients", empty digest tiles, empty roster metrics) are caused by thin seed data, not UI bugs. Reseed additions (one migration, deterministic UUIDs):

- 6–8 more `activities` rows across today/yesterday (shares, offers, closures) so digest tiles read non-zero.
- 3 clients marked quiet: backdate `last_activity_at` > 20 days for 3 existing clients.
- 4 more `recruiter_login_events` for today spread across recruiters.
- 5 upcoming interviews across the next 7 days (mix of `pending_confirmation` and `confirmed`, different clients/recruiters).
- 6 additional `tasks` distributed across `Pending`, `Interview Pending`, `Follow-up` with SLA warnings.

## Files touched

- `src/routes/dashboard.tsx` — new admin layout, team pulse row, clients-by-recruiter card, next-7-days interviews card. Recruiter view path unchanged.
- `src/lib/interviews.functions.ts` — add `scope: "upcoming"` (next 7 days, excludes today) — small addition, no signature break.
- One Supabase migration to reseed the rows above.

## Out of scope

- No changes to recruiter dashboard, sidebar, or auth.
- No new tables; no changes to RLS.
