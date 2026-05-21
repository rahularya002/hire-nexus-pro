const PALETTE = [
  "oklch(0.55 0.20 255)",
  "oklch(0.62 0.20 295)",
  "oklch(0.65 0.18 230)",
  "oklch(0.65 0.18 150)",
  "oklch(0.60 0.22 27)",
  "oklch(0.58 0.18 145)",
  "oklch(0.60 0.22 50)",
  "oklch(0.55 0.18 220)",
];

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || name[0]!.toUpperCase();
}

export function colorFor(seed: string | null | undefined, fallback?: string | null): string {
  if (fallback) return fallback;
  const s = seed ?? "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}