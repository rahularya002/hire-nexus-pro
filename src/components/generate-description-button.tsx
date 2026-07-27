import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function GenerateDescriptionButton({
  onClick,
  loading,
  hasDescription,
  disabled,
  className,
}: {
  onClick: () => void;
  loading: boolean;
  hasDescription: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      title="Draft a description from the job title"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-60",
        className,
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-primary" />}
      {loading ? "Drafting…" : hasDescription ? "Regenerate with AI" : "Generate with AI"}
    </button>
  );
}
