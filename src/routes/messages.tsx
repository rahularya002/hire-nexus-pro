import { createFileRoute, useSearch } from "@tanstack/react-router";
import { ListRowSkeleton } from "@/components/skeletons";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, Pin, Users, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { DbChatThread } from "@/components/db-chat-thread";
import { TeamMessagesPane } from "@/components/team-messages-pane";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listThreads, type ThreadRow } from "@/lib/messages.functions";
import { useCurrentRecruiter } from "@/lib/ops/access";
import { useAuth } from "@/lib/auth/auth-context";

type SearchParams = { client?: string };

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  ssr: false,
  component: () => (
    <AppShell>
      <MessagesPage />
    </AppShell>
  ),
});

function MessagesPage() {
  const search = useSearch({ from: "/messages" });
  const me = useCurrentRecruiter();
  const { user } = useAuth();
  const listFn = useServerFn(listThreads);
  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn(),
    refetchInterval: 8000,
  });
  const threads = useMemo<ThreadRow[]>(() => threadsQ.data ?? [], [threadsQ.data]);

  const [activeId, setActiveId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "unread" | "pinned">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!threads.length) return;
    if (search.client) {
      const t = threads.find((c) => c.client_id === search.client);
      if (t) {
        setActiveId(t.id);
        return;
      }
    }
    setActiveId((prev) => prev || threads[0].id);
  }, [search.client, threads]);

  const filtered = useMemo(() => {
    return threads.filter((t) => {
      if (filter === "unread" && (t.unread_count ?? 0) === 0) return false;
      if (filter === "pinned" && !t.pinned) return false;
      if (query && !(t.client?.name ?? "").toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [threads, filter, query]);

  const active = threads.find((c) => c.id === activeId) ?? threads[0];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MessageSquare className="size-6 text-primary" /> Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chat with clients or your internal team.
          </p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients" className="gap-1.5">
            <Building2 className="size-3.5" /> Clients
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="size-3.5" /> Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <div
        className="grid grid-cols-12 gap-4 rounded-xl border border-border bg-background overflow-hidden"
        style={{ minHeight: 640 }}
      >
        {/* List pane */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients..."
                className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="flex gap-1 p-0.5 rounded-md bg-secondary/60 text-xs">
              {(["all", "unread", "pinned"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex-1 py-1.5 rounded capitalize font-medium transition",
                    filter === f
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threadsQ.isLoading ? (
              <ListRowSkeleton rows={5} />
            ) : filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-10 px-4">
                No conversations match.
              </div>
            ) : (
              filtered.map((t) => (
                <ThreadRowItem
                  key={t.id}
                  thread={t}
                  active={t.id === activeId}
                  onSelect={() => setActiveId(t.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Thread pane */}
        <section className="col-span-12 md:col-span-8 lg:col-span-9 bg-secondary/10 p-3 md:p-4">
          {active ? (
            <DbChatThread
              thread={active}
              viewer="staff"
              authorName={me.name}
              initials={me.initials}
              className="h-full"
              header={{
                title: active.client?.contact_name ?? active.client?.name ?? "Client",
                subtitle: `${active.client?.name ?? "Client"} · ${
                  active.kind === "client_manager" ? "Manager line" : "Recruiter line"
                }`,
                avatarText: (active.client?.name ?? "C").slice(0, 2).toUpperCase(),
                avatarBg: active.client?.color ?? "var(--primary)",
              }}
            />
          ) : (
            <div className="grid place-items-center h-full text-sm text-muted-foreground">
              Select a conversation to start.
            </div>
          )}
        </section>
          </div>
        </TabsContent>

        <TabsContent value="team">
          {user ? (
            <TeamMessagesPane
              authorName={me.name}
              initials={me.initials}
              meUserId={user.id}
            />
          ) : (
            <div className="text-sm text-muted-foreground p-6">Sign in to view team chat.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThreadRowItem({
  thread,
  active,
  onSelect,
}: {
  thread: ThreadRow;
  active: boolean;
  onSelect: () => void;
}) {
  const last = thread.last_message;
  const unread = thread.unread_count ?? 0;
  const clientName = thread.client?.name ?? "Client";
  const initials = clientName.slice(0, 2).toUpperCase();
  const color = thread.client?.color ?? "var(--primary)";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-3 border-b border-border flex gap-3 transition",
        active ? "bg-primary/5" : "hover:bg-secondary/40",
      )}
    >
      <div className="relative shrink-0">
        <div
          className="size-10 rounded-full grid place-items-center text-xs font-semibold text-primary-foreground"
          style={{ background: color }}
        >
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate flex-1">{clientName}</span>
          {thread.pinned && <Pin className="size-3 text-muted-foreground shrink-0" />}
          {last && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Date(last.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              "text-xs truncate flex-1",
              unread > 0 ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {last
              ? `${last.sender_role === "staff" ? "You: " : ""}${last.body || (last.attachments[0]?.name ?? "Attachment")}`
              : "No messages yet"}
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
