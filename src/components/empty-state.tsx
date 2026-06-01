import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/40 p-10 text-center flex flex-col items-center gap-3",
        className,
      )}
    >
      <div className="size-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}