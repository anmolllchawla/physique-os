// PhysiqueOS Web — Double Progression Logic
// Determines whether to increase weight, reps, or maintain.

export interface ActiveSet {
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
}

export interface ActiveExercise {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
  rpe_target: number;
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  session_id: string;
  template_id: string | null;
  name: string;
  category: string;
  started_at: string;
  exercises: ActiveExercise[];
  current_exercise_index: number;
}

export interface ProgressionResult {
  action: "increase_weight" | "increase_reps" | "maintain" | "deload";
  current_weight: number;
  suggested_weight: number;
  current_reps: number;
  suggested_reps: number;
  reason: string;
}

export function parseRepRange(range: string): { min: number; max: number } {
  const parts = range.split("-").map(Number);
  return {
    min: parts[0] ?? 8,
    max: parts[1] ?? 12,
  };
}

export function estimatedOneRM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function getProgression(
  sets: ActiveSet[],
  targetReps: string
): ProgressionResult {
  const workSets = sets.filter((s) => !s.is_warmup && s.weight_lbs != null);
  if (workSets.length === 0) {
    return {
      action: "maintain",
      current_weight: 0,
      suggested_weight: 0,
      current_reps: 0,
      suggested_reps: 0,
      reason: "No work sets logged",
    };
  }

  const range = parseRepRange(targetReps);
  const lastSet = workSets[workSets.length - 1]!;
  const weight = lastSet.weight_lbs!;
  const reps = lastSet.reps;

  const allSetsHitTop =
    workSets.every((s) => s.reps >= range.max) &&
    workSets.length >= (sets.length > 0 ? sets.filter((s) => !s.is_warmup).length : 1);

  if (allSetsHitTop) {
    return {
      action: "increase_weight",
      current_weight: weight,
      suggested_weight: weight + 5,
      current_reps: reps,
      suggested_reps: range.min,
      reason: `All sets hit ${range.max}+ reps — increase weight`,
    };
  }

  if (reps < range.min) {
    return {
      action: "deload",
      current_weight: weight,
      suggested_weight: Math.round(weight * 0.9),
      current_reps: reps,
      suggested_reps: range.min,
      reason: `Below rep range (${reps} < ${range.min}) — deload`,
    };
  }

  return {
    action: "increase_reps",
    current_weight: weight,
    suggested_weight: weight,
    current_reps: reps,
    suggested_reps: Math.min(reps + 1, range.max),
    reason: `Add reps (${reps} → ${Math.min(reps + 1, range.max)})`,
  };
}
