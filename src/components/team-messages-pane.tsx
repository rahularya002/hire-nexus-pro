import { useEffect, useMemo, useState } from "react";
import { Hash, Users, MessageSquarePlus, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { DbChatThread } from "@/components/db-chat-thread";
import { ListRowSkeleton } from "@/components/skeletons";
import {
  getOrCreateDm,
  getOrCreateTeamRoom,
  listAgencyTeammates,
  listTeamThreads,
  type ThreadRow,
} from "@/lib/messages.functions";

type Mode = "room" | "dm";

export function TeamMessagesPane({
  authorName,
  initials,
  meUserId,
}: {
  authorName: string;
  initials: string;
  meUserId: string;
}) {
  const qc = useQueryClient();
  const roomFn = useServerFn(getOrCreateTeamRoom);
  const teammatesFn = useServerFn(listAgencyTeammates);
  const teamThreadsFn = useServerFn(listTeamThreads);
  const dmFn = useServerFn(getOrCreateDm);

  const [mode, setMode] = useState<Mode>("room");
  const [activeThread, setActiveThread] = useState<ThreadRow | null>(null);
  const [activeDmUser, setActiveDmUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const roomQ = useQuery({
    queryKey: ["team-room"],
    queryFn: () => roomFn(),
  });
  const teammatesQ = useQuery({
    queryKey: ["team-teammates"],
    queryFn: () => teammatesFn(),
  });
  const teamThreadsQ = useQuery({
    queryKey: ["team-threads"],
    queryFn: () => teamThreadsFn(),
    refetchInterval: 8000,
  });

  const dmMap = useMemo(() => {
    const map = new Map<string, ThreadRow>();
    for (const t of teamThreadsQ.data ?? []) {
      if (t.kind !== "team_dm") continue;
      const other = t.participant_a === meUserId ? t.participant_b : t.participant_a;
      if (other) map.set(other, t);
    }
    return map;
  }, [teamThreadsQ.data, meUserId]);

  // Auto-select the room when switching to room mode
  useEffect(() => {
    if (mode === "room" && roomQ.data) {
      setActiveThread(roomQ.data);
    }
  }, [mode, roomQ.data]);

  async function openDm(userId: string) {
    setActiveDmUser(userId);
    const existing = dmMap.get(userId);
    if (existing) {
      setActiveThread(existing);
      return;
    }
    const created = await dmFn({ data: { otherUserId: userId } });
    setActiveThread(created);
    qc.invalidateQueries({ queryKey: ["team-threads"] });
  }

  const teammates = teammatesQ.data ?? [];
  const filteredMates = teammates.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="grid grid-cols-12 gap-4 rounded-xl border border-border bg-background overflow-hidden"
      style={{ minHeight: 640 }}
    >
      <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex gap-1 p-0.5 rounded-md bg-secondary/60 text-xs">
            <button
              onClick={() => setMode("room")}
              className={cn(
                "flex-1 py-1.5 rounded font-medium transition inline-flex items-center justify-center gap-1.5",
                mode === "room"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Hash className="size-3.5" /> Team room
            </button>
            <button
              onClick={() => setMode("dm")}
              className={cn(
                "flex-1 py-1.5 rounded font-medium transition inline-flex items-center justify-center gap-1.5",
                mode === "dm"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageSquarePlus className="size-3.5" /> Direct
            </button>
          </div>
          {mode === "dm" && (
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teammates..."
                className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {mode === "room" ? (
            <button
              onClick={() => roomQ.data && setActiveThread(roomQ.data)}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border flex items-center gap-3 transition",
                activeThread?.kind === "team_room" ? "bg-primary/5" : "hover:bg-secondary/40",
              )}
            >
              <div className="size-10 rounded-full grid place-items-center bg-gradient-to-br from-primary/70 to-primary text-primary-foreground">
                <Hash className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">#team</div>
                <div className="text-xs text-muted-foreground truncate">
                  Shared channel for your agency
                </div>
              </div>
            </button>
          ) : teammatesQ.isLoading ? (
            <ListRowSkeleton rows={5} />
          ) : filteredMates.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-10 px-4">
              No teammates yet.
            </div>
          ) : (
            filteredMates.map((m) => {
              const dm = dmMap.get(m.user_id);
              const active = activeDmUser === m.user_id;
              const unread = dm?.unread_count ?? 0;
              return (
                <button
                  key={m.user_id}
                  onClick={() => openDm(m.user_id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b border-border flex items-center gap-3 transition",
                    active ? "bg-primary/5" : "hover:bg-secondary/40",
                  )}
                >
                  <div className="size-10 rounded-full grid place-items-center bg-secondary text-foreground text-xs font-semibold">
                    {m.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate capitalize">
                      {m.role_in_agency.replace(/_/g, " ")}
                    </div>
                  </div>
                  {unread > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="col-span-12 md:col-span-8 lg:col-span-9 bg-secondary/10 p-3 md:p-4">
        {activeThread ? (
          <DbChatThread
            thread={activeThread}
            viewer="staff"
            authorName={authorName}
            initials={initials}
            className="h-full"
            storageFolder={activeThread.agency_id ?? "team"}
            header={
              activeThread.kind === "team_room"
                ? {
                    title: "#team",
                    subtitle: "Shared channel · everyone in your agency",
                    avatarText: "#",
                    avatarBg: "linear-gradient(135deg, var(--primary), var(--primary))",
                  }
                : (() => {
                    const other = teammates.find((m) => m.user_id === activeDmUser);
                    return {
                      title: other?.name ?? "Teammate",
                      subtitle: other?.role_in_agency?.replace(/_/g, " ") ?? "Direct message",
                      avatarText: other?.initials ?? "T",
                      avatarBg: "var(--muted)",
                    };
                  })()
            }
          />
        ) : (
          <div className="grid place-items-center h-full text-sm text-muted-foreground">
            <div className="text-center">
              <Users className="size-6 mx-auto mb-2 text-muted-foreground" />
              Select a teammate or the team room to start.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}