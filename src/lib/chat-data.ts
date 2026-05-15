import { clients } from "./mock-data";

export type ChatParty = "client" | "agency";

export interface ChatAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  mime: string;
  url: string; // mock — blob URL or static
}

export interface ChatMessage {
  id: string;
  channelId: string;
  from: ChatParty;
  authorName: string;
  initials: string;
  body: string;
  attachments: ChatAttachment[];
  sentAt: number; // ms epoch
  readBy: ChatParty[];
}

export interface ChatChannel {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  agencyOwnerName: string;
  agencyOwnerInitials: string;
  agencyOnline: boolean;
  pinned: boolean;
}

// ---------- store ----------
const channels: ChatChannel[] = clients.map((c, i) => ({
  id: `ch-${c.id}`,
  clientId: c.id,
  clientName: c.name,
  clientInitials: c.initials,
  clientColor: c.color,
  agencyOwnerName: ["Aarav Reddy", "Priyanka Nair", "Rohit Bansal", "Sara Khan", "Devika Iyer", "Manish Gupta"][i % 6],
  agencyOwnerInitials: ["AR", "PN", "RB", "SK", "DI", "MG"][i % 6],
  agencyOnline: i % 3 !== 2,
  pinned: i < 2,
}));

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();

function seedFor(channelId: string, clientName: string, agencyName: string, agencyInitials: string, clientInitials: string): ChatMessage[] {
  const base: Array<Omit<ChatMessage, "id" | "channelId">> = [
    {
      from: "agency", authorName: agencyName, initials: agencyInitials,
      body: `Hi team — sharing the updated JD draft for the senior role we discussed. Let me know if the comp band aligns with your internal benchmarks.`,
      attachments: [{ id: "a1", name: "JD_Senior_Role_v3.pdf", sizeBytes: 184_320, mime: "application/pdf", url: "#" }],
      sentAt: now - 2 * DAY - 4 * HOUR, readBy: ["agency", "client"],
    },
    {
      from: "client", authorName: "Vikram Shah", initials: clientInitials,
      body: `Thanks! The JD looks good overall. We'd like to tighten the "must-have" skills section. Also, can we shift the comp band by 8-10%?`,
      attachments: [], sentAt: now - 2 * DAY - 3 * HOUR, readBy: ["agency", "client"],
    },
    {
      from: "agency", authorName: agencyName, initials: agencyInitials,
      body: `Noted. I'll revise and circulate by EOD. We've also sourced 4 strong profiles already — pushing them into the pipeline now.`,
      attachments: [], sentAt: now - 2 * DAY - 2 * HOUR, readBy: ["agency", "client"],
    },
    {
      from: "client", authorName: "Vikram Shah", initials: clientInitials,
      body: `Perfect. Can you also share the screening notes for last week's batch?`,
      attachments: [], sentAt: now - 1 * DAY - 6 * HOUR, readBy: ["agency", "client"],
    },
    {
      from: "agency", authorName: agencyName, initials: agencyInitials,
      body: `Attaching the screening summary. Highlighted the top 3 in green.`,
      attachments: [{ id: "a2", name: "Screening_Notes_W42.xlsx", sizeBytes: 92_410, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: "#" }],
      sentAt: now - 1 * DAY - 5 * HOUR, readBy: ["agency", "client"],
    },
    {
      from: "client", authorName: "Priya Nair", initials: "PN",
      body: `Can we schedule a 30-min sync tomorrow to align on the panel availability?`,
      attachments: [], sentAt: now - 6 * HOUR, readBy: ["client"],
    },
    {
      from: "agency", authorName: agencyName, initials: agencyInitials,
      body: `Absolutely — I'll send a calendar invite for 11:30 IST. Also sharing the latest interview feedback grid.`,
      attachments: [{ id: "a3", name: "Interview_Feedback_Grid.png", sizeBytes: 412_900, mime: "image/png", url: "#" }],
      sentAt: now - 4 * HOUR, readBy: ["agency"],
    },
    {
      from: "client", authorName: "Vikram Shah", initials: clientInitials,
      body: `Got it, see you then. One quick note — ${clientName.split(" ")[0]} legal needs the signed offer template before we extend the next offer.`,
      attachments: [], sentAt: now - 45 * 60 * 1000, readBy: ["client"],
    },
  ];
  return base.map((m, i) => ({ ...m, id: `m-${channelId}-${i}`, channelId }));
}

const tailVariants: Array<{ body: string; from: ChatParty; mins: number }> = [
  { body: "Quick one — can we squeeze in a profile review tomorrow morning?", from: "client", mins: 38 },
  { body: "Sharing the offer template now. Legal cleared it this morning.", from: "agency", mins: 12 },
  { body: "Two of the shortlisted candidates are open to relocating. Worth pushing forward.", from: "agency", mins: 92 },
  { body: "Background check came back clean for Karan. We're good to extend the offer.", from: "client", mins: 5 },
  { body: "Panel availability confirmed for Thu 4pm IST — sending invites shortly.", from: "agency", mins: 200 },
  { body: "We need to revisit the comp band on the Director role — internal feedback came in.", from: "client", mins: 22 },
];

const messages: Record<string, ChatMessage[]> = {};
channels.forEach((ch, idx) => {
  const list = seedFor(ch.id, ch.clientName, ch.agencyOwnerName, ch.agencyOwnerInitials, ch.clientInitials);
  const t = tailVariants[idx % tailVariants.length];
  list.push({
    id: `m-${ch.id}-tail`,
    channelId: ch.id,
    from: t.from,
    authorName: t.from === "agency" ? ch.agencyOwnerName : "Vikram Shah",
    initials: t.from === "agency" ? ch.agencyOwnerInitials : "VS",
    body: t.body,
    attachments: [],
    sentAt: now - t.mins * 60 * 1000,
    readBy: t.from === "agency" ? ["agency"] : ["client"],
  });
  messages[ch.id] = list;
});

// ---------- subscribe / notify ----------
type Listener = () => void;
const listeners = new Set<Listener>();
let storeVersion = 0;
function notify() { storeVersion += 1; listeners.forEach((l) => l()); }
export function subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); }

// ---------- selectors ----------
const EMPTY_MESSAGES: ChatMessage[] = [];
let channelsSnapshotVersion = -1;
let channelsSnapshot: ChatChannel[] = [];

export function getChannels(): ChatChannel[] {
  if (channelsSnapshotVersion === storeVersion) return channelsSnapshot;

  channelsSnapshot = [...channels].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aLast = messages[a.id]?.at(-1)?.sentAt ?? 0;
    const bLast = messages[b.id]?.at(-1)?.sentAt ?? 0;
    return bLast - aLast;
  });
  channelsSnapshotVersion = storeVersion;
  return channelsSnapshot;
}
export function getChannelByClientId(clientId: string): ChatChannel | undefined {
  return channels.find((c) => c.clientId === clientId);
}
export function getChannelById(id: string): ChatChannel | undefined {
  return channels.find((c) => c.id === id);
}
export function getMessages(channelId: string): ChatMessage[] {
  return messages[channelId] ?? EMPTY_MESSAGES;
}
export function getLastMessage(channelId: string): ChatMessage | undefined {
  const arr = messages[channelId];
  return arr?.[arr.length - 1];
}
export function getUnreadCount(channelId: string, viewer: ChatParty): number {
  return (messages[channelId] ?? []).filter((m) => m.from !== viewer && !m.readBy.includes(viewer)).length;
}

// ---------- mutations ----------
export function sendMessage(channelId: string, payload: { from: ChatParty; authorName: string; initials: string; body: string; attachments: ChatAttachment[] }) {
  const msg: ChatMessage = {
    id: `m-${channelId}-${Date.now()}`,
    channelId,
    from: payload.from,
    authorName: payload.authorName,
    initials: payload.initials,
    body: payload.body,
    attachments: payload.attachments,
    sentAt: Date.now(),
    readBy: [payload.from],
  };
  messages[channelId] = [...(messages[channelId] ?? EMPTY_MESSAGES), msg];
  notify();
}

export function markRead(channelId: string, viewer: ChatParty) {
  const arr = messages[channelId];
  if (!arr) return;
  if (!arr.some((m) => !m.readBy.includes(viewer))) return;

  messages[channelId] = arr.map((m) =>
    m.readBy.includes(viewer) ? m : { ...m, readBy: [...m.readBy, viewer] },
  );
  notify();
}

export function attachFiles(files: FileList | File[]): ChatAttachment[] {
  const arr = Array.from(files);
  return arr.map((f, i) => ({
    id: `att-${Date.now()}-${i}`,
    name: f.name,
    sizeBytes: f.size,
    mime: f.type || "application/octet-stream",
    url: URL.createObjectURL(f),
  }));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * DAY) return d.toLocaleDateString([], { weekday: "short" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function dayLabel(ms: number): string {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return new Date(ms).toLocaleDateString([], { weekday: "long" });
  return new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}