// PhysiqueOS — Daily Lifestyle Score
//
// 0–100 score across weighted pillars, date-keyed and computed from whatever
// data exists for the day. Adapts to training vs rest days and never crashes
// on missing data (every input is optional with sane fallbacks).
//
// Weights (total 100):
//   Fuel 25  (protein 15, calories 5, water 5)
//   Training/Movement 20  (workout 15, steps/cardio/mobility 5)
//   Recovery 20  (sleep 10, check-in 5, soreness/stress managed 5)
//   Habits/Discipline 10
//   Mindset/Journal 10
//   Supplements 5
//   Presence 5
//   Career 5
//
// Anti-cheat caps:
//   protein not hit        → max 85
//   sleep minimum not hit  → max 85
//   no training/movement   → max 80
//   no fuel logged         → max 75

export interface LifestyleInputs {
  // Fuel
  proteinTargetHit?: boolean;
  caloriesTargetHit?: boolean;
  waterTargetHit?: boolean;
  fuelLogged?: boolean; // any fuel data entered today

  // Training / movement
  workoutCompleted?: boolean;
  isRestDay?: boolean; // if true, rest-day compliance replaces workout
  restDayCompliant?: boolean; // rested intentionally (no missed session)
  movementDone?: boolean; // steps / cardio / mobility

  // Recovery
  sleepHours?: number | null;
  sleepTarget?: number; // default 7
  checkinCompleted?: boolean;
  sorenessStressManaged?: boolean;

  // Discipline / mind
  habitsDone?: boolean;
  mindsetDone?: boolean;

  // Stack
  supplementsLogged?: boolean;

  // Protocol nudges
  presenceDone?: boolean;
  careerDone?: boolean;
}

export interface PillarResult {
  key: string;
  label: string;
  earned: number;
  max: number;
  complete: boolean;
}

export interface LifestyleScore {
  score: number;
  label: string;
  color: string;
  feedback: string;
  pillars: PillarResult[];
  caps: string[]; // any caps that were applied
}

const SLEEP_DEFAULT_TARGET = 7;

export function lifestyleLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Elite Day", color: "#C7F23E" };
  if (score >= 75) return { label: "Strong Day", color: "#36D399" };
  if (score >= 60) return { label: "Decent", color: "#9BCBF2" };
  if (score >= 40) return { label: "Salvage Day", color: "#F5B83D" };
  return { label: "Off Track", color: "#F2555A" };
}

export function computeLifestyleScore(inp: LifestyleInputs): LifestyleScore {
  const pillars: PillarResult[] = [];
  const add = (key: string, label: string, earned: number, max: number) => {
    pillars.push({ key, label, earned, max, complete: earned >= max - 0.001 });
  };

  // ── Fuel (25) ──
  const proteinEarned = inp.proteinTargetHit ? 15 : 0;
  const calEarned = inp.caloriesTargetHit ? 5 : 0;
  const waterEarned = inp.waterTargetHit ? 5 : 0;
  add("protein", "Protein", proteinEarned, 15);
  add("calories", "Calories", calEarned, 5);
  add("water", "Water", waterEarned, 5);

  // ── Training / Movement (20) ── rest-day adaptive
  let trainEarned = 0;
  if (inp.isRestDay) {
    // Rest day: compliance stands in for the workout portion.
    trainEarned += inp.restDayCompliant ?? true ? 15 : 0;
  } else {
    trainEarned += inp.workoutCompleted ? 15 : 0;
  }
  trainEarned += inp.movementDone ? 5 : 0;
  add(
    "training",
    inp.isRestDay ? "Rest + Movement" : "Training",
    trainEarned,
    20
  );

  // ── Recovery (20) ──
  const sleepTarget = inp.sleepTarget ?? SLEEP_DEFAULT_TARGET;
  const sleepHit = (inp.sleepHours ?? 0) >= sleepTarget;
  let recovery = 0;
  recovery += sleepHit ? 10 : 0;
  recovery += inp.checkinCompleted ? 5 : 0;
  recovery += inp.sorenessStressManaged ? 5 : 0;
  add("recovery", "Recovery", recovery, 20);

  // ── Discipline / Mind / Stack / Nudges ──
  add("habits", "Discipline", inp.habitsDone ? 10 : 0, 10);
  add("mindset", "Mindset", inp.mindsetDone ? 10 : 0, 10);
  add("supplements", "Stack", inp.supplementsLogged ? 5 : 0, 5);
  add("presence", "Presence", inp.presenceDone ? 5 : 0, 5);
  add("career", "Career", inp.careerDone ? 5 : 0, 5);

  let raw = pillars.reduce((s, p) => s + p.earned, 0);

  // ── Anti-cheat caps ──
  const caps: string[] = [];
  const anyTraining = inp.isRestDay
    ? (inp.restDayCompliant ?? true) || inp.movementDone
    : inp.workoutCompleted || inp.movementDone;

  let cap = 100;
  if (!inp.proteinTargetHit) {
    cap = Math.min(cap, 85);
    caps.push("Protein target not hit (cap 85)");
  }
  if (!sleepHit) {
    cap = Math.min(cap, 85);
    caps.push("Sleep minimum not hit (cap 85)");
  }
  if (!anyTraining) {
    cap = Math.min(cap, 80);
    caps.push("No training/movement (cap 80)");
  }
  if (!inp.fuelLogged) {
    cap = Math.min(cap, 75);
    caps.push("No fuel logged (cap 75)");
  }

  const score = Math.max(0, Math.min(Math.round(raw), cap));
  const { label, color } = lifestyleLabel(score);

  return {
    score,
    label,
    color,
    feedback: buildFeedback(inp, pillars, sleepHit, score),
    pillars,
    caps,
  };
}

// Short, AI-style one-liner summarizing the day's shape.
function buildFeedback(
  inp: LifestyleInputs,
  pillars: PillarResult[],
  sleepHit: boolean,
  score: number
): string {
  const bodyStrong =
    (inp.workoutCompleted || inp.isRestDay) && inp.proteinTargetHit;
  const recoveryWeak = !sleepHit || !inp.checkinCompleted;
  const fuelWeak = !inp.proteinTargetHit || !inp.fuelLogged;

  if (score >= 90) return "Elite execution. Everything's firing — protect the streak.";
  if (score === 0) return "Blank slate. Log one thing to get moving.";

  if (bodyStrong && recoveryWeak)
    return "Strong body day, recovery needs attention.";
  if (!bodyStrong && !recoveryWeak)
    return "Recovery's dialed — now go earn it in training and fuel.";
  if (fuelWeak && (inp.workoutCompleted || inp.isRestDay))
    return "Training's there, but fuel is leaking your gains. Hit protein.";
  if (score >= 75) return "Strong day. Close the last gaps for an elite finish.";
  if (score >= 60) return "Solid base. A couple more pillars and today turns strong.";
  if (score >= 40) return "Salvageable — pick two quick wins before bed.";
  return "Off track today. One action now beats a perfect plan tomorrow.";
}
