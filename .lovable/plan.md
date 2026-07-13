## Problem

The room connects, mic publishes, then the ElevenLabs agent closes the WebRTC session immediately (`code 1006, wasClean: false`). No `onError` fires and no `error_event` is delivered — the server just drops us. Agent is active with an LLM + voice, and the workspace has Convai quota, so the failure is happening between "session started" and "first turn" on ElevenLabs' side.

Because ElevenLabs isn't giving us a client-side reason, we can't guess-and-fix. We need to pull the real reason out of ElevenLabs and only then patch the client.

## Step 1 — Add diagnostics to the test-call flow

Update `src/components/ai-screener-card.tsx`:

- Add `onDisconnect`, `onDebug`, and `onMessage` handlers on `useConversation` that log the full payload (`console.info` + a toast with the last debug event so it's visible without opening devtools).
- Capture the conversation ID via `conversation.getId()` after `startSession` resolves and stash it in component state — this is what we'll use to look the session up server-side.
- Temporarily drop the `sendContextualUpdate` call on connect. That isolates whether contextual updates immediately after connect are what's triggering the close.

No overrides are sent (already removed last turn), so this variant is the minimal "just talk to the agent as configured in the dashboard" path.

## Step 2 — Add a server function to fetch the ElevenLabs conversation record

New export in `src/lib/ai-screener.functions.ts`:

```text
getConversationDebug({ conversationId })
  -> GET https://api.elevenlabs.io/v1/convai/conversations/{id}
     with xi-api-key
  -> return { status, terminationReason, transcript, analysis, metadata }
```

Gated by `requireSupabaseAuth` and scoped to the caller's agency (we already know the agent_id belongs to this workspace).

Add a small "Debug last call" button next to "Get a test call" that calls this function with the captured conversation ID and dumps the result into a toast + console. ElevenLabs' conversation record includes `termination_reason` and any tool/LLM errors, which is exactly the missing signal.

## Step 3 — Fix based on what the record says

The likely outcomes and the corresponding fix (we will pick one after Step 2, not all of them):

- `termination_reason` mentions **overrides / dynamic variables / missing var** → the dashboard prompt or first-message contains `{{variables}}` we're not supplying. Fix: either remove the variables from the dashboard prompt, or send them via `dynamicVariables` in `startSession` (this is separate from `overrides` and doesn't require the "Allow overrides" toggle).
- `termination_reason` mentions **allowed origin / domain** → add the preview + published Lovable domains to the agent's Allowed Origins list in the ElevenLabs dashboard. Documentation-only fix, no code change.
- `termination_reason` mentions **auth / token** → the token endpoint needs a different `agent_id` or the agent requires `require_auth=false`. Fix in dashboard + verify `createTestCallToken`.
- `termination_reason` mentions **LLM / provider error** (e.g. missing OpenAI key on their side, model not enabled) → dashboard fix on their model config.
- Record is empty / conversation never reached the LLM → most likely a WebRTC negotiation / codec issue; fall back to `connectionType: "websocket"` with `getElevenLabsConversationSignedUrl` and retry.

## Step 4 — Re-enable contextual role brief safely

Once the call stays open:

- Put the `sendContextualUpdate(roleBrief)` back, but call it inside `onMessage` when we receive `conversation_initiation_metadata` (guaranteed-ready signal) instead of `onConnect`.
- Keep the debug button behind a dev-only check (visible only when `import.meta.env.DEV` or for superadmins) so end users don't see it.

## Technical notes

- `dynamicVariables` is the correct field for supplying `{{title}}`, `{{client_name}}`, etc. to a dashboard-configured agent — it does not need any dashboard toggle, unlike `overrides.agent.prompt`.
- The ElevenLabs conversations API is `GET /v1/convai/conversations/{conversation_id}`; it becomes queryable within a few seconds of the call ending.
- Nothing in Step 1 or Step 2 changes server-side auth, RLS, or the `position_ai_screeners` table.
- No new secrets required.
