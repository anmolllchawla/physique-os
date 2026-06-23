// PhysiqueOS Web — IndexedDB via Dexie.js
import Dexie, { type Table } from "dexie";

export interface Exercise {
  id: string;
  name: string;
  category: "push" | "pull" | "legs" | "core" | "cardio" | "other";
  primary_muscle: string | null;
  equipment: string | null;
  is_default: boolean;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  category: "push" | "pull" | "legs" | "full_body" | "custom";
  is_active: boolean;
  created_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
  rpe_target: number;
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  template_id: string | null;
  name: string;
  category: string;
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  notes: string | null;
}

export interface ExerciseLog {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  created_at: string;
}

export interface DailyCheckIn {
  id: string;
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number;
  stress: number;
  motivation: number;
  soreness: number | null;
  appetite: number | null;
  readiness_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface BodyweightLog {
  id: string;
  date: string;
  weight_lbs: number;
  source: string;
  created_at: string;
}

// Body measurements — circumferences stored in inches (canonical).
export interface MeasurementLog {
  id: string;
  date: string;
  neck_in: number | null;
  shoulders_in: number | null;
  chest_in: number | null;
  waist_in: number | null;
  hips_in: number | null;
  left_arm_in: number | null;
  right_arm_in: number | null;
  left_thigh_in: number | null;
  right_thigh_in: number | null;
  left_calf_in: number | null;
  right_calf_in: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

// Progress photos — image stored as a base64 data URL inside IndexedDB.
export interface ProgressPhoto {
  id: string;
  date: string;
  pose: "front" | "side" | "back" | "other";
  data_url: string;
  weight_lbs: number | null;
  notes: string | null;
  created_at: string;
}

// A tracked supplement, peptide, or medication. Manual tracking only — the app
// stores what the user enters and never recommends dosing.
export interface Supplement {
  id: string;
  name: string;
  category: "supplement" | "peptide" | "medication" | "other";
  dose: string | null; // free text exactly as the user enters it, e.g. "5mg"
  schedule: string | null; // free text, e.g. "Daily AM", "Mon/Wed/Fri"
  notes: string | null;
  start_date: string | null;
  end_date: string | null; // null = ongoing
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// One adherence record: did the user take a given supplement on a given date.
export interface SupplementLog {
  id: string;
  supplement_id: string;
  date: string;
  taken: boolean;
  notes: string | null;
  created_at: string;
}

// Daily fuel/nutrition log — one record per day (date-keyed).
export interface FuelLog {
  id: string;
  date: string;
  protein_target_g: number;
  protein_g: number;
  calories_target: number;
  calories: number;
  water_target_ml: number;
  water_ml: number;
  notes: string | null;
  created_at: string;
}

export type ProtocolPillar =
  | "training"
  | "fuel"
  | "water"
  | "recovery"
  | "supplements"
  | "mindset"
  | "presence"
  | "career";

export interface ProtocolTask {
  id: string;
  pillar: ProtocolPillar;
  title: string;
  description?: string;
  completed: boolean;
}

// A generated daily protocol — one per day (date-keyed).
export interface DailyProtocol {
  id: string;
  date: string;
  source: "ai" | "local";
  summary: string | null;
  tasks: ProtocolTask[];
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

// ── Google Health biometrics (one row per day) ──
// Pulled from the Google Health API. Raw sensor values; readiness is computed
// locally from these (see lib/readiness.ts).
export interface Biometrics {
  date: string; // YYYY-MM-DD, primary key
  hrv_ms: number | null; // daily HRV (RMSSD-style), ms
  resting_hr: number | null; // bpm
  sleep_minutes: number | null; // total sleep
  sleep_deep_minutes: number | null;
  sleep_rem_minutes: number | null;
  spo2_pct: number | null;
  respiratory_rate: number | null;
  steps: number | null;
  calories_out: number | null; // total calories burned
  active_minutes: number | null;
  readiness: number | null; // locally computed 0–100
  source: string; // "google_health"
  synced_at: string;
}

// ── Stack Monitor (supplements/peptides safety tracking) ──
// Safety/monitoring only. The app stores user-entered dose text verbatim and
// never originates doses, schedules, or titration for any compound.

export type StackCategory = "peptide" | "supplement" | "medication" | "skincare" | "other";
export type StackRoute = "oral" | "nasal" | "topical" | "injectable" | "other";

export interface StackItem {
  id: string;
  name: string;
  category: StackCategory;
  route: StackRoute;
  active: boolean;
  userEnteredPlan?: string; // user/clinician plan text — never AI-generated
  notes?: string;
  createdAt: string;
}

export interface StackLog {
  id: string;
  stackItemId: string;
  date: string;
  time?: string;
  doseText?: string; // user-entered ONLY
  taken: boolean;
  symptoms?: string[];
  perceivedBenefits?: string[];
  notes?: string;
}

export interface StackSafetyCheckIn {
  id: string;
  date: string;
  symptoms: string[];
  injectionSiteIssues?: string[];
  mood?: number;
  anxiety?: number;
  sleepQuality?: number;
  appetite?: number;
  energy?: number;
  notes?: string;
}

export interface LabMarker {
  id: string;
  name: string;
  value: string;
  unit?: string;
  date: string;
  notes?: string;
}

export class PhysiqueDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  templateExercises!: Table<TemplateExercise, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  exerciseLogs!: Table<ExerciseLog, string>;
  dailyCheckins!: Table<DailyCheckIn, string>;
  bodyweightLogs!: Table<BodyweightLog, string>;
  measurements!: Table<MeasurementLog, string>;
  progressPhotos!: Table<ProgressPhoto, string>;
  supplements!: Table<Supplement, string>;
  supplementLogs!: Table<SupplementLog, string>;
  fuelLogs!: Table<FuelLog, string>;
  dailyProtocols!: Table<DailyProtocol, string>;
  stackItems!: Table<StackItem, string>;
  stackLogs!: Table<StackLog, string>;
  stackCheckIns!: Table<StackSafetyCheckIn, string>;
  labMarkers!: Table<LabMarker, string>;
  biometrics!: Table<Biometrics, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super("physiqueos");

    // v1 — original schema.
    this.version(1).stores({
      exercises: "id, category",
      workoutTemplates: "id, is_active",
      templateExercises: "id, template_id, [template_id+sort_order]",
      workoutSessions: "id, started_at",
      exerciseLogs: "id, session_id, [session_id+created_at]",
      dailyCheckins: "id, date",
      bodyweightLogs: "id, date",
    });

    // v2 — unique date indexes (one record per day), new tables, settings.
    // The upgrade collapses any pre-existing duplicate-per-day rows, keeping
    // the most recently created entry for each date.
    this.version(2)
      .stores({
        exercises: "id, category",
        workoutTemplates: "id, is_active",
        templateExercises: "id, template_id, [template_id+sort_order]",
        workoutSessions: "id, started_at, completed_at",
        exerciseLogs: "id, session_id, exercise_id, [session_id+created_at]",
        dailyCheckins: "id, &date",
        bodyweightLogs: "id, &date",
        measurements: "id, &date",
        progressPhotos: "id, date, pose",
        settings: "key",
      })
      .upgrade(async (tx) => {
        await dedupeByDate(tx.table("dailyCheckins"));
        await dedupeByDate(tx.table("bodyweightLogs"));
      });

    // v3 — supplement / peptide tracker (manual tracking only).
    this.version(3).stores({
      exercises: "id, category",
      workoutTemplates: "id, is_active",
      templateExercises: "id, template_id, [template_id+sort_order]",
      workoutSessions: "id, started_at, completed_at",
      exerciseLogs: "id, session_id, exercise_id, [session_id+created_at]",
      dailyCheckins: "id, &date",
      bodyweightLogs: "id, &date",
      measurements: "id, &date",
      progressPhotos: "id, date, pose",
      supplements: "id, is_active, sort_order",
      supplementLogs: "id, supplement_id, date, [supplement_id+date]",
      settings: "key",
    });

    // v4 — Fuel/nutrition logs + daily protocols (lifestyle OS upgrade).
    this.version(4).stores({
      exercises: "id, category",
      workoutTemplates: "id, is_active",
      templateExercises: "id, template_id, [template_id+sort_order]",
      workoutSessions: "id, started_at, completed_at",
      exerciseLogs: "id, session_id, exercise_id, [session_id+created_at]",
      dailyCheckins: "id, &date",
      bodyweightLogs: "id, &date",
      measurements: "id, &date",
      progressPhotos: "id, date, pose",
      supplements: "id, is_active, sort_order",
      supplementLogs: "id, supplement_id, date, [supplement_id+date]",
      fuelLogs: "id, &date",
      dailyProtocols: "id, &date",
      settings: "key",
    });

    // v5 — Stack Monitor: supplements/peptides safety tracking + labs.
    this.version(5).stores({
      exercises: "id, category",
      workoutTemplates: "id, is_active",
      templateExercises: "id, template_id, [template_id+sort_order]",
      workoutSessions: "id, started_at, completed_at",
      exerciseLogs: "id, session_id, exercise_id, [session_id+created_at]",
      dailyCheckins: "id, &date",
      bodyweightLogs: "id, &date",
      measurements: "id, &date",
      progressPhotos: "id, date, pose",
      supplements: "id, is_active, sort_order",
      supplementLogs: "id, supplement_id, date, [supplement_id+date]",
      fuelLogs: "id, &date",
      dailyProtocols: "id, &date",
      stackItems: "id, active, category",
      stackLogs: "id, stackItemId, date, [stackItemId+date]",
      stackCheckIns: "id, &date",
      labMarkers: "id, name, date",
      settings: "key",
    });

    // v6 — Google Health biometrics (daily HRV/RHR/sleep/steps + readiness).
    this.version(6).stores({
      exercises: "id, category",
      workoutTemplates: "id, is_active",
      templateExercises: "id, template_id, [template_id+sort_order]",
      workoutSessions: "id, started_at, completed_at",
      exerciseLogs: "id, session_id, exercise_id, [session_id+created_at]",
      dailyCheckins: "id, &date",
      bodyweightLogs: "id, &date",
      measurements: "id, &date",
      progressPhotos: "id, date, pose",
      supplements: "id, is_active, sort_order",
      supplementLogs: "id, supplement_id, date, [supplement_id+date]",
      fuelLogs: "id, &date",
      dailyProtocols: "id, &date",
      stackItems: "id, active, category",
      stackLogs: "id, stackItemId, date, [stackItemId+date]",
      stackCheckIns: "id, &date",
      labMarkers: "id, name, date",
      biometrics: "&date, synced_at",
      settings: "key",
    });
  }
}

async function dedupeByDate(table: Table<{ id: string; date: string; created_at: string }, string>) {
  const all = await table.toArray();
  const byDate = new Map<string, { id: string; date: string; created_at: string }>();
  for (const row of all) {
    const existing = byDate.get(row.date);
    if (!existing || row.created_at > existing.created_at) {
      byDate.set(row.date, row);
    }
  }
  const keepIds = new Set([...byDate.values()].map((r) => r.id));
  const toDelete = all.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
  if (toDelete.length) await table.bulkDelete(toDelete);
}

export const db = new PhysiqueDB();
