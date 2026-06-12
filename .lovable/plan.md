## Goal

Make Scout reachable only from within a self/hybrid position. Remove the sidebar shortcut entirely; if the client lands on `/client/scout` without a qualifying position context, show an empty state explaining how to unlock it.

## Changes

**1. `src/components/client-shell.tsx`**
- Remove the `{ to: "/client/scout", label: "Scout Candidates", icon: Sparkles }` entry from the `nav` array. Scout no longer appears in the client sidebar.
- Leave `Sparkles` import if still used elsewhere; otherwise drop it.

**2. `src/routes/client.positions.$positionId.tsx`**
- No change needed. It already conditionally renders the "Scout candidates" CTA only when `recruitment_model` is `self` or `hybrid`, linking to `/client/scout?positionId=…`. This becomes the sole entry point.

**3. `src/routes/client.scout.tsx`** — gate the page
- When the route loads WITHOUT a `positionId` search param, render a locked empty state instead of the scout UI:
  - Headline: "Scout is unlocked per position"
  - Body: "Talent Scout is available for roles you're recruiting in-house. Upload a JD with the **Self** or **Hybrid** recruitment model, then open that position and click **Scout candidates**."
  - Two CTAs: "Upload a JD" → `/client/upload`, "View my requirements" → `/client/positions`.
- When the route loads WITH a `positionId`, fetch the position (existing effect). If the fetched position's `recruitment_model` is `agency` (not self/hybrid), show the same locked empty state with an extra note: "This position is set to Agency mode — your TalentFlow recruiter is sourcing for it." Otherwise proceed with the current scout flow.
- Keep the existing `navigate({ to: "/client/scout", search: {}, replace: true })` cleanup, but only after we've confirmed the model is self/hybrid; otherwise leave the search param so the gate keeps showing the position-specific message until the user navigates away.

## Out of scope
- Server-side enforcement (scout server functions still callable directly). This is a UX gate; the existing scout functions already require the user own the position via RLS.
- Agency-side scout access.
