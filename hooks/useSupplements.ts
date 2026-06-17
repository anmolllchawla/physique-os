// PhysiqueOS — Supplement / peptide tracker hooks (manual tracking only).
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Supplement, type SupplementLog } from "@/lib/db";
import { generateId, todayISO } from "@/lib/utils";

export function useSupplements(activeOnly = false) {
  const all =
    useLiveQuery(() => db.supplements.orderBy("sort_order").toArray(), []) ?? [];
  return activeOnly ? all.filter((s) => s.is_active) : all;
}

export function useSupplement(id: string | null) {
  return useLiveQuery(() => (id ? db.supplements.get(id) : undefined), [id]);
}

export function useSupplementLogs(supplementId: string | null) {
  return (
    useLiveQuery(
      () =>
        supplementId
          ? db.supplementLogs
              .where("supplement_id")
              .equals(supplementId)
              .toArray()
          : [],
      [supplementId]
    ) ?? []
  );
}

// All logs for a given date (used by the dashboard / "today" checklist).
export function useTodaySupplementLogs(date = todayISO()) {
  return (
    useLiveQuery(
      () => db.supplementLogs.where("date").equals(date).toArray(),
      [date]
    ) ?? []
  );
}

export async function createSupplement(
  input: Omit<Supplement, "id" | "created_at" | "sort_order" | "is_active"> &
    Partial<Pick<Supplement, "is_active">>
): Promise<Supplement> {
  const count = await db.supplements.count();
  const s: Supplement = {
    id: generateId(),
    sort_order: count,
    is_active: input.is_active ?? true,
    created_at: new Date().toISOString(),
    name: input.name,
    category: input.category,
    dose: input.dose,
    schedule: input.schedule,
    notes: input.notes,
    start_date: input.start_date,
    end_date: input.end_date,
  };
  await db.supplements.add(s);
  return s;
}

export async function updateSupplement(
  id: string,
  updates: Partial<Supplement>
): Promise<void> {
  await db.supplements.update(id, updates);
}

export async function deleteSupplement(id: string): Promise<void> {
  await db.supplements.delete(id);
  await db.supplementLogs.where("supplement_id").equals(id).delete();
}

// Toggle whether a supplement was taken on a date. Upserts by (supplement, date).
export async function toggleSupplementTaken(
  supplementId: string,
  date: string,
  taken: boolean
): Promise<void> {
  const existing = await db.supplementLogs
    .where("[supplement_id+date]")
    .equals([supplementId, date])
    .first();
  if (existing) {
    await db.supplementLogs.update(existing.id, { taken });
  } else {
    const log: SupplementLog = {
      id: generateId(),
      supplement_id: supplementId,
      date,
      taken,
      notes: null,
      created_at: new Date().toISOString(),
    };
    await db.supplementLogs.add(log);
  }
}

// Adherence over the last N days for one supplement: fraction of days "taken".
export async function adherenceRate(
  supplementId: string,
  days = 30
): Promise<{ taken: number; total: number; pct: number }> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);
  const logs = await db.supplementLogs
    .where("supplement_id")
    .equals(supplementId)
    .toArray();
  const inRange = logs.filter((l) => l.date >= sinceStr && l.taken);
  const taken = inRange.length;
  return { taken, total: days, pct: Math.round((taken / days) * 100) };
}
