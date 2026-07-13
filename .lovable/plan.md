## Root cause

The agent's dashboard first message uses `{{candidate_name}}`, `{{job_title}}`, `{{company_name}}`. When those aren't provided, ElevenLabs fails to render the opening turn and drops the WebRTC session (the `reason: "agent"` disconnect we saw). `dynamicVariables` is a separate mechanism from `overrides` — it doesn't require the "Allow overrides" toggle, so it won't re-trigger the earlier SDK crash.

## Changes

### 1. `src/lib/ai-screener.functions.ts` — `createTestCallToken`

Return a `dynamicVariables` object alongside `token`, populated from the position + caller:

- `candidate_name`: `"there"` for the test call (no real candidate yet). Later, when triggered per-candidate, pass the actual name.
- `job_title`: `pos.title`
- `company_name`: `pos.client?.name ?? "our team"`

Keep `systemPrompt` and `firstMessage` in the return for the contextual-update fallback, but they're no longer the primary mechanism.

### 2. `src/components/ai-screener-card.tsx` — `startTestCall`

Pass `dynamicVariables` into `conversation.startSession`:

```ts
await conversation.startSession({
  conversationToken: t.token,
  connectionType: "webrtc",
  dynamicVariables: t.dynamicVariables,
});
```

Keep the existing `sendContextualUpdate` on `conversation_initiation_metadata` as a role-brief augmentation (extra context for the LLM), since the agent's own dashboard prompt already covers the flow.

### 3. Verify with Debug last call

After the fix, the test call should stay connected. If it still drops, the **Debug last call** button will now surface a specific `termination_reason` (e.g. still-missing variable name), and we adjust the variable list to match.

## Out of scope

- No schema changes.
- No changes to `saveScreener` or the UI script editor.
- Real per-candidate variable wiring (when the agent is triggered from a candidate row) is a follow-up once the test call is confirmed working.
