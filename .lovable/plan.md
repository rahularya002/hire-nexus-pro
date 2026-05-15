## Direct Chat: Client ↔ Agency

Add a dedicated messaging surface in both portals where a client and the agency account team can chat in real-time threads and share files. Currently messaging only exists nested inside a single position detail page (`client.positions.$positionId.tsx`); this elevates it to a top-level channel per client.

### Navigation

- **Agency sidebar** (`src/components/app-shell.tsx` → `agencyNav`): add `Messages` (icon: `MessageSquare`) between `Clients` and `Open Requirements`.
- **Client sidebar** (`src/components/client-shell.tsx`): add `Messages` between `Account Team` and `Upload JD`.

### Routes

1. `src/routes/messages.tsx` (agency)
   - Two-pane layout: left = client list with last-message preview, unread badge, online dot; right = active thread.
   - Search clients, filter (Unread / All / Pinned).
2. `src/routes/client.messages.tsx` (client)
   - Single-thread view with the agency account team (no list pane needed — one channel).

Both reuse a shared `<ChatThread />` component.

### Shared component

`src/components/chat-thread.tsx`
- Header: counterpart name + avatars, online status, "View account team" link.
- Scrollable message list, day separators, grouped consecutive messages, read receipts.
- Composer: textarea (Enter to send, Shift+Enter newline), emoji shortcut, file attach button, paste-to-attach.
- Attachment chips above composer (name, size, remove); rendered inline in messages as file cards (icon by mime, size, "Download" button — mock link).
- Typing indicator (mocked) + "Recruiter typically replies within 2 hours" hint.

### Data layer

`src/lib/chat-data.ts` (new, in-memory mock with subscribe/notify, same pattern as `billing-data.ts`):

```ts
ChatChannel { id, clientId, agencyTeamIds[], lastMessageAt, unreadForClient, unreadForAgency, pinned }
ChatMessage { id, channelId, from: "client" | "agency", authorId, authorName, initials, body, attachments: ChatAttachment[], sentAt, readBy[] }
ChatAttachment { id, name, sizeBytes, mime, url } // mock blob URLs via URL.createObjectURL on upload
```

Helpers: `getChannels()`, `getChannel(clientId)`, `sendMessage(channelId, payload)`, `markRead(channelId, viewer)`, `attachFiles(files)` (returns `ChatAttachment[]`).

Seed: 6 channels (one per existing client in `client-data.ts` / `mock-data.ts`), each with 8–15 messages mixing text, a PDF JD, an offer letter, and a screenshot, varied timestamps.

### Cross-links

- Existing position-level message thread (`client.positions.$positionId.tsx` → MessageThreadPanel) gets a small "Open full conversation →" link to `/client/messages`.
- Client detail page `clients.$clientId.tsx` (agency side) gets a "Message client" button linking to `/messages?client={id}`.

### Out of scope (mock prototype)

- No real backend, websocket, or persistent file storage. Files are held in-memory via blob URLs; reload clears them. A note in the empty state explains this.
- No push notifications.

### Files

**New**
- `src/routes/messages.tsx`
- `src/routes/client.messages.tsx`
- `src/components/chat-thread.tsx`
- `src/lib/chat-data.ts`

**Edited**
- `src/components/app-shell.tsx` (nav)
- `src/components/client-shell.tsx` (nav)
- `src/routes/client.positions.$positionId.tsx` (cross-link)
- `src/routes/clients.$clientId.tsx` (cross-link)
- `src/routeTree.gen.ts` (auto-regenerated)