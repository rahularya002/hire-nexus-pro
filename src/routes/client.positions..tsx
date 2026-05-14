
function Messages({ messages, onSend }: { messages: ClientMessage[]; onSend: (body: string) => void }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="size-4 text-primary" /> Conversation with recruiter</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Per-position thread — recruiter typically replies within 2 hours</p>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-secondary/20">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No messages yet — say hello to your recruiter.</div>
        ) : messages.map(m => {
          const mine = m.from === "client";
          return (
            <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <div className={cn("size-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold",
                mine ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-purple to-primary text-primary-foreground")}>
                {m.initials}
              </div>
              <div className={cn("max-w-[75%] min-w-0", mine && "items-end flex flex-col")}>
                <div className={cn("flex items-center gap-2 text-xs text-muted-foreground mb-1", mine && "flex-row-reverse")}>
                  <span className="font-medium text-foreground">{m.authorName}</span>
                  <span>·</span>
                  <span>{m.timeAgo}</span>
                </div>
                <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm")}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={2}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Send className="size-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
