import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// PhysiqueOS utilities

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function todayISO(): string {
  // Local calendar date (NOT UTC). Using toISOString() here caused entries to
  // log as tomorrow/yesterday in zones far from UTC (e.g. Vancouver after ~5pm).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateShort(dateStr: string): string {
  // Parse a bare YYYY-MM-DD as a LOCAL date. `new Date("2026-06-17")` parses as
  // UTC midnight, which renders as the previous day in negative-offset zones.
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Parse a date string as local time. Handles bare "YYYY-MM-DD" (treated as
// local midnight) and full ISO timestamps (passed through).
export function parseLocalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(dateStr);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatRestTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Unit conversion (canonical storage is lbs / inches) ──
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.45359237 * 10) / 10;
}
export function kgToLbs(kg: number): number {
  return Math.round((kg / 0.45359237) * 10) / 10;
}
export function inToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}
export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export type WeightUnit = "lbs" | "kg";

export function displayWeight(lbs: number | null, unit: WeightUnit): number | null {
  if (lbs == null) return null;
  return unit === "kg" ? lbsToKg(lbs) : Math.round(lbs * 10) / 10;
}
export function toLbs(value: number, unit: WeightUnit): number {
  return unit === "kg" ? kgToLbs(value) : value;
}
