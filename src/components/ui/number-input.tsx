import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "step" | "min" | "max"> {
  value: string | number | undefined;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
}

function clamp(n: number, min?: number, max?: number) {
  if (typeof min === "number" && n < min) n = min;
  if (typeof max === "number" && n > max) n = max;
  return n;
}

function countDecimals(step: number) {
  if (Math.floor(step) === step) return 0;
  const s = step.toString();
  const i = s.indexOf(".");
  return i >= 0 ? s.length - i - 1 : 0;
}

/**
 * Infer a sensible step from the current value's magnitude when the caller
 * doesn't specify one. Keeps salary-like fields (₹ amounts) from bumping by
 * 1 rupee at a time while leaving small counters (openings, days) alone.
 */
function inferStep(n: number): number {
  const abs = Math.abs(n);
  if (abs >= 1_00_000) return 1_00_000; // 1 LPA
  if (abs >= 10_000) return 10_000;
  if (abs >= 1_000) return 1_000;
  if (abs >= 100) return 10;
  return 1;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, step, className, inputClassName, disabled, ...props }, ref) => {
    const current = React.useMemo(() => {
      const v = value === "" || value == null ? NaN : Number(value);
      return Number.isFinite(v) ? v : NaN;
    }, [value]);

    const bump = (dir: 1 | -1, multiplier = 1) => {
      const base = Number.isFinite(current) ? current : (typeof min === "number" ? min : 0);
      const effectiveStep = (step ?? inferStep(base)) * multiplier;
      const decimals = countDecimals(effectiveStep);
      const next = clamp(Number((base + dir * effectiveStep).toFixed(decimals)), min, max);
      onChange(String(next));
    };

    const canDec = disabled || (typeof min === "number" && Number.isFinite(current) && current <= min);
    const canInc = disabled || (typeof max === "number" && Number.isFinite(current) && current >= max);

    return (
      <div
        className={cn(
          "flex h-9 w-full items-stretch rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-full w-8 rounded-r-none rounded-l-md border-r border-input text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={(e) => bump(-1, e.shiftKey ? 10 : 1)}
          disabled={canDec}
          tabIndex={-1}
          aria-label="Decrease (hold Shift for ×10)"
        >
          <Minus className="size-3.5" />
        </Button>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step ?? "any"}
          disabled={disabled}
          className={cn(
            "flex-1 min-w-0 bg-transparent px-2 text-center text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
            inputClassName,
          )}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-full w-8 rounded-l-none rounded-r-md border-l border-input text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={(e) => bump(1, e.shiftKey ? 10 : 1)}
          disabled={canInc}
          tabIndex={-1}
          aria-label="Increase (hold Shift for ×10)"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";