// PhysiqueOS — Agent context builder & analysis tools.
//
// These pure-ish functions read IndexedDB and produce structured summaries.
// They power both the Weekly Review page and the AI Coach. They are designed
// as discrete "tools" so more can be added later without touching the API.
//
// Nothing here calls any network. The AI Coach sends the *output* of
// buildContextSummary() to the server route — and only when the user opts in.

import { db } from "./db";
import { estimatedOneRM } from "./progression";
import { calculateReadinessScore } from "./scoring";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - offsetWeeks * 7;
  const m = new Date(d);
  m.setDate(diff);
  m.setHours(0, 0, 0, 0);
  return m.toISOString().slice(0, 10);
}

// ── Tool: bodyweight trend ──────────────────────────────
export interface BodyweightTrend {
  latest: number | null;
  latest_date: string | null;
  change_7d: number | null;
  change_30d: number | null;
  entries_30d: number;
  direction: "up" | "down" | "flat" | "unknown";
}

export async function analyzeBodyweightTrend(): Promise<BodyweightTrend> {
  const logs = await db.bodyweightLogs.orderBy("date").reverse().toArray();
  if (logs.length === 0) {
    return {
      latest: null,
      latest_date: null,
      change_7d: null,
      change_30d: null,
      entries_30d: 0,
      direction: "unknown",
    };
  }
  const latest = logs[0];
  const w7 = logs.find((l) => l.date <= daysAgoISO(7));
  const w30 = logs.find((l) => l.date <= daysAgoISO(30));
  const change_7d = w7 ? Math.round((latest.weight_lbs - w7.weight_lbs) * 10) / 10 : null;
  const change_30d = w30 ? Math.round((latest.weight_lbs - w30.weight_lbs) * 10) / 10 : null;
  const entries_30d = logs.filter((l) => l.date >= daysAgoISO(30)).length;
  const ref = change_7d ?? change_30d ?? 0;
  const direction = Math.abs(ref) < 0.3 ? "flat" : ref > 0 ? "up" : "down";
  return {
    latest: latest.weight_lbs,
    latest_date: latest.date,
    change_7d,
    change_30d,
    entries_30d,
    direction,
  };
}

// ── Tool: readiness ─────────────────────────────────────
export interface ReadinessAnalysis {
  today: number | null;
  avg_7d: number | null;
  avg_30d: number | null;
  checkins_7d: number;
  trend: "improving" | "declining" | "steady" | "unknown";
}

export async function analyzeReadiness(): Promise<ReadinessAnalysis> {
  const checkins = await db.dailyCheckins.orderBy("date").reverse().toArray();
  if (checkins.length === 0) {
    return { today: null, avg_7d: null, avg_30d: null, checkins_7d: 0, trend: "unknown" };
  }
  const today = checkins.find((c) => c.date === new Date().toISOString().slice(0, 10));
  const scoreOf = (c: (typeof checkins)[number]) =>
    c.readiness_score ?? calculateReadinessScore(c);

  const last7 = checkins.filter((c) => c.date >= daysAgoISO(7));
  const last30 = checkins.filter((c) => c.date >= daysAgoISO(30));
  const avg = (arr: typeof checkins) =>
    arr.length ? Math.round(arr.reduce((s, c) => s + scoreOf(c), 0) / arr.length) : null;

  const avg_7d = avg(last7);
  const prev7 = checkins.filter(
    (c) => c.date < daysAgoISO(7) && c.date >= daysAgoISO(14)
  );
  const avgPrev7 = avg(prev7);
  let trend: ReadinessAnalysis["trend"] = "unknown";
  if (avg_7d != null && avgPrev7 != null) {
    const diff = avg_7d - avgPrev7;
    trend = Math.abs(diff) < 4 ? "steady" : diff > 0 ? "improving" : "declining";
  } else if (avg_7d != null) {
    trend = "steady";
  }

  return {
    today: today?.readiness_score ?? (today ? scoreOf(today) : null),
    avg_7d,
    avg_30d: avg(last30),
    checkins_7d: last7.length,
    trend,
  };
}

// ── Tool: workout progress / PRs ────────────────────────
export interface WorkoutProgress {
  sessions_7d: number;
  sessions_30d: number;
  sets_7d: number;
  volume_7d_lbs: number;
  volume_prev_7d_lbs: number;
  top_lifts: { name: string; best_e1rm: number; weight: number; reps: number }[];
}

export async function analyzeWorkoutProgress(): Promise<WorkoutProgress> {
  const sessions = await db.workoutSessions.toArray();
  const completed = sessions.filter((s) => s.completed_at);
  const logs = await db.exerciseLogs.toArray();
  const exercises = await db.exercises.toArray();
  const exMap = new Map(exercises.map((e) => [e.id, e.name]));

  const wkStart = startOfWeekISO(0);
  const prevWkStart = startOfWeekISO(1);

  const sessions_7d = completed.filter((s) => s.started_at.slice(0, 10) >= daysAgoISO(7)).length;
  const sessions_30d = completed.filter((s) => s.started_at.slice(0, 10) >= daysAgoISO(30)).length;

  const work = logs.filter((l) => !l.is_warmup);
  const thisWk = work.filter((l) => l.created_at.slice(0, 10) >= wkStart);
  const prevWk = work.filter(
    (l) => l.created_at.slice(0, 10) >= prevWkStart && l.created_at.slice(0, 10) < wkStart
  );
  const vol = (arr: typeof work) => Math.round(arr.reduce((s, l) => s + (l.weight_lbs ?? 0) * l.reps, 0));

  // PRs by best estimated 1RM.
  const prMap = new Map<string, { name: string; best_e1rm: number; weight: number; reps: number }>();
  for (const l of work) {
    if (!l.weight_lbs) continue;
    const e1rm = estimatedOneRM(l.weight_lbs, l.reps);
    const cur = prMap.get(l.exercise_id);
    if (!cur || e1rm > cur.best_e1rm) {
      prMap.set(l.exercise_id, {
        name: exMap.get(l.exercise_id) ?? "Exercise",
        best_e1rm: e1rm,
        weight: l.weight_lbs,
        reps: l.reps,
      });
    }
  }
  const top_lifts = [...prMap.values()].sort((a, b) => b.best_e1rm - a.best_e1rm).slice(0, 5);

  return {
    sessions_7d,
    sessions_30d,
    sets_7d: thisWk.length,
    volume_7d_lbs: vol(thisWk),
    volume_prev_7d_lbs: vol(prevWk),
    top_lifts,
  };
}

// ── Tool: suggest next workout ──────────────────────────
// Heuristic only (no AI): pick the active template least recently trained.
export interface NextWorkoutSuggestion {
  template_id: string | null;
  template_name: string | null;
  reason: string;
}

export async function suggestNextWorkout(): Promise<NextWorkoutSuggestion> {
  const templates = (await db.workoutTemplates.toArray()).filter((t) => t.is_active);
  if (templates.length === 0) {
    return { template_id: null, template_name: null, reason: "No active templates yet." };
  }
  const sessions = (await db.workoutSessions.toArray())
    .filter((s) => s.completed_at && s.template_id)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  const lastByTemplate = new Map<string, string>();
  for (const s of sessions) {
    if (s.template_id && !lastByTemplate.has(s.template_id)) {
      lastByTemplate.set(s.template_id, s.started_at);
    }
  }
  // Least recently used (never-used sorts first).
  const ranked = [...templates].sort((a, b) => {
    const la = lastByTemplate.get(a.id) ?? "";
    const lb = lastByTemplate.get(b.id) ?? "";
    return la.localeCompare(lb);
  });
  const pick = ranked[0];
  const last = lastByTemplate.get(pick.id);
  return {
    template_id: pick.id,
    template_name: pick.name,
    reason: last
      ? `Least recently trained (last on ${last.slice(0, 10)}).`
      : "You haven't done this one yet.",
  };
}

// ── Tool: weekly summary ────────────────────────────────
export interface WeekSummary {
  week_start: string;
  workouts: number;
  total_sets: number;
  total_volume_lbs: number;
  duration_sec: number;
  avg_readiness: number | null;
  checkins: number;
  weight_change_lbs: number | null;
  supplement_adherence_pct: number | null;
  best_session: { id: string; name: string; volume: number } | null;
}

export async function summarizeWeek(offsetWeeks = 0): Promise<WeekSummary> {
  const start = startOfWeekISO(offsetWeeks);
  const end = startOfWeekISO(offsetWeeks - 1);

  const sessions = (await db.workoutSessions.toArray()).filter(
    (s) => s.completed_at && s.started_at.slice(0, 10) >= start && s.started_at.slice(0, 10) < end
  );
  const sessionIds = new Set(sessions.map((s) => s.id));
  const logs = (await db.exerciseLogs.toArray()).filter(
    (l) => sessionIds.has(l.session_id) && !l.is_warmup
  );

  const checkins = (await db.dailyCheckins.toArray()).filter(
    (c) => c.date >= start && c.date < end
  );
  const weights = (await db.bodyweightLogs.toArray())
    .filter((w) => w.date >= start && w.date < end)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Best session by volume.
  const volBySession = new Map<string, number>();
  for (const l of logs) {
    volBySession.set(
      l.session_id,
      (volBySession.get(l.session_id) ?? 0) + (l.weight_lbs ?? 0) * l.reps
    );
  }
  let best: WeekSummary["best_session"] = null;
  for (const s of sessions) {
    const v = Math.round(volBySession.get(s.id) ?? 0);
    if (!best || v > best.volume) best = { id: s.id, name: s.name, volume: v };
  }

  // Supplement adherence for the week.
  const activeSupps = (await db.supplements.toArray()).filter((s) => s.is_active);
  let suppPct: number | null = null;
  if (activeSupps.length > 0) {
    const suppLogs = (await db.supplementLogs.toArray()).filter(
      (l) => l.date >= start && l.date < end && l.taken
    );
    const possible = activeSupps.length * 7;
    suppPct = possible ? Math.round((suppLogs.length / possible) * 100) : null;
  }

  const avgReadiness = checkins.length
    ? Math.round(
        checkins.reduce((s, c) => s + (c.readiness_score ?? calculateReadinessScore(c)), 0) /
          checkins.length
      )
    : null;

  return {
    week_start: start,
    workouts: sessions.length,
    total_sets: logs.length,
    total_volume_lbs: Math.round(logs.reduce((s, l) => s + (l.weight_lbs ?? 0) * l.reps, 0)),
    duration_sec: sessions.reduce((s, x) => s + (x.duration_sec ?? 0), 0),
    avg_readiness: avgReadiness,
    checkins: checkins.length,
    weight_change_lbs:
      weights.length >= 2
        ? Math.round((weights[weights.length - 1].weight_lbs - weights[0].weight_lbs) * 10) / 10
        : null,
    supplement_adherence_pct: suppPct,
    best_session: best,
  };
}

// ── Master context summary for the AI Coach ─────────────
export interface ContextSummary {
  generated_at: string;
  weight: BodyweightTrend;
  readiness: ReadinessAnalysis;
  workouts: WorkoutProgress;
  this_week: WeekSummary;
  next_workout: NextWorkoutSuggestion;
  active_supplements: { name: string; category: string; schedule: string | null }[];
}

export async function buildContextSummary(): Promise<ContextSummary> {
  const [weight, readiness, workouts, this_week, next_workout, supps] = await Promise.all([
    analyzeBodyweightTrend(),
    analyzeReadiness(),
    analyzeWorkoutProgress(),
    summarizeWeek(0),
    suggestNextWorkout(),
    db.supplements.toArray(),
  ]);

  return {
    generated_at: new Date().toISOString(),
    weight,
    readiness,
    workouts,
    this_week,
    next_workout,
    active_supplements: supps
      .filter((s) => s.is_active)
      .map((s) => ({ name: s.name, category: s.category, schedule: s.schedule })),
  };
}

// ── AI-generated workout plans ──────────────────────────
// The model returns a structured plan (validated below). We map each exercise
// name onto the user's real library — reusing existing exercises and creating
// custom ones for anything new — then save it as a real template. This keeps
// AI output from ever inserting "fake" data: it can only describe a plan that
// gets reconciled against the actual DB.

import { generateId } from "./utils";
import type { WorkoutTemplate } from "./db";

export interface PlannedExercise {
  name: string;
  category?: "push" | "pull" | "legs" | "core" | "cardio" | "other";
  target_sets?: number;
  target_reps?: string;
  rest_seconds?: number;
  rpe_target?: number;
  notes?: string | null;
}

export interface WorkoutPlan {
  name: string;
  category?: WorkoutTemplate["category"];
  exercises: PlannedExercise[];
  rationale?: string;
}

const VALID_TEMPLATE_CATS: WorkoutTemplate["category"][] = [
  "push",
  "pull",
  "legs",
  "full_body",
  "custom",
];
const VALID_EX_CATS = ["push", "pull", "legs", "core", "cardio", "other"] as const;

// Defensive parse: accepts the model's JSON (possibly wrapped in prose/fences)
// and returns a clean WorkoutPlan or null.
export function parseWorkoutPlan(raw: string): WorkoutPlan | null {
  let text = raw.trim();
  // Strip ```json fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Grab the outermost {...} if there's surrounding prose.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  text = text.slice(first, last + 1);

  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.exercises) || o.exercises.length === 0) return null;

  const exercises: PlannedExercise[] = [];
  for (const e of o.exercises as Record<string, unknown>[]) {
    if (!e || typeof e.name !== "string" || !e.name.trim()) continue;
    exercises.push({
      name: e.name.trim().slice(0, 80),
      category: VALID_EX_CATS.includes(e.category as never)
        ? (e.category as PlannedExercise["category"])
        : "other",
      target_sets: clampInt(e.target_sets, 1, 10, 3),
      target_reps: typeof e.target_reps === "string" ? e.target_reps.slice(0, 16) : "8-12",
      rest_seconds: clampInt(e.rest_seconds, 15, 600, 120),
      rpe_target: clampNum(e.rpe_target, 5, 10, 8),
      notes: typeof e.notes === "string" ? e.notes.slice(0, 200) : null,
    });
  }
  if (exercises.length === 0) return null;

  const cat = VALID_TEMPLATE_CATS.includes(o.category as never)
    ? (o.category as WorkoutTemplate["category"])
    : "custom";

  return {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 60) : "AI Workout",
    category: cat,
    exercises: exercises.slice(0, 12),
    rationale: typeof o.rationale === "string" ? o.rationale.slice(0, 500) : undefined,
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v), 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Persist a validated plan as a real template. Reuses existing exercises by
// name (case-insensitive); creates custom ones for anything new.
export async function saveWorkoutPlanAsTemplate(plan: WorkoutPlan): Promise<string> {
  const { db } = await import("./db");

  const existing = await db.exercises.toArray();
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));

  const templateId = generateId();
  await db.workoutTemplates.add({
    id: templateId,
    name: plan.name,
    category: plan.category ?? "custom",
    is_active: true,
    created_at: new Date().toISOString(),
  });

  let sort = 0;
  for (const pe of plan.exercises) {
    let exerciseId: string;
    const match = byName.get(pe.name.toLowerCase());
    if (match) {
      exerciseId = match.id;
    } else {
      exerciseId = generateId();
      const newEx = {
        id: exerciseId,
        name: pe.name,
        category: pe.category ?? ("other" as const),
        primary_muscle: null,
        equipment: null,
        is_default: false,
        created_at: new Date().toISOString(),
      };
      await db.exercises.add(newEx);
      byName.set(pe.name.toLowerCase(), newEx);
    }
    await db.templateExercises.add({
      id: generateId(),
      template_id: templateId,
      exercise_id: exerciseId,
      sort_order: sort++,
      target_sets: pe.target_sets ?? 3,
      target_reps: pe.target_reps ?? "8-12",
      rest_seconds: pe.rest_seconds ?? 120,
      rpe_target: pe.rpe_target ?? 8,
      notes: pe.notes ?? null,
    });
  }

  return templateId;
}

// ── Stack safety context (for the Coach's stack-review actions) ──
// Summarizes the user's stack logs/symptoms/labs and the LOCAL safety score.
// We pass user-entered dose text through verbatim but never originate doses.
export async function buildStackContext(): Promise<unknown> {
  const { db } = await import("./db");
  const { computeStackSafety } = await import("./stackSafety");
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [items, logs, checkIns, labs] = await Promise.all([
    db.stackItems.toArray(),
    db.stackLogs.filter((l) => l.date >= cutoff).toArray(),
    db.stackCheckIns.filter((c) => c.date >= cutoff).toArray(),
    db.labMarkers.orderBy("date").reverse().limit(20).toArray(),
  ]);

  const safety = computeStackSafety({ items, recentLogs: logs, recentCheckIns: checkIns, todayISO: today });

  return {
    generated_at: new Date().toISOString(),
    safety_score: safety.score,
    safety_state: safety.state,
    red_flags: safety.redFlags,
    reasons: safety.reasons,
    active_items: items
      .filter((i) => i.active)
      .map((i) => ({ name: i.name, category: i.category, route: i.route, user_plan: i.userEnteredPlan ?? null })),
    recent_symptoms: Array.from(
      new Set([
        ...logs.flatMap((l) => l.symptoms ?? []),
        ...checkIns.flatMap((c) => c.symptoms ?? []),
      ])
    ),
    injection_site_issues: Array.from(new Set(checkIns.flatMap((c) => c.injectionSiteIssues ?? []))),
    recent_labs: labs.map((m) => ({ name: m.name, value: m.value, unit: m.unit ?? null, date: m.date })),
  };
}
