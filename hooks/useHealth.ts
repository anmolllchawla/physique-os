// PhysiqueOS — Google Health client integration.
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Biometrics } from "@/lib/db";
import { computeReadiness } from "@/lib/readiness";

const DAY = 86400000;

// Pull a numeric value from a data point regardless of minor shape differences.
// Google Health points nest the value under a type-specific key; we search
// common shapes defensively so a schema tweak doesn't crash the parse.
function num(obj: unknown, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  // One level deeper.
  for (const val of Object.values(rec)) {
    const deep = num(val, keys);
    if (deep != null) return deep;
  }
  return null;
}

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

function sumByDate(points: unknown[], valueKeys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) {
    const d = pointDate(p);
    const v = num(p, valueKeys);
    if (d && v != null) out[d] = (out[d] ?? 0) + v;
  }
  return out;
}

function lastByDate(points: unknown[], valueKeys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) {
    const d = pointDate(p);
    const v = num(p, valueKeys);
    if (d && v != null) out[d] = v; // last write wins (daily rollups are 1/day)
  }
  return out;
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

// Parse the raw API bundle into per-day Biometrics rows.
function parseBundle(raw: RawBundle): Map<string, Partial<Biometrics>> {
  const byDate = new Map<string, Partial<Biometrics>>();
  const ensure = (d: string) => {
    if (!byDate.has(d)) byDate.set(d, { date: d });
    return byDate.get(d)!;
  };

  const hrv = lastByDate(raw.hrv, ["dailyRmssd", "rmssd", "value", "milliseconds"]);
  for (const [d, v] of Object.entries(hrv)) ensure(d).hrv_ms = Math.round(v);

  const rhr = lastByDate(raw.rhr, ["bpm", "beatsPerMinute", "value", "restingHeartRate"]);
  for (const [d, v] of Object.entries(rhr)) ensure(d).resting_hr = Math.round(v);

  const spo2 = lastByDate(raw.spo2, ["percentage", "value", "oxygenSaturation"]);
  for (const [d, v] of Object.entries(spo2)) ensure(d).spo2_pct = Math.round(v);

  const resp = lastByDate(raw.resp, ["breathsPerMinute", "value", "respiratoryRate"]);
  for (const [d, v] of Object.entries(resp)) ensure(d).respiratory_rate = Math.round(v);

  const steps = sumByDate(raw.steps, ["count", "steps", "value"]);
  for (const [d, v] of Object.entries(steps)) ensure(d).steps = Math.round(v);

  const cals = sumByDate(raw.calories, ["calories", "kcal", "value", "energy"]);
  for (const [d, v] of Object.entries(cals)) ensure(d).calories_out = Math.round(v);

  const azm = sumByDate(raw.azm, ["minutes", "activeZoneMinutes", "value"]);
  for (const [d, v] of Object.entries(azm)) ensure(d).active_minutes = Math.round(v);

  // Sleep: sum session durations per date (minutes).
  const sleepMin: Record<string, number> = {};
  for (const p of raw.sleep) {
    const d = pointDate(p);
    if (!d) continue;
    const mins = num(p, ["durationMinutes", "minutesAsleep", "totalSleepMinutes"]);
    if (mins != null) {
      sleepMin[d] = (sleepMin[d] ?? 0) + mins;
    } else {
      // Fall back to start/end interval if duration not present.
      const rec = p as Record<string, unknown>;
      const iv = (rec.interval ?? rec) as Record<string, unknown>;
      const s = typeof iv.startTime === "string" ? new Date(iv.startTime).getTime() : NaN;
      const e = typeof iv.endTime === "string" ? new Date(iv.endTime).getTime() : NaN;
      if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
        sleepMin[d] = (sleepMin[d] ?? 0) + Math.round((e - s) / 60000);
      }
    }
  }
  for (const [d, v] of Object.entries(sleepMin)) ensure(d).sleep_minutes = Math.round(v);

  return byDate;
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
