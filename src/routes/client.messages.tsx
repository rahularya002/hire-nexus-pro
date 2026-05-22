import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientShell } from "@/components/client-shell";
import { DbChatThread } from "@/components/db-chat-thread";
import { getOrCreateThreadForClient } from "@/lib/messages.functions";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/client/messages")({
  ssr: false,
  component: () => (
    <ClientShell>
      <ClientMessagesPage />
    </ClientShell>
  ),
});

function ClientMessagesPage() {
  const { profile } = useAuth();
  const threadFn = useServerFn(getOrCreateThreadForClient);
  const threadQ = useQuery({
    queryKey: ["client-thread"],
    queryFn: () => threadFn({ data: {} }),
  });

  const authorName = profile?.full_name ?? profile?.email ?? "Client";
  const initials = (authorName.match(/\b\w/g) ?? ["C"]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" /> Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct line to your TalentFlow account team. Share files, screenshots, and questions.
        </p>
      </div>

      {threadQ.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
          <Loader2 className="size-4 animate-spin" /> Loading conversation…
        </div>
      ) : threadQ.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-6 text-sm">
          {(threadQ.error as Error).message}
        </div>
      ) : threadQ.data ? (
        <DbChatThread
          thread={threadQ.data}
          viewer="client"
          authorName={authorName}
          initials={initials}
        />
      ) : null}
    </div>
  );
}
