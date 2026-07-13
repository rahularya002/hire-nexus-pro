# Automated Screening Call (AI Rex–style)

Add an "Enable automated calling" section to each position page. The client writes a pitch script + screening questions, and can hit **Get a test call** to talk to the AI agent live in the browser via ElevenLabs Conversational AI.

## Scope
- Voice: **ElevenLabs Conversational AI** — browser test call (WebRTC via `@elevenlabs/react`). Real phone dial-out to candidates is out of scope for this iteration (noted as a follow-up).
- Location: `src/routes/client.positions.$positionId.tsx` only.
- Fixed screening questions: notice period & current CTC, location / relocation, key skills confirmation (skills pulled from the position).

## Database
New migration adds a per-position screener config:
- Table `position_ai_screeners`: `id`, `position_id (unique fk)`, `agency_id`, `enabled bool`, `job_pitch text`, `ask_notice_ctc bool`, `ask_location bool`, `ask_skills bool`, `voice_id text`, `created_by`, `created_at`, `updated_at`.
- RLS: client team of the position OR agency members of the position can select/insert/update. Standard `GRANT`s to `authenticated` + `service_role`.

## Backend (server functions in `src/lib/ai-screener.functions.ts`)
- `getScreenerForPosition({ positionId })` — returns row or defaults; auto-seeds pitch text from position title/skills/location on first load.
- `saveScreener({ positionId, enabled, jobPitch, askNoticeCtc, askLocation, askSkills, voiceId })`.
- `createTestCallToken({ positionId })` — server-only: builds a system prompt + first message from the saved screener, then POSTs to `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...` with `xi-api-key: ELEVENLABS_API_KEY` and returns `{ token }`. System prompt is passed via conversation overrides on the client.

All protected with `requireSupabaseAuth` + position access check.

## Secrets / Connector
- Use the **ElevenLabs standard App connector** (`standard_connectors--connect` with `connector_id: "elevenlabs"`) to sync `ELEVENLABS_API_KEY` server-side. No manual paste.
- Requires an ElevenLabs Agent — user must create one in ElevenLabs dashboard once and save its Agent ID. Stored as a secret `ELEVENLABS_SCREENER_AGENT_ID` via `add_secret` (requested after connector is linked). "Overrides" must be enabled on that agent so per-position prompt/first-message can be injected.

## Frontend
New component `src/components/ai-screener-card.tsx` shown on the position page:
- Header: **"Enable automated calling"** toggle (matches user's screenshot).
- **Job pitch** textarea (multiline, auto-seeded from position: *"Hello! This is a call from the {agency} team. We are hiring a {title} for {client} in {location} with {experience} experience..."*).
- Checkbox list of screening questions (the three fixed ones).
- Right-aligned **Get a test call** button with phone icon. On click:
  1. Saves current draft.
  2. Requests mic permission.
  3. Calls `createTestCallToken` server fn.
  4. Uses `useConversation` from `@elevenlabs/react` with `startSession({ conversationToken, connectionType: "webrtc", overrides: { agent: { prompt: {prompt: buildPrompt()}, firstMessage: jobPitch } } })`.
  5. Shows live status pill (connecting / agent speaking / listening) and an **End call** button.

Package: `bun add @elevenlabs/react`.

## Follow-ups (not in this iteration)
- Real outbound calls to candidate phone numbers via Twilio bridge.
- Per-candidate transcript storage & auto-scoring in the pipeline.

## Files touched
- new migration for `position_ai_screeners`
- new `src/lib/ai-screener.functions.ts`
- new `src/components/ai-screener-card.tsx`
- edit `src/routes/client.positions.$positionId.tsx` (mount the card)
- `package.json` (via `bun add`)
