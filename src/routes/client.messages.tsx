import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, UserCircle2, ShieldCheck } from "lucide-react";
import { ChatMessagesSkeleton } from "@/components/skeletons";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientShell } from "@/components/client-shell";
import { DbChatThread } from "@/components/db-chat-thread";
import {
  getOrCreateThreadForClient,
  getOrCreateClientManagerThread,
} from "@/lib/messages.functions";
import { useAuth } from "@/lib/auth/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  const managerThreadFn = useServerFn(getOrCreateClientManagerThread);
  const threadQ = useQuery({
    queryKey: ["client-thread"],
    queryFn: () => threadFn({ data: {} }),
  });
  const managerQ = useQuery({
    queryKey: ["client-manager-thread"],
    queryFn: () => managerThreadFn(),
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
          Chat with your assigned recruiter, or reach out to your account manager privately.
        </p>
      </div>

      <Tabs defaultValue="recruiter" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recruiter" className="gap-1.5">
            <UserCircle2 className="size-3.5" /> Recruiter
          </TabsTrigger>
          <TabsTrigger value="manager" className="gap-1.5">
            <ShieldCheck className="size-3.5" /> Account Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recruiter">
          {threadQ.isLoading ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <ChatMessagesSkeleton rows={5} />
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
              header={{
                title: "Your recruiter",
                subtitle: "TalentFlow · Assigned recruiter",
                avatarText: "TF",
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="manager">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 px-4 py-3 text-xs mb-3">
            Private line to your account manager. Your assigned recruiter can't see this conversation. Use it to escalate concerns or discuss the engagement.
          </div>
          {managerQ.isLoading ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <ChatMessagesSkeleton rows={5} />
            </div>
          ) : managerQ.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-6 text-sm">
              {(managerQ.error as Error).message}
            </div>
          ) : managerQ.data ? (
            <DbChatThread
              thread={managerQ.data}
              viewer="client"
              authorName={authorName}
              initials={initials}
              header={{
                title: "Account manager",
                subtitle: "TalentFlow · Private line",
                avatarText: "AM",
                avatarBg: "linear-gradient(135deg, oklch(0.75 0.15 65), oklch(0.65 0.18 30))",
              }}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
