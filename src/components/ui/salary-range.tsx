import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Configurable bounds — kept generous so freshers (<2 LPA) and senior/exec
// filters (>100 LPA) both work.
export const MIN_SALARY = 0;
export const MAX_SALARY = 1000;

// Increment thresholds: [upperBoundExclusive, step]
// 2–10 → 0.5, 10–30 → 1, 30–60 → 2, 60+ → 5
const STEP_TIERS: Array<{ upto: number; step: number }> = [
  { upto: 10, step: 0.5 },
  { upto: 30, step: 1 },
  { upto: 60, step: 2 },
  { upto: Infinity, step: 5 },
];

function stepFor(value: number, direction: 1 | -1): number {
  // When decrementing, snap using the tier the *previous* value belongs to
  // so 30 → 29 (tier 10-30 step=1) instead of 30 → 28.
  const probe = direction === -1 ? value - 0.0001 : value;
  for (const tier of STEP_TIERS) if (probe < tier.upto) return tier.step;
  return STEP_TIERS[STEP_TIERS.length - 1].step;
}

function clamp(v: number) {
  return Math.min(MAX_SALARY, Math.max(MIN_SALARY, v));
}

function format(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

type FieldProps = {
  label: string;
  value: number | null;
  emptyLabel: string; // "Any" or "No Limit"
  ariaLabel: string;
  onChange: (v: number | null) => void;
};

function SalaryField({ label, value, emptyLabel, ariaLabel, onChange }: FieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") { onChange(null); setEditing(false); return; }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) { setEditing(false); return; }
    onChange(clamp(n));
    setEditing(false);
  };

  const inc = () => {
    if (value == null) { onChange(1); return; }
    const next = clamp(+(value + stepFor(value, 1)).toFixed(2));
    onChange(next);
  };
  const dec = () => {
    if (value == null) return;
    const next = +(value - stepFor(value, -1)).toFixed(2);
    if (next <= MIN_SALARY) { onChange(next < 0 ? null : clamp(next)); return; }
    onChange(clamp(next));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") { e.preventDefault(); inc(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); dec(); }
  };

  const display = value == null ? emptyLabel : `${format(value)} LPA`;
  const isEmpty = value == null;

  return (
    <div className="grid gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
      <div
        role="spinbutton"
        aria-label={`${ariaLabel}: ${isEmpty ? emptyLabel : `${format(value!)} LPA`}`}
        aria-valuenow={value ?? undefined}
        aria-valuemin={MIN_SALARY}
        aria-valuemax={MAX_SALARY}
        tabIndex={editing ? -1 : 0}
        onKeyDown={onKey}
        className="group flex items-center h-9 w-40 rounded-md border border-input bg-card overflow-hidden focus-within:ring-2 focus-within:ring-ring/40 focus:ring-2 focus:ring-ring/40 outline-none transition"
      >
        <button
          type="button"
          onClick={dec}
          disabled={isEmpty}
          aria-label={`Decrease ${ariaLabel}`}
          className="h-full w-8 grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100"
        >
          <Minus className="size-3.5" />
        </button>
        <div className="flex-1 h-full grid place-items-center px-1">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              defaultValue={value ?? ""}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit((e.target as HTMLInputElement).value); }
                else if (e.key === "Escape") { setEditing(false); }
              }}
              className="w-full h-full bg-transparent text-center text-sm tabular-nums outline-none"
              min={MIN_SALARY}
              max={MAX_SALARY}
              step="any"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setDraft(value != null ? format(value) : ""); setEditing(true); }}
              className={cn(
                "w-full h-full text-sm tabular-nums transition-all duration-150",
                isEmpty ? "text-muted-foreground italic" : "text-foreground font-medium",
              )}
            >
              {display}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={inc}
          aria-label={`Increase ${ariaLabel}`}
          className="h-full w-8 grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export type SalaryRangeValue = { min: number | null; max: number | null };

type Props = {
  value: SalaryRangeValue;
  onChange: (v: SalaryRangeValue) => void;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
};

export function SalaryRange({
  value,
  onChange,
  minLabel = "Salary Min (LPA)",
  maxLabel = "Salary Max (LPA)",
  className,
}: Props) {
  const setMin = (min: number | null) => {
    // Keep range valid: if min > current max, bump max to min
    if (min != null && value.max != null && min > value.max) {
      onChange({ min, max: min });
    } else {
      onChange({ ...value, min });
    }
  };
  const setMax = (max: number | null) => {
    if (max != null && value.min != null && max < value.min) {
      onChange({ min: max, max });
    } else {
      onChange({ ...value, max });
    }
  };

  return (
    <div className={cn("flex items-end gap-2", className)}>
      <SalaryField
        label={minLabel}
        value={value.min}
        emptyLabel="Any"
        ariaLabel="Minimum Salary"
        onChange={setMin}
      />
      <SalaryField
        label={maxLabel}
        value={value.max}
        emptyLabel="No Limit"
        ariaLabel="Maximum Salary"
        onChange={setMax}
      />
    </div>
  );
}