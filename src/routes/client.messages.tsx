import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { ChatThread } from "@/components/chat-thread";
import { getChannelByClientId } from "@/lib/chat-data";
import { clientCompany } from "@/lib/client-data";
import { clients } from "@/lib/mock-data";

export const Route = createFileRoute("/client/messages")({
  ssr: false,
  component: () => <ClientShell><ClientMessagesPage /></ClientShell>,
});

function ClientMessagesPage() {
  // Find the client record matching the portal's company
  const matched = clients.find((c) => c.name === clientCompany.name) ?? clients[0];
  const channel = getChannelByClientId(matched.id);

  if (!channel) {
    return <div className="text-sm text-muted-foreground">No conversation available.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" /> Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct line to your TalentFlow account team. Share files, screenshots, and questions — replies typically within 2 hours.
        </p>
      </div>

      <ChatThread
        channel={channel}
        viewer="client"
        authorName="Vikram Shah"
        initials="VS"
      />

      <div className="text-[11px] text-muted-foreground">
        Note: this is a prototype. Files are held in-memory only and won't persist across reloads.
      </div>
    </div>
  );
}