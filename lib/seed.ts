// PhysiqueOS Web — Seed Data
// Auto-runs on first launch. Idempotent — skips if data exists.

import { db } from "./db";
import { generateId } from "./utils";

const EXERCISES = [
  { name: "Barbell Bench Press", category: "push" as const, primary_muscle: "Chest", equipment: "Barbell" },
  { name: "Incline Dumbbell Press", category: "push" as const, primary_muscle: "Upper Chest", equipment: "Dumbbell" },
  { name: "Dumbbell Shoulder Press", category: "push" as const, primary_muscle: "Shoulders", equipment: "Dumbbell" },
  { name: "Lateral Raise", category: "push" as const, primary_muscle: "Side Delts", equipment: "Dumbbell" },
  { name: "Tricep Pushdown", category: "push" as const, primary_muscle: "Triceps", equipment: "Cable" },
  { name: "Cable Fly", category: "push" as const, primary_muscle: "Chest", equipment: "Cable" },
  { name: "Front Raise", category: "push" as const, primary_muscle: "Front Delts", equipment: "Dumbbell" },
  { name: "Overhead Tricep Extension", category: "push" as const, primary_muscle: "Triceps", equipment: "Cable" },
  { name: "Deadlift", category: "pull" as const, primary_muscle: "Posterior Chain", equipment: "Barbell" },
  { name: "Pull-Up", category: "pull" as const, primary_muscle: "Lats", equipment: "Bodyweight" },
  { name: "Barbell Row", category: "pull" as const, primary_muscle: "Upper Back", equipment: "Barbell" },
  { name: "Seated Cable Row", category: "pull" as const, primary_muscle: "Mid Back", equipment: "Cable" },
  { name: "Face Pull", category: "pull" as const, primary_muscle: "Rear Delts", equipment: "Cable" },
  { name: "Barbell Curl", category: "pull" as const, primary_muscle: "Biceps", equipment: "Barbell" },
  { name: "Hammer Curl", category: "pull" as const, primary_muscle: "Biceps", equipment: "Dumbbell" },
  { name: "Lat Pulldown", category: "pull" as const, primary_muscle: "Lats", equipment: "Cable" },
  { name: "Barbell Squat", category: "legs" as const, primary_muscle: "Quads", equipment: "Barbell" },
  { name: "Romanian Deadlift", category: "legs" as const, primary_muscle: "Hamstrings", equipment: "Barbell" },
  { name: "Leg Press", category: "legs" as const, primary_muscle: "Quads", equipment: "Machine" },
  { name: "Leg Extension", category: "legs" as const, primary_muscle: "Quads", equipment: "Machine" },
  { name: "Leg Curl", category: "legs" as const, primary_muscle: "Hamstrings", equipment: "Machine" },
  { name: "Calf Raise", category: "legs" as const, primary_muscle: "Calves", equipment: "Machine" },
  { name: "Bulgarian Split Squat", category: "legs" as const, primary_muscle: "Quads", equipment: "Dumbbell" },
  { name: "Hanging Leg Raise", category: "core" as const, primary_muscle: "Abs", equipment: "Bodyweight" },

  // ── Push ──
  { name: "Overhead Press", category: "push" as const, primary_muscle: "Shoulders", equipment: "Barbell" },
  { name: "Incline Barbell Press", category: "push" as const, primary_muscle: "Upper Chest", equipment: "Barbell" },
  { name: "Dumbbell Bench Press", category: "push" as const, primary_muscle: "Chest", equipment: "Dumbbell" },
  { name: "Dip", category: "push" as const, primary_muscle: "Lower Chest", equipment: "Bodyweight" },
  { name: "Machine Chest Press", category: "push" as const, primary_muscle: "Chest", equipment: "Machine" },
  { name: "Pec Deck", category: "push" as const, primary_muscle: "Chest", equipment: "Machine" },
  { name: "Arnold Press", category: "push" as const, primary_muscle: "Shoulders", equipment: "Dumbbell" },
  { name: "Cable Lateral Raise", category: "push" as const, primary_muscle: "Side Delts", equipment: "Cable" },
  { name: "Skullcrusher", category: "push" as const, primary_muscle: "Triceps", equipment: "Barbell" },
  { name: "Close-Grip Bench Press", category: "push" as const, primary_muscle: "Triceps", equipment: "Barbell" },

  // ── Pull ──
  { name: "Chin-Up", category: "pull" as const, primary_muscle: "Biceps", equipment: "Bodyweight" },
  { name: "T-Bar Row", category: "pull" as const, primary_muscle: "Mid Back", equipment: "Barbell" },
  { name: "Dumbbell Row", category: "pull" as const, primary_muscle: "Lats", equipment: "Dumbbell" },
  { name: "Chest-Supported Row", category: "pull" as const, primary_muscle: "Upper Back", equipment: "Machine" },
  { name: "Straight-Arm Pulldown", category: "pull" as const, primary_muscle: "Lats", equipment: "Cable" },
  { name: "Preacher Curl", category: "pull" as const, primary_muscle: "Biceps", equipment: "Barbell" },
  { name: "Incline Dumbbell Curl", category: "pull" as const, primary_muscle: "Biceps", equipment: "Dumbbell" },
  { name: "Cable Curl", category: "pull" as const, primary_muscle: "Biceps", equipment: "Cable" },
  { name: "Rear Delt Fly", category: "pull" as const, primary_muscle: "Rear Delts", equipment: "Dumbbell" },
  { name: "Shrug", category: "pull" as const, primary_muscle: "Traps", equipment: "Barbell" },

  // ── Legs ──
  { name: "Front Squat", category: "legs" as const, primary_muscle: "Quads", equipment: "Barbell" },
  { name: "Hack Squat", category: "legs" as const, primary_muscle: "Quads", equipment: "Machine" },
  { name: "Goblet Squat", category: "legs" as const, primary_muscle: "Quads", equipment: "Dumbbell" },
  { name: "Walking Lunge", category: "legs" as const, primary_muscle: "Quads", equipment: "Dumbbell" },
  { name: "Hip Thrust", category: "legs" as const, primary_muscle: "Glutes", equipment: "Barbell" },
  { name: "Glute Bridge", category: "legs" as const, primary_muscle: "Glutes", equipment: "Bodyweight" },
  { name: "Seated Calf Raise", category: "legs" as const, primary_muscle: "Calves", equipment: "Machine" },
  { name: "Sumo Deadlift", category: "legs" as const, primary_muscle: "Posterior Chain", equipment: "Barbell" },
  { name: "Good Morning", category: "legs" as const, primary_muscle: "Hamstrings", equipment: "Barbell" },

  // ── Core ──
  { name: "Plank", category: "core" as const, primary_muscle: "Core", equipment: "Bodyweight" },
  { name: "Cable Crunch", category: "core" as const, primary_muscle: "Abs", equipment: "Cable" },
  { name: "Ab Wheel Rollout", category: "core" as const, primary_muscle: "Abs", equipment: "Other" },
  { name: "Russian Twist", category: "core" as const, primary_muscle: "Obliques", equipment: "Bodyweight" },
  { name: "Decline Sit-Up", category: "core" as const, primary_muscle: "Abs", equipment: "Bodyweight" },

  // ── Cardio ──
  { name: "Treadmill Run", category: "cardio" as const, primary_muscle: "Cardio", equipment: "Machine" },
  { name: "Incline Walk", category: "cardio" as const, primary_muscle: "Cardio", equipment: "Machine" },
  { name: "Stationary Bike", category: "cardio" as const, primary_muscle: "Cardio", equipment: "Machine" },
  { name: "Rowing Machine", category: "cardio" as const, primary_muscle: "Cardio", equipment: "Machine" },
  { name: "Stair Climber", category: "cardio" as const, primary_muscle: "Cardio", equipment: "Machine" },
  { name: "Jump Rope", category: "cardio" as const, primary_muscle: "Cardio", equipment: "Other" },
];

const TEMPLATES = [
  {
    name: "Push Day", category: "push" as const,
    exercises: [
      { name: "Barbell Bench Press", target_sets: 4, target_reps: "6-10", rest_seconds: 180, rpe_target: 8.5 },
      { name: "Incline Dumbbell Press", target_sets: 3, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Dumbbell Shoulder Press", target_sets: 3, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Lateral Raise", target_sets: 4, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Tricep Pushdown", target_sets: 3, target_reps: "10-15", rest_seconds: 90, rpe_target: 8.0 },
      { name: "Cable Fly", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
    ],
  },
  {
    name: "Pull Day", category: "pull" as const,
    exercises: [
      { name: "Deadlift", target_sets: 3, target_reps: "5-8", rest_seconds: 180, rpe_target: 8.5 },
      { name: "Pull-Up", target_sets: 3, target_reps: "8-12", rest_seconds: 150, rpe_target: 8.0 },
      { name: "Seated Cable Row", target_sets: 3, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Face Pull", target_sets: 3, target_reps: "15-20", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Barbell Curl", target_sets: 3, target_reps: "8-12", rest_seconds: 90, rpe_target: 8.0 },
      { name: "Hammer Curl", target_sets: 3, target_reps: "10-15", rest_seconds: 90, rpe_target: 7.5 },
    ],
  },
  {
    name: "Legs Day", category: "legs" as const,
    exercises: [
      { name: "Barbell Squat", target_sets: 4, target_reps: "6-10", rest_seconds: 180, rpe_target: 8.5 },
      { name: "Romanian Deadlift", target_sets: 3, target_reps: "8-12", rest_seconds: 150, rpe_target: 8.0 },
      { name: "Leg Press", target_sets: 3, target_reps: "10-15", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Leg Extension", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Leg Curl", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Calf Raise", target_sets: 4, target_reps: "15-20", rest_seconds: 90, rpe_target: 7.5 },
    ],
  },
  {
    name: "Upper Body", category: "full_body" as const,
    exercises: [
      { name: "Barbell Bench Press", target_sets: 3, target_reps: "6-10", rest_seconds: 150, rpe_target: 8.5 },
      { name: "Barbell Row", target_sets: 3, target_reps: "6-10", rest_seconds: 150, rpe_target: 8.5 },
      { name: "Dumbbell Shoulder Press", target_sets: 3, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Lat Pulldown", target_sets: 3, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Lateral Raise", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Barbell Curl", target_sets: 2, target_reps: "10-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Tricep Pushdown", target_sets: 2, target_reps: "10-15", rest_seconds: 90, rpe_target: 7.5 },
    ],
  },
  {
    name: "Lower Body", category: "legs" as const,
    exercises: [
      { name: "Barbell Squat", target_sets: 3, target_reps: "6-10", rest_seconds: 180, rpe_target: 8.5 },
      { name: "Romanian Deadlift", target_sets: 3, target_reps: "8-12", rest_seconds: 150, rpe_target: 8.0 },
      { name: "Bulgarian Split Squat", target_sets: 3, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Leg Curl", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Calf Raise", target_sets: 4, target_reps: "15-20", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Hanging Leg Raise", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
    ],
  },
  {
    name: "Arms & Shoulders", category: "custom" as const,
    exercises: [
      { name: "Dumbbell Shoulder Press", target_sets: 4, target_reps: "8-12", rest_seconds: 120, rpe_target: 8.0 },
      { name: "Lateral Raise", target_sets: 4, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Front Raise", target_sets: 3, target_reps: "12-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Barbell Curl", target_sets: 3, target_reps: "8-12", rest_seconds: 90, rpe_target: 8.0 },
      { name: "Hammer Curl", target_sets: 3, target_reps: "10-15", rest_seconds: 90, rpe_target: 7.5 },
      { name: "Tricep Pushdown", target_sets: 3, target_reps: "10-15", rest_seconds: 90, rpe_target: 8.0 },
      { name: "Overhead Tricep Extension", target_sets: 3, target_reps: "10-15", rest_seconds: 90, rpe_target: 7.5 },
    ],
  },
];

export async function seedIfNeeded(): Promise<void> {
  const exerciseCount = await db.exercises.count();
  if (exerciseCount > 0) {
    // Existing install — top up any default exercises added in later versions
    // (matched by name) without disturbing the user's custom exercises.
    await topUpExercises();
    return;
  }

  console.log("[Seed] Seeding exercises...");
  const exercises = EXERCISES.map((ex, i) => ({
    id: `ex-${i + 1}`,
    ...ex,
    is_default: true,
    created_at: new Date().toISOString(),
  }));
  await db.exercises.bulkAdd(exercises);
  console.log(`[Seed] Seeded ${exercises.length} exercises`);

  console.log("[Seed] Seeding templates...");
  for (const def of TEMPLATES) {
    const templateId = generateId();
    await db.workoutTemplates.add({
      id: templateId,
      name: def.name,
      category: def.category,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const templateExercises = def.exercises.map((te, i) => {
      const exercise = exercises.find((ex) => ex.name === te.name);
      if (!exercise) throw new Error(`Exercise "${te.name}" not found`);
      return {
        id: generateId(),
        template_id: templateId,
        exercise_id: exercise.id,
        sort_order: i,
        target_sets: te.target_sets,
        target_reps: te.target_reps,
        rest_seconds: te.rest_seconds,
        rpe_target: te.rpe_target,
        notes: null,
      };
    });
    await db.templateExercises.bulkAdd(templateExercises);
  }
  console.log(`[Seed] Seeded ${TEMPLATES.length} templates`);
}

// Adds any default exercises (by name) that aren't already in the DB. Safe to
// run on every launch — only inserts what's missing.
async function topUpExercises(): Promise<void> {
  const existing = await db.exercises.toArray();
  const haveNames = new Set(existing.map((e) => e.name.toLowerCase()));
  const missing = EXERCISES.filter((ex) => !haveNames.has(ex.name.toLowerCase()));
  if (missing.length === 0) return;
  const toAdd = missing.map((ex) => ({
    id: generateId(),
    ...ex,
    is_default: true,
    created_at: new Date().toISOString(),
  }));
  await db.exercises.bulkAdd(toAdd);
  console.log(`[Seed] Topped up ${toAdd.length} new default exercises`);
}
