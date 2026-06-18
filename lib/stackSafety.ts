// PhysiqueOS — Stack safety scoring.
//
// SAFETY-ONLY. This module detects, flags, and scores. It NEVER originates a
// dose, schedule, or titration for any compound. Local deterministic logic so
// the safety status always works without an API call.

import type { StackItem, StackLog, StackSafetyCheckIn } from "./db";

// ── Symptom catalog (checklist) ──
// Grouped by severity. RED_FLAGS trigger urgent guidance regardless of score.
export const RED_FLAG_SYMPTOMS = [
  "Chest pain",
  "Difficulty breathing",
  "Fainting / loss of consciousness",
  "Severe allergic reaction",
  "Severe confusion",
  "Persistent vomiting",
  "Vision changes",
  "Worsening injection-site infection",
] as const;

export const MODERATE_SYMPTOMS = [
  "Dizziness",
  "Shakiness",
  "Sweating",
  "Unusual hunger",
  "Weakness",
  "Persistent headache",
  "Numbness / tingling",
  "Nausea",
  "Severe anxiety",
  "Mood disruption",
  "Poor sleep after use",
  "Swelling",
  "Heart palpitations",
] as const;

export const MILD_SYMPTOMS = [
  "Mild headache",
  "Irritability",
  "Sedation / drowsiness",
  "Mild anxiety",
  "Skin redness",
  "Itching",
  "Skin irritation",
] as const;

export const INJECTION_SITE_ISSUES = [
  "Redness",
  "Swelling",
  "Pain",
  "Warmth",
  "Lump / nodule",
  "Discharge",
  "Spreading redness",
] as const;

export const PERCEIVED_BENEFITS = [
  "Better sleep",
  "Calmer / less anxious",
  "Improved focus",
  "More energy",
  "Better recovery",
  "Improved skin",
  "Better mood",
] as const;

export const ALL_CHECKLIST_SYMPTOMS = [
  ...RED_FLAG_SYMPTOMS,
  ...MODERATE_SYMPTOMS,
  ...MILD_SYMPTOMS,
];

const RED_SET = new Set<string>(RED_FLAG_SYMPTOMS.map((s) => s.toLowerCase()));
const MOD_SET = new Set<string>(MODERATE_SYMPTOMS.map((s) => s.toLowerCase()));
const SEVERE_INJECTION = new Set(["spreading redness", "discharge"]);

export type SafetyState = "Low" | "Watch" | "High";

export interface StackSafety {
  score: number;
  state: SafetyState;
  color: string;
  hasRedFlag: boolean;
  redFlags: string[];
  reasons: string[]; // human-readable deductions
  urgentMessage: string | null;
}

export function safetyState(score: number): { state: SafetyState; color: string } {
  if (score >= 85) return { state: "Low", color: "#36D399" };
  if (score >= 65) return { state: "Watch", color: "#F5B83D" };
  return { state: "High", color: "#F2555A" };
}

export interface SafetyInputs {
  items: StackItem[];
  recentLogs: StackLog[]; // last ~14 days
  recentCheckIns: StackSafetyCheckIn[]; // last ~14 days
  todayISO: string;
}

// Deterministic safety score. Starts at 100; deducts for risk signals.
export function computeStackSafety(inp: SafetyInputs): StackSafety {
  const reasons: string[] = [];
  const redFlags: string[] = [];
  let score = 100;

  const collectSymptoms = (arr?: string[]) => (arr ?? []).map((s) => s.toLowerCase());

  // Gather symptoms across recent logs + check-ins.
  const allSymptoms: string[] = [];
  for (const l of inp.recentLogs) allSymptoms.push(...collectSymptoms(l.symptoms));
  for (const c of inp.recentCheckIns) allSymptoms.push(...collectSymptoms(c.symptoms));

  // Red flags.
  for (const s of allSymptoms) {
    if (RED_SET.has(s)) {
      const label = RED_FLAG_SYMPTOMS.find((r) => r.toLowerCase() === s)!;
      if (!redFlags.includes(label)) redFlags.push(label);
    }
  }
  // Injection-site severe issues are red flags too.
  for (const c of inp.recentCheckIns) {
    for (const iss of c.injectionSiteIssues ?? []) {
      if (SEVERE_INJECTION.has(iss.toLowerCase())) {
        const label = `Injection site: ${iss}`;
        if (!redFlags.includes(label)) redFlags.push(label);
      }
    }
  }

  if (redFlags.length > 0) {
    score = Math.min(score, 40);
    reasons.push("Red-flag symptom logged");
  }

  // Moderate symptoms.
  const moderateHits = allSymptoms.filter((s) => MOD_SET.has(s));
  if (moderateHits.length > 0) {
    score -= Math.min(30, moderateHits.length * 8);
    reasons.push(`${moderateHits.length} concerning symptom(s) logged`);
  }

  // Injection-site issues (non-severe).
  const injIssues = inp.recentCheckIns.flatMap((c) => c.injectionSiteIssues ?? []);
  const nonSevereInj = injIssues.filter((i) => !SEVERE_INJECTION.has(i.toLowerCase()));
  if (nonSevereInj.length > 0) {
    score -= Math.min(15, nonSevereInj.length * 5);
    reasons.push("Injection-site issues reported");
  }

  // Multiple new items started close together (within ~10 days).
  const recentlyAdded = inp.items.filter((it) => {
    const added = new Date(it.createdAt).getTime();
    return Date.now() - added < 10 * 86400000;
  });
  if (recentlyAdded.length >= 2) {
    score -= 12;
    reasons.push("Multiple new compounds started close together");
  }

  // Missing safety check-ins (none in the last 7 days while items are active).
  const hasActive = inp.items.some((it) => it.active);
  const recentCheckin = inp.recentCheckIns.some((c) => {
    const d = new Date(c.date + "T00:00:00").getTime();
    return Date.now() - d < 7 * 86400000;
  });
  if (hasActive && !recentCheckin) {
    score -= 10;
    reasons.push("No safety check-in in the last 7 days");
  }

  // Sudden user-entered dose change (same item, dose text changed between
  // recent logs). We only DETECT a change — we never judge or suggest a value.
  const byItem = new Map<string, string[]>();
  for (const l of inp.recentLogs) {
    if (!l.doseText) continue;
    const arr = byItem.get(l.stackItemId) ?? [];
    arr.push(l.doseText.trim());
    byItem.set(l.stackItemId, arr);
  }
  let doseChanged = false;
  for (const doses of byItem.values()) {
    if (new Set(doses).size > 1) doseChanged = true;
  }
  if (doseChanged) {
    score -= 8;
    reasons.push("User-entered dose changed recently");
  }

  // Poor sleep after use signal from check-ins.
  const poorSleep = inp.recentCheckIns.some((c) => (c.sleepQuality ?? 5) <= 2);
  if (poorSleep) {
    score -= 6;
    reasons.push("Poor sleep reported");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const { state, color } = safetyState(score);

  const urgentMessage =
    redFlags.length > 0
      ? "Urgent: you logged a serious symptom. Do not take more. Seek medical care now — call your local emergency number or go to urgent care."
      : null;

  return { score, state, color, hasRedFlag: redFlags.length > 0, redFlags, reasons, urgentMessage };
}

// ── Per-compound monitoring guidance (NON-dosing) ──
// Returns what to watch for. Never a dose. Used to surface relevant symptom
// prompts for known compounds.
export function compoundMonitoring(name: string): { watch: string[]; note: string } | null {
  const n = name.toLowerCase();
  if (n.includes("igf")) {
    return {
      watch: ["Dizziness", "Shakiness", "Sweating", "Confusion", "Unusual hunger", "Weakness", "Swelling", "Numbness / tingling", "Persistent headache", "Nausea"],
      note: "Watch for hypoglycemia-like symptoms. If any appear, pause and seek medical advice. This app never suggests dose changes.",
    };
  }
  if (n.includes("selank")) {
    return {
      watch: ["Severe anxiety", "Mood disruption", "Irritability", "Sedation / drowsiness", "Mild headache", "Poor sleep after use"],
      note: "Track anxiety, mood, focus, and sleep. This app never suggests dose changes.",
    };
  }
  if (n.includes("ghk")) {
    return {
      watch: ["Skin redness", "Itching", "Skin irritation", "Swelling"],
      note: "Topical or injectable. Track skin and (if injectable) injection-site reactions. This app never suggests dose changes.",
    };
  }
  return null;
}

// Default seed items.
export const DEFAULT_STACK_ITEMS: { name: string; category: StackItemCategory; route: StackItemRoute }[] = [
  { name: "IGF-1 LR3", category: "peptide", route: "injectable" },
  { name: "Selank", category: "peptide", route: "nasal" },
  { name: "GHK-Cu", category: "peptide", route: "topical" },
  { name: "Creatine", category: "supplement", route: "oral" },
  { name: "Magnesium", category: "supplement", route: "oral" },
  { name: "Omega-3", category: "supplement", route: "oral" },
  { name: "Zinc", category: "supplement", route: "oral" },
  { name: "B12", category: "supplement", route: "oral" },
];

type StackItemCategory = StackItem["category"];
type StackItemRoute = StackItem["route"];

// Common lab markers (user can add custom).
export const DEFAULT_LAB_MARKERS = [
  "Fasting glucose",
  "HbA1c",
  "Fasting insulin",
  "IGF-1",
  "CBC",
  "CMP (liver/kidney)",
  "Lipids",
  "Blood pressure",
  "Resting heart rate",
];
