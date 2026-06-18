## Goal
Replace the static rounds + missing interviewer in the client's "Schedule interview" dialog with a dynamic, per-round configuration.

## Dialog UX (`ScheduleInterviewDialog` in `src/routes/client.positions.$positionId.tsx`)

Top fields (unchanged):
- Preferred date for round 1
- Preferred time for round 1

New "Rounds" section — a list of round rows. Each row has:
- Round number badge (auto: R1, R2, …)
- **Type** select (`kind`): HR Screen, Technical, Behavioural, System Design, Case Study, Hiring Manager, CEO/Founder, Culture Fit, Other (→ free-text label)
- **Interviewer** select: dropdown sourced from `listClientMembers` (active members only), plus a "Someone else…" option that reveals a free-text input. Optional.
- **Remove** button (hidden when only one round remains)

Below the list:
- "+ Add round" button (no hard cap; soft cap 10 to match backend `z.number().int().min(1).max(10)`).

Defaults when adding rounds: R1 = HR Screen, R2 = Technical, R3 = Hiring Manager, then Technical for any further additions. Interviewer empty by default.

Client team is fetched once via `useQuery(["client-members"], listClientMembers)` and cached.

## Backend (`requestClientInterview` in `src/lib/interviews.functions.ts`)

Extend the input schema — replace the scalar `rounds: number` with an optional structured `rounds` array, while keeping back-compat:

```
rounds: z.array(z.object({
  kind: z.enum(INTERVIEW_KINDS),
  custom_kind_label: z.string().max(120).nullable().optional(),
  interviewer: z.string().max(200).nullable().optional(),
})).min(1).max(10)
```

Behaviour:
- Insert one `interviews` row per array entry; `round_index = i + 1`.
- `scheduled_at` set only on round 1 (existing behaviour).
- `conducted_by = "client"`, `provider = "google_meet"`, `status = "pending_confirmation"` — unchanged.
- Activity log: `${rounds.length} round(s)` (existing message format works).

## Out of scope
- Per-round date/time pickers (still only round 1 has a time; subsequent rounds remain "to be confirmed").
- Notifying/emailing the chosen interviewer.
- Editing rounds from this dialog after submission (handled elsewhere in the recruiter view).
- Permission gating — any client user who can currently request interviews keeps that ability.
