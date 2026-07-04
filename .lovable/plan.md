
## Goal

Kill the ambiguity in Messages. Make it obvious at a glance whether you're talking to a **Client** or your **Team**, and give clients a private line to the account **Manager** in addition to the assigned recruiter.

## Agency portal — `/messages`

Top-level tabs at the page header:

```text
[ Clients ]   [ Team ]
```

### Clients tab
- Existing behavior: list of client threads on the left, thread pane on the right.
- Add a small "Client" pill on each row so it's visually distinct from team chats.
- Header label of the active thread shows: `Client · {Client name}` + which recruiter/manager is assigned.

### Team tab
Two sub-modes toggled with a segmented control inside the Team tab:
- **# Team room** — one shared channel per agency, everyone in `agency_members` participates.
- **Direct messages** — sidebar lists teammates (from `agency_members` + `profiles`); clicking one opens a 1:1 DM thread that's auto-created on first message.

Visual distinction: team messages use a neutral surface with a `Users` icon in the header; client messages keep the current client-colored avatar. Different empty states ("Start a team conversation…" vs "Direct line to your client").

## Client portal — `/client/messages`

Two tabs at the top:

```text
[ Recruiter ]   [ Account Manager ]
```

- **Recruiter** — the existing thread (unchanged).
- **Account Manager** — a separate, private thread with the agency admin/owner. Recruiter cannot see it. Small helper text: "Private line to your account manager. Use this if you'd like to escalate or discuss the engagement."

## Data model changes

Extend `message_threads` so one client can have multiple typed threads:

- Add `kind` enum: `client_recruiter | client_manager | team_room | team_dm`.
- Add `agency_id uuid` (nullable, for team threads with no client).
- Add `participant_a uuid`, `participant_b uuid` (nullable, for `team_dm`).
- Drop the current one-thread-per-client uniqueness; replace with:
  - unique(`client_id`, `kind`) where `kind in ('client_recruiter','client_manager')`
  - unique(`agency_id`) where `kind='team_room'`
  - unique(`agency_id`, least(participant_a,participant_b), greatest(...)) where `kind='team_dm'`

### RLS updates
- `client_recruiter`: existing client owner + assigned agency staff.
- `client_manager`: client owner + users with `admin` role in that agency only (checked via `has_role` + `agency_members`).
- `team_room`: all `agency_members` of that agency.
- `team_dm`: only the two participants.

Messages table stays as-is; policies derive access from the parent thread.

## Server functions (extend `src/lib/messages.functions.ts`)

- `listClientThreads()` → existing `listThreads` scoped to `kind in ('client_recruiter','client_manager')`.
- `listTeamThreads()` → returns `{ room, dms: [...] }` for current agency.
- `getOrCreateThreadForClient({ kind })` → `kind` param, defaults `client_recruiter`.
- `getOrCreateManagerThread()` → client side, always `client_manager`.
- `getOrCreateTeamRoom()` and `getOrCreateDm({ otherUserId })`.
- `listAgencyTeammates()` → for DM picker.

## UI files

- `src/routes/messages.tsx` — add top tabs (Clients / Team), keep current pane for Clients, add Team pane.
- New `src/components/team-messages-pane.tsx` — room + DM segmented control, teammate list, thread view (reuses `DbChatThread`).
- `src/routes/client.messages.tsx` — wrap in `Tabs` (Recruiter / Account Manager), each rendering `DbChatThread` for its thread.
- Reuse existing `DbChatThread`; add a `header` prop so team vs client headers can differ.

## Migration / seed

- One migration for schema + policies.
- Backfill: existing rows in `message_threads` get `kind='client_recruiter'` and `agency_id` from their client.
- No data seeding required; threads get created on first open.

## Out of scope

- Notifications routing (existing bell keeps working; per-thread routing can come later).
- Group team channels beyond the single `#team` room.
- File-attachment permission changes.
