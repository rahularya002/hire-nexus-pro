import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from "@/lib/notifications.functions";

function rel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (diff < m) return "now";
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < d) return `${Math.floor(diff / h)}h`;
  return `${Math.floor(diff / d)}d`;
}

export function NotificationBell({ viewAllHref = "/activity" }: { viewAllHref?: string }) {
  const fetchList = useServerFn(listNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  const { session } = useAuth();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        return await fetchList({ data: { limit: 20 } });
      } catch (e) {
        // Session not yet hydrated or signed out — fail silently
        return { rows: [], unread: 0 } as { rows: NotificationRow[]; unread: number };
      }
    },
    enabled: !!session,
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const rows: NotificationRow[] = data?.rows ?? [];
  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto relative size-9 grid place-items-center rounded-md hover:bg-secondary outline-none focus-visible:ring-1 focus-visible:ring-ring">
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] text-destructive-foreground font-semibold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="text-sm font-semibold">Notifications</div>
          <button
            className="text-[11px] text-primary font-medium hover:underline disabled:opacity-50"
            disabled={unread === 0}
            onClick={async () => {
              await markAll({});
              qc.invalidateQueries({ queryKey: ["notifications"] });
            }}
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {rows.length === 0 && (
            <div className="p-6 text-xs text-muted-foreground text-center">You're all caught up.</div>
          )}
          {rows.map((n) => {
            const inner = (
              <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/50 transition cursor-pointer">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 rounded-full shrink-0",
                    !n.read_at ? "bg-primary" : "bg-transparent",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{n.title}</div>
                  {n.body && (
                    <div className="text-[11px] text-muted-foreground truncate">{n.body}</div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{rel(n.created_at)}</span>
              </div>
            );
            const handleClick = async () => {
              if (!n.read_at) {
                await markOne({ data: { id: n.id } });
                qc.invalidateQueries({ queryKey: ["notifications"] });
              }
            };
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={handleClick}>
                {inner}
              </Link>
            ) : (
              <div key={n.id} onClick={handleClick}>
                {inner}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border px-3 py-2 text-center">
          <Link to={viewAllHref} className="text-xs text-primary font-medium hover:underline">
            View all activity
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}