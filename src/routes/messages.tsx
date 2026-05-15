import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MessageSquare, Search, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { ChatThread } from "@/components/chat-thread";
import {
  type ChatChannel,
  formatTime, getChannels, getLastMessage, getUnreadCount, subscribe,
} from "@/lib/chat-data";
import { useCurrentRecruiter } from "@/lib/ops/access";

type SearchParams = { client?: string };

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({ client: typeof s.client === "string" ? s.client : undefined }),
  ssr: false,
  component: () => <AppShell><MessagesPage /></AppShell>,
});

function useChannelsLive() {
  return useSyncExternalStore((cb) => subscribe(cb), () => getChannels(), () => getChannels());
}

function MessagesPage() {
  const channels = useChannelsLive();
  const search = useSearch({ from: "/messages" });
  const me = useCurrentRecruiter();
  const [activeId, setActiveId] = useState<string>(() => {
    if (search.client) {
      const ch = channels.find((c) => c.clientId === search.client);
      if (ch) return ch.id;
    }
    return channels[0]?.id ?? "";
  });
  const [filter, setFilter] = useState<"all" | "unread" | "pinned">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (search.client) {
      const ch = channels.find((c) => c.clientId === search.client);
      if (ch) setActiveId(ch.id);
    }
  }, [search.client, channels]);

  const filtered = useMemo(() => {
    return channels.filter((c) => {
      if (filter === "unread" && getUnreadCount(c.id, "agency") === 0) return false;
      if (filter === "pinned" && !c.pinned) return false;
      if (query && !c.clientName.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [channels, filter, query]);

  const active = channels.find((c) => c.id === activeId) ?? channels[0];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MessageSquare className="size-6 text-primary" /> Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Direct conversations with each client account.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 rounded-xl border border-border bg-background overflow-hidden" style={{ minHeight: 640 }}>
        {/* List pane */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients..."
                className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="flex gap-1 p-0.5 rounded-md bg-secondary/60 text-xs">
              {(["all", "unread", "pinned"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn("flex-1 py-1.5 rounded capitalize font-medium transition",
                    filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-10 px-4">No conversations match.</div>
            ) : filtered.map((c) => (
              <ChannelRow key={c.id} channel={c} active={c.id === activeId} onSelect={() => setActiveId(c.id)} />
            ))}
          </div>
        </aside>

        {/* Thread pane */}
        <section className="col-span-12 md:col-span-8 lg:col-span-9 bg-secondary/10 p-3 md:p-4">
          {active ? (
            <ChatThread
              channel={active}
              viewer="agency"
              authorName={me.name}
              initials={me.initials}
              className="h-full"
            />
          ) : (
            <div className="grid place-items-center h-full text-sm text-muted-foreground">
              Select a conversation to start.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChannelRow({ channel, active, onSelect }: { channel: ChatChannel; active: boolean; onSelect: () => void }) {
  const last = getLastMessage(channel.id);
  const unread = getUnreadCount(channel.id, "agency");
  return (
    <button
      onClick={onSelect}
      className={cn("w-full text-left px-3 py-3 border-b border-border flex gap-3 transition",
        active ? "bg-primary/5" : "hover:bg-secondary/40")}
    >
      <div className="relative shrink-0">
        <div className="size-10 rounded-full grid place-items-center text-xs font-semibold text-primary-foreground"
          style={{ background: channel.clientColor }}>
          {channel.clientInitials}
        </div>
        {channel.agencyOnline && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-card" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate flex-1">{channel.clientName}</span>
          {channel.pinned && <Pin className="size-3 text-muted-foreground shrink-0" />}
          {last && <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(last.sentAt)}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-xs truncate flex-1", unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
            {last ? `${last.from === "agency" ? "You: " : ""}${last.body || (last.attachments[0]?.name ?? "Attachment")}` : "No messages yet"}
          </span>
          {unread > 0 && (
            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}