// PhysiqueOS — Google Health client integration.
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Biometrics } from "@/lib/db";
import { computeReadiness } from "@/lib/readiness";

const DAY = 86400000;

// Pull a string classification (e.g. ECG rhythm result) from a point.
function str(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  for (const val of Object.values(rec)) {
    const deep = str(val, keys);
    if (deep != null) return deep;
  }
  return null;
}

// Extract the YYYY-MM-DD a point belongs to from common time fields.
function pointDate(p: unknown): string | null {
  if (!p || typeof p !== "object") return null;
  const rec = p as Record<string, unknown>;
  const candidates = [
    "endTime",
    "startTime",
    rec.interval && (rec.interval as Record<string, unknown>).endTime,
    rec.interval && (rec.interval as Record<string, unknown>).startTime,
  ];
  for (const c of candidates) {
    if (typeof c === "string") {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  // Deep search for any ISO-ish timestamp.
  const json = JSON.stringify(rec);
  const m = json.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  if (m) return m[0].slice(0, 10);
  return null;
}

interface RawBundle {
  hrv: unknown[];
  rhr: unknown[];
  sleep: unknown[];
  steps: unknown[];
  calories: unknown[];
  spo2: unknown[];
  resp: unknown[];
  azm: unknown[];
  ecg: unknown[];
  irn: unknown[];
}

// Parse the raw API bundle into per-day Biometrics rows. Field paths match the
// actual Google Health response shapes (confirmed via live diagnostic).
function parseBundle(raw: RawBundle): Map<string, Partial<Biometrics>> {
  const byDate = new Map<string, Partial<Biometrics>>();
  const ensure = (d: string) => {
    if (!byDate.has(d)) byDate.set(d, { date: d });
    return byDate.get(d)!;
  };

  // Daily-rollup types carry an explicit { date: {year,month,day} }. Build the
  // YYYY-MM-DD from that when present, else fall back to timestamps.
  const civilDate = (obj: Record<string, unknown> | undefined): string | null => {
    if (!obj) return null;
    const d = obj.date as { year?: number; month?: number; day?: number } | undefined;
    if (d?.year && d?.month && d?.day) {
      return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    }
    return null;
  };

  const toNum = (v: unknown): number | null => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    return null;
  };

  // ── HRV (daily rollup) ──
  for (const p of raw.hrv) {
    const rec = (p as Record<string, unknown>).dailyHeartRateVariability as Record<string, unknown> | undefined;
    if (!rec) continue;
    const d = civilDate(rec);
    const v = toNum(rec.averageHeartRateVariabilityMilliseconds);
    if (d && v != null) ensure(d).hrv_ms = Math.round(v);
  }

  // ── Resting HR (daily rollup, value is a string) ──
  for (const p of raw.rhr) {
    const rec = (p as Record<string, unknown>).dailyRestingHeartRate as Record<string, unknown> | undefined;
    if (!rec) continue;
    const d = civilDate(rec);
    const v = toNum(rec.beatsPerMinute);
    if (d && v != null) ensure(d).resting_hr = Math.round(v);
  }

  // ── SpO2 (daily rollup) ──
  for (const p of raw.spo2) {
    const rec = (p as Record<string, unknown>).dailyOxygenSaturation as Record<string, unknown> | undefined;
    if (!rec) continue;
    const d = civilDate(rec);
    const v = toNum(rec.averagePercentage);
    if (d && v != null) ensure(d).spo2_pct = Math.round(v);
  }

  // ── Respiratory rate (daily rollup) ──
  for (const p of raw.resp) {
    const rec = (p as Record<string, unknown>).dailyRespiratoryRate as Record<string, unknown> | undefined;
    if (!rec) continue;
    const d = civilDate(rec);
    const v = toNum(rec.breathsPerMinute);
    if (d && v != null) ensure(d).respiratory_rate = Math.round(v);
  }

  // ── Sleep (sessions; total minutes in summary, attributed to end date) ──
  const sleepMin: Record<string, number> = {};
  const sleepDeep: Record<string, number> = {};
  const sleepRem: Record<string, number> = {};
  for (const p of raw.sleep) {
    const s = (p as Record<string, unknown>).sleep as Record<string, unknown> | undefined;
    if (!s) continue;
    const interval = s.interval as Record<string, unknown> | undefined;
    const endT = interval?.endTime;
    const d = typeof endT === "string" ? endT.slice(0, 10) : null;
    if (!d) continue;
    const summary = s.summary as Record<string, unknown> | undefined;
    const asleep = toNum(summary?.minutesAsleep);
    if (asleep != null) sleepMin[d] = (sleepMin[d] ?? 0) + asleep;
    // Stage minutes from stagesSummary.
    const stages = (summary?.stagesSummary as { type?: string; minutes?: unknown }[] | undefined) ?? [];
    for (const st of stages) {
      const m = toNum(st.minutes);
      if (m == null) continue;
      if (st.type === "DEEP") sleepDeep[d] = (sleepDeep[d] ?? 0) + m;
      if (st.type === "REM") sleepRem[d] = (sleepRem[d] ?? 0) + m;
    }
  }
  for (const [d, v] of Object.entries(sleepMin)) ensure(d).sleep_minutes = Math.round(v);
  for (const [d, v] of Object.entries(sleepDeep)) ensure(d).sleep_deep_minutes = Math.round(v);
  for (const [d, v] of Object.entries(sleepRem)) ensure(d).sleep_rem_minutes = Math.round(v);

  // ── Steps (intraday intervals; sum per civil date) ──
  const stepSum: Record<string, number> = {};
  for (const p of raw.steps) {
    const st = (p as Record<string, unknown>).steps as Record<string, unknown> | undefined;
    if (!st) continue;
    const interval = st.interval as Record<string, unknown> | undefined;
    const d = intervalCivilDate(interval);
    const v = toNum(st.count);
    if (d && v != null) stepSum[d] = (stepSum[d] ?? 0) + v;
  }
  for (const [d, v] of Object.entries(stepSum)) ensure(d).steps = Math.round(v);

  // ── Active zone minutes (intraday intervals; sum per civil date) ──
  const azmSum: Record<string, number> = {};
  for (const p of raw.azm) {
    const a = (p as Record<string, unknown>).activeZoneMinutes as Record<string, unknown> | undefined;
    if (!a) continue;
    const interval = a.interval as Record<string, unknown> | undefined;
    const d = intervalCivilDate(interval);
    const v = toNum(a.activeZoneMinutes);
    if (d && v != null) azmSum[d] = (azmSum[d] ?? 0) + v;
  }
  for (const [d, v] of Object.entries(azmSum)) ensure(d).active_minutes = Math.round(v);

  // ── Calories (daily rollup; see route — comes back under a rollup shape) ──
  for (const p of raw.calories) {
    const rec = (p as Record<string, unknown>);
    // dailyRollUp responses wrap the value; search common spots.
    const d =
      civilDate(rec.totalCalories as Record<string, unknown> | undefined) ||
      civilDate(rec.interval as Record<string, unknown> | undefined) ||
      civilDate(rec);
    const v =
      toNum((rec.totalCalories as Record<string, unknown> | undefined)?.calories) ??
      toNum(rec.calories) ??
      toNum(rec.value);
    if (d && v != null) ensure(d).calories_out = Math.round(v);
  }

  return byDate;
}

// Pull YYYY-MM-DD from an interval's civilStartTime (intraday types).
function intervalCivilDate(interval: Record<string, unknown> | undefined): string | null {
  if (!interval) return null;
  const civ = interval.civilStartTime as { date?: { year?: number; month?: number; day?: number } } | undefined;
  const d = civ?.date;
  if (d?.year && d?.month && d?.day) {
    return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  }
  const st = interval.startTime;
  if (typeof st === "string") return st.slice(0, 10);
  return null;
}

// Run a sync: call the server, parse, compute readiness, store. Returns a
// status the UI can show.
export async function syncGoogleHealth(): Promise<{
  ok: boolean;
  status: "synced" | "reconnect" | "not_connected" | "error";
  days?: number;
  message?: string;
}> {
  try {
    const res = await fetch("/api/health/sync?days=7");
    if (res.status === 401) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, status: j.error === "reconnect" ? "reconnect" : "not_connected" };
    }
    if (!res.ok) return { ok: false, status: "error", message: `HTTP ${res.status}` };

    const data = (await res.json()) as { raw: RawBundle };
    const parsed = parseBundle(data.raw);

    // Build history for readiness baselines (existing rows + freshly parsed).
    const existing = await db.biometrics.toArray();
    const merged = new Map<string, Biometrics>();
    for (const b of existing) merged.set(b.date, b);

    const now = new Date().toISOString();
    for (const [date, partial] of parsed.entries()) {
      const prev = merged.get(date);
      const row: Biometrics = {
        date,
        hrv_ms: partial.hrv_ms ?? prev?.hrv_ms ?? null,
        resting_hr: partial.resting_hr ?? prev?.resting_hr ?? null,
        sleep_minutes: partial.sleep_minutes ?? prev?.sleep_minutes ?? null,
        sleep_deep_minutes: partial.sleep_deep_minutes ?? prev?.sleep_deep_minutes ?? null,
        sleep_rem_minutes: partial.sleep_rem_minutes ?? prev?.sleep_rem_minutes ?? null,
        spo2_pct: partial.spo2_pct ?? prev?.spo2_pct ?? null,
        respiratory_rate: partial.respiratory_rate ?? prev?.respiratory_rate ?? null,
        steps: partial.steps ?? prev?.steps ?? null,
        calories_out: partial.calories_out ?? prev?.calories_out ?? null,
        active_minutes: partial.active_minutes ?? prev?.active_minutes ?? null,
        readiness: null,
        source: "google_health",
        synced_at: now,
      };
      merged.set(date, row);
    }

    // Compute readiness per day using the other days as history.
    const all = Array.from(merged.values());
    for (const row of all) {
      const history = all.filter((b) => b.date < row.date).slice(-30);
      row.readiness = computeReadiness(row, history).score;
    }

    await db.biometrics.bulkPut(all);

    // ECG and irregular-rhythm readings are events, not daily metrics — store
    // them in the lab markers list (deduped by name+date) so they show in the
    // Stack Monitor's lab section.
    await storeHeartEvents(data.raw.ecg, "ECG", ["classification", "rhythm", "result", "value"]);
    await storeHeartEvents(data.raw.irn, "Irregular rhythm", ["classification", "result", "status", "value"]);

    return { ok: true, status: "synced", days: parsed.size };
  } catch (e) {
    return { ok: false, status: "error", message: e instanceof Error ? e.message : "sync failed" };
  }
}

// Store heart-rhythm events (ECG/IRN) as lab markers, avoiding duplicates.
async function storeHeartEvents(points: unknown[], name: string, valueKeys: string[]): Promise<void> {
  const { generateId } = await import("@/lib/utils");
  const existing = await db.labMarkers.where("name").equals(name).toArray();
  const seen = new Set(existing.map((m) => `${m.date}|${m.value}`));
  for (const p of points) {
    const date = pointDate(p);
    const value = str(p, valueKeys) ?? "Recorded";
    if (!date) continue;
    const key = `${date}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await db.labMarkers.add({ id: generateId(), name, value, date });
  }
}

export function useTodayBiometrics() {
  const today = new Date().toISOString().slice(0, 10);
  return useLiveQuery(() => db.biometrics.get(today), [today]);
}

export function useRecentBiometrics(days = 14) {
  return (
    useLiveQuery(async () => {
      const cutoff = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
      return db.biometrics.filter((b) => b.date >= cutoff).toArray();
    }, [days]) ?? []
  );
}

export async function isHealthConnected(): Promise<boolean> {
  // We infer connection from whether a recent sync produced data; the server
  // is the source of truth, but this avoids an extra round-trip for the UI.
  const count = await db.biometrics.count();
  return count > 0;
}
