// PhysiqueOS Web — Workout Hooks
// Queries and mutations for workout templates, sessions, and logs.

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Exercise, type WorkoutTemplate, type TemplateExercise, type ExerciseLog } from "@/lib/db";
import { generateId } from "@/lib/utils";

// ── Templates ──────────────────────────────────

export function useTemplates() {
  return useLiveQuery(() => db.workoutTemplates.toArray()) ?? [];
}

export function useTemplate(id: string | null) {
  return useLiveQuery(() => (id ? db.workoutTemplates.get(id) : undefined), [id]);
}

export function useTemplateExercises(templateId: string | null) {
  const exercises = useLiveQuery(
    () =>
      templateId
        ? db.templateExercises
            .where("template_id")
            .equals(templateId)
            .sortBy("sort_order")
        : [],
    [templateId]
  ) ?? [];

  const allExercises = useExercises();

  return exercises.map((te) => ({
    ...te,
    exercise: allExercises.find((e) => e.id === te.exercise_id) ?? null,
  }));
}

export function useExercises(category?: string) {
  const all = useLiveQuery(() => db.exercises.toArray()) ?? [];
  if (category) return all.filter((e) => e.category === category);
  return all;
}

// Create a custom (user-defined) exercise. Returns the new id.
export async function createExercise(
  name: string,
  category: Exercise["category"] = "other",
  primary_muscle: string | null = null,
  equipment: string | null = null
): Promise<string> {
  const id = generateId();
  await db.exercises.add({
    id,
    name: name.trim(),
    category,
    primary_muscle,
    equipment,
    is_default: false,
    created_at: new Date().toISOString(),
  });
  return id;
}

// ── Mutations: Templates ───────────────────────

export async function createTemplate(name: string, category: WorkoutTemplate["category"]): Promise<WorkoutTemplate> {
  const t: WorkoutTemplate = {
    id: generateId(), name, category, is_active: true,
    created_at: new Date().toISOString(),
  };
  await db.workoutTemplates.add(t);
  return t;
}

export async function updateTemplate(id: string, updates: Partial<Pick<WorkoutTemplate, "name" | "category" | "is_active">>): Promise<void> {
  await db.workoutTemplates.update(id, updates);
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.workoutTemplates.delete(id);
  await db.templateExercises.where("template_id").equals(id).delete();
}

// ── Mutations: Template Exercises ──────────────

export async function addExerciseToTemplate(
  templateId: string, exerciseId: string,
  target_sets = 3, target_reps = "8-12", rest_seconds = 120, rpe_target = 8
): Promise<TemplateExercise> {
  const count = await db.templateExercises.where("template_id").equals(templateId).count();
  const te: TemplateExercise = {
    id: generateId(), template_id: templateId, exercise_id: exerciseId,
    sort_order: count, target_sets, target_reps, rest_seconds, rpe_target, notes: null,
  };
  await db.templateExercises.add(te);
  return te;
}

export async function updateTemplateExercise(
  id: string,
  updates: Partial<Pick<TemplateExercise, "target_sets" | "target_reps" | "rest_seconds" | "rpe_target" | "notes" | "sort_order">>
): Promise<void> {
  await db.templateExercises.update(id, updates);
}

export async function removeExerciseFromTemplate(id: string): Promise<void> {
  await db.templateExercises.delete(id);
}

// ── Sessions ───────────────────────────────────

export function useRecentSessions(limit = 10) {
  return useLiveQuery(
    () =>
      db.workoutSessions
        .orderBy("started_at")
        .reverse()
        .limit(limit)
        .toArray()
  ) ?? [];
}

export function useActiveSession() {
  return useLiveQuery(
    () => db.workoutSessions.filter((s) => s.completed_at === null).first()
  );
}

export async function completeWorkout(sessionId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return;
  const startedAt = new Date(session.started_at);
  const durationSec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  await db.workoutSessions.update(sessionId, {
    completed_at: new Date().toISOString(),
    duration_sec: durationSec,
  });

  // Auto-delete the source template so the Templates section stays clean
  // (you generate a fresh one each day). Only fires on completion — discarding
  // a workout leaves the template intact. The completed SESSION keeps its own
  // copy of every logged set, so history is unaffected.
  if (session.template_id) {
    try {
      await db.templateExercises.where("template_id").equals(session.template_id).delete();
      await db.workoutTemplates.delete(session.template_id);
    } catch (e) {
      console.error("Failed to auto-delete used template:", e);
    }
  }
}

// ── Exercise Logs ──────────────────────────────

export function useSessionLogs(sessionId: string | null) {
  return useLiveQuery(
    () =>
      sessionId
        ? db.exerciseLogs
            .where("session_id")
            .equals(sessionId)
            .sortBy("created_at")
        : [],
    [sessionId]
  ) ?? [];
}

export async function logSetToDB(log: Omit<ExerciseLog, "id" | "created_at">): Promise<ExerciseLog> {
  const entry: ExerciseLog = {
    ...log,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  await db.exerciseLogs.add(entry);
  return entry;
}

// ── Seed helpers ────────────────────────────────

export async function loadTemplateForSession(templateId: string): Promise<{  template: WorkoutTemplate;
  exercises: (TemplateExercise & { exercise: Exercise | null })[];
} | null> {
  const template = await db.workoutTemplates.get(templateId);
  if (!template) return null;
  const tes = await db.templateExercises.where("template_id").equals(templateId).sortBy("sort_order");
  const allExercises = await db.exercises.toArray();
  return {
    template,
    exercises: tes.map((te) => ({
      ...te,
      exercise: allExercises.find((e) => e.id === te.exercise_id) ?? null,
    })),
  };
}

// ── Previous performance (for progression hints) ──
// Returns the work sets logged for this exercise in the most recent COMPLETED
// session before the current one, so the user knows what to beat.
export async function getLastPerformance(
  exerciseId: string,
  excludeSessionId: string
): Promise<{ date: string; sets: ExerciseLog[] } | null> {
  const logs = await db.exerciseLogs
    .where("exercise_id")
    .equals(exerciseId)
    .toArray();
  if (logs.length === 0) return null;

  // Group by session, ignore the active session and warmups.
  const bySession = new Map<string, ExerciseLog[]>();
  for (const l of logs) {
    if (l.session_id === excludeSessionId || l.is_warmup) continue;
    const arr = bySession.get(l.session_id) ?? [];
    arr.push(l);
    bySession.set(l.session_id, arr);
  }
  if (bySession.size === 0) return null;

  // Find the most recently started session among those.
  const sessions = await db.workoutSessions
    .where("id")
    .anyOf([...bySession.keys()])
    .toArray();
  const completed = sessions
    .filter((s) => s.completed_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  const target = completed[0] ?? sessions.sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (!target) return null;

  const sets = (bySession.get(target.id) ?? []).sort((a, b) => a.set_number - b.set_number);
  return { date: target.started_at, sets };
}
