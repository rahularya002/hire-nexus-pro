import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compact INR formatter: 1,25,00,000 → ₹1.25 Cr, 14,00,000 → ₹14 L.
 */
export function formatInrShort(amount: number): string {
  if (!amount) return "₹0";
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1).replace(/\.0$/, "")} L`;
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `₹${amount}`;
}
