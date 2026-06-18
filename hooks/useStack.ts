// PhysiqueOS — Stack Monitor hooks.
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type StackItem,
  type StackLog,
  type StackSafetyCheckIn,
  type LabMarker,
} from "@/lib/db";
import { generateId, todayISO } from "@/lib/utils";
import { computeStackSafety, type StackSafety } from "@/lib/stackSafety";

const DAY = 86400000;

export function useStackItems(includeArchived = false) {
  const items = useLiveQuery(() => db.stackItems.toArray(), []) ?? [];
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return includeArchived ? sorted : sorted.filter((i) => i.active);
}

export function useStackLogs(date = todayISO()) {
  return useLiveQuery(() => db.stackLogs.where("date").equals(date).toArray(), [date]) ?? [];
}

export function useLabMarkers() {
  return (
    useLiveQuery(() => db.labMarkers.orderBy("date").reverse().toArray(), []) ?? []
  );
}

// Live safety score from the last 14 days of logs + check-ins.
export function useStackSafety(): StackSafety | null {
  return (
    useLiveQuery(async () => {
      const today = todayISO();
      const cutoff = new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10);
      const [items, logs, checkIns] = await Promise.all([
        db.stackItems.toArray(),
        db.stackLogs.filter((l) => l.date >= cutoff).toArray(),
        db.stackCheckIns.filter((c) => c.date >= cutoff).toArray(),
      ]);
      return computeStackSafety({ items, recentLogs: logs, recentCheckIns: checkIns, todayISO: today });
    }, []) ?? null
  );
}

// ── Mutations ──
export async function addStackItem(
  data: Omit<StackItem, "id" | "createdAt" | "active">
): Promise<string> {
  const id = generateId();
  await db.stackItems.add({ ...data, id, active: true, createdAt: new Date().toISOString() });
  return id;
}

export async function updateStackItem(id: string, updates: Partial<StackItem>): Promise<void> {
  await db.stackItems.update(id, updates);
}

export async function archiveStackItem(id: string): Promise<void> {
  await db.stackItems.update(id, { active: false });
}

export async function unarchiveStackItem(id: string): Promise<void> {
  await db.stackItems.update(id, { active: true });
}

// Toggle "taken today" for an item, upserting today's log.
export async function toggleTakenToday(
  stackItemId: string,
  date = todayISO()
): Promise<void> {
  const existing = await db.stackLogs
    .where("[stackItemId+date]")
    .equals([stackItemId, date])
    .first();
  if (existing) {
    await db.stackLogs.update(existing.id, { taken: !existing.taken });
  } else {
    await db.stackLogs.add({
      id: generateId(),
      stackItemId,
      date,
      taken: true,
    });
  }
}

// Update today's log for an item (dose text, time, symptoms, etc.). Upserts.
export async function updateTodayLog(
  stackItemId: string,
  updates: Partial<Omit<StackLog, "id" | "stackItemId" | "date">>,
  date = todayISO()
): Promise<void> {
  const existing = await db.stackLogs
    .where("[stackItemId+date]")
    .equals([stackItemId, date])
    .first();
  if (existing) {
    await db.stackLogs.update(existing.id, updates);
  } else {
    await db.stackLogs.add({
      id: generateId(),
      stackItemId,
      date,
      taken: false,
      ...updates,
    });
  }
}

// Save today's safety check-in (one per day, date-keyed upsert).
export async function saveSafetyCheckIn(
  data: Omit<StackSafetyCheckIn, "id" | "date">,
  date = todayISO()
): Promise<void> {
  const existing = await db.stackCheckIns.where("date").equals(date).first();
  if (existing) {
    await db.stackCheckIns.update(existing.id, data);
  } else {
    await db.stackCheckIns.add({ id: generateId(), date, ...data });
  }
}

export async function addLabMarker(data: Omit<LabMarker, "id">): Promise<void> {
  await db.labMarkers.add({ ...data, id: generateId() });
}

export async function deleteLabMarker(id: string): Promise<void> {
  await db.labMarkers.delete(id);
}
