// PhysiqueOS — Fuel / nutrition hooks (date-keyed, one log per day).
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type FuelLog } from "@/lib/db";
import { generateId, todayISO } from "@/lib/utils";

export const DEFAULT_FUEL_TARGETS = {
  protein_target_g: 160,
  calories_target: 2400,
  water_target_ml: 3000,
};

// Vegetarian-forward quick-add presets (approximate values).
export interface FuelPreset {
  name: string;
  protein_g: number;
  calories: number;
}

export const PROTEIN_PRESETS: FuelPreset[] = [
  { name: "Whey scoop", protein_g: 24, calories: 120 },
  { name: "Greek yogurt (170g)", protein_g: 17, calories: 100 },
  { name: "Paneer (100g)", protein_g: 18, calories: 265 },
  { name: "Tofu (100g)", protein_g: 12, calories: 145 },
  { name: "Soy chunks (50g dry)", protein_g: 26, calories: 173 },
  { name: "Dal (1 bowl)", protein_g: 9, calories: 180 },
  { name: "Chana/chickpeas (1 cup)", protein_g: 15, calories: 269 },
  { name: "Milk (250ml)", protein_g: 8, calories: 150 },
  { name: "Protein shake", protein_g: 30, calories: 170 },
];

export function useTodayFuel(date = todayISO()) {
  return useLiveQuery(() => db.fuelLogs.where("date").equals(date).first(), [date]);
}

export function useRecentFuel(days = 30) {
  return (
    useLiveQuery(() => db.fuelLogs.orderBy("date").reverse().limit(days).toArray(), []) ?? []
  );
}

// Ensure today's log exists (with default targets) and return it.
export async function ensureTodayFuel(date = todayISO()): Promise<FuelLog> {
  const existing = await db.fuelLogs.where("date").equals(date).first();
  if (existing) return existing;
  const log: FuelLog = {
    id: generateId(),
    date,
    ...DEFAULT_FUEL_TARGETS,
    protein_g: 0,
    calories: 0,
    water_ml: 0,
    notes: null,
    created_at: new Date().toISOString(),
  };
  await db.fuelLogs.add(log);
  return log;
}

// Upsert today's fuel by date (reuses id so re-saving overwrites).
export async function updateTodayFuel(
  updates: Partial<Omit<FuelLog, "id" | "date" | "created_at">>,
  date = todayISO()
): Promise<void> {
  const existing = await db.fuelLogs.where("date").equals(date).first();
  if (existing) {
    await db.fuelLogs.update(existing.id, updates);
  } else {
    await db.fuelLogs.add({
      id: generateId(),
      date,
      ...DEFAULT_FUEL_TARGETS,
      protein_g: 0,
      calories: 0,
      water_ml: 0,
      notes: null,
      created_at: new Date().toISOString(),
      ...updates,
    });
  }
}

// Add a preset's macros to today's running totals.
export async function addFuel(
  proteinG: number,
  calories: number,
  waterMl = 0,
  date = todayISO()
): Promise<void> {
  const existing = await db.fuelLogs.where("date").equals(date).first();
  const base = existing ?? (await ensureTodayFuel(date));
  await db.fuelLogs.update(base.id, {
    protein_g: Math.max(0, Math.round(base.protein_g + proteinG)),
    calories: Math.max(0, Math.round(base.calories + calories)),
    water_ml: Math.max(0, Math.round(base.water_ml + waterMl)),
  });
}

export async function resetTodayFuel(date = todayISO()): Promise<void> {
  const existing = await db.fuelLogs.where("date").equals(date).first();
  if (existing) {
    await db.fuelLogs.update(existing.id, { protein_g: 0, calories: 0, water_ml: 0, notes: null });
  }
}
