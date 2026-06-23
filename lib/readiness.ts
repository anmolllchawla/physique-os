// PhysiqueOS — Readiness from biometrics.
//
// A transparent readiness score (0–100) computed from Google Health's raw
// sensor data: HRV, resting heart rate, and sleep. The approach mirrors how
// established readiness scores work — compare today against the user's OWN
// rolling baseline, not absolute thresholds, because "good" HRV is personal.
//
// This is our algorithm on Google's sensor data — not Google's Readiness score
// (which the API doesn't expose). It's fully transparent and tunable.

import type { Biometrics } from "./db";

export interface ReadinessResult {
  score: number; // 0–100
  label: string;
  color: string;
  breakdown: { hrv: number; rhr: number; sleep: number }; // contribution each
  note: string;
  hasEnoughData: boolean;
}

// Weights: HRV is the strongest recovery signal, then sleep, then RHR.
const W_HRV = 45;
const W_SLEEP = 35;
const W_RHR = 20;

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// today = today's biometrics; history = prior ~14–30 days (excluding today).
export function computeReadiness(today: Biometrics, history: Biometrics[]): ReadinessResult {
  const hrvHist = history.map((b) => b.hrv_ms).filter((v): v is number => v != null && v > 0);
  const rhrHist = history.map((b) => b.resting_hr).filter((v): v is number => v != null && v > 0);
  const sleepHist = history
    .map((b) => b.sleep_minutes)
    .filter((v): v is number => v != null && v > 0);

  const hrvBase = mean(hrvHist);
  const rhrBase = mean(rhrHist);
  const sleepBase = sleepHist.length ? mean(sleepHist) : 450; // fallback 7.5h

  // ── HRV: higher than baseline = better recovery. Ratio mapped to 0..1. ──
  let hrvScore = 0.6; // neutral default if no data
  if (today.hrv_ms != null && hrvBase > 0) {
    const ratio = today.hrv_ms / hrvBase; // 1.0 = at baseline
    // 0.7x → ~0, 1.0x → 0.7, 1.2x+ → 1.0
    hrvScore = clamp((ratio - 0.7) / 0.5, 0, 1);
  }

  // ── RHR: lower than baseline = better. Inverted. ──
  let rhrScore = 0.6;
  if (today.resting_hr != null && rhrBase > 0) {
    const delta = today.resting_hr - rhrBase; // negative = good
    // -5bpm → 1.0, 0 → 0.7, +8bpm → ~0
    rhrScore = clamp(0.7 - delta / 12, 0, 1);
  }

  // ── Sleep: vs 7.5h ideal and personal baseline. ──
  let sleepScore = 0.5;
  if (today.sleep_minutes != null) {
    const ideal = Math.max(sleepBase, 420); // at least 7h target
    sleepScore = clamp(today.sleep_minutes / ideal, 0, 1);
  }

  const hrvPts = W_HRV * hrvScore;
  const sleepPts = W_SLEEP * sleepScore;
  const rhrPts = W_RHR * rhrScore;
  const score = Math.round(hrvPts + sleepPts + rhrPts);

  const hasEnoughData =
    (today.hrv_ms != null || today.resting_hr != null || today.sleep_minutes != null) &&
    history.length >= 3;

  const { label, color } = readinessBand(score);

  let note = "";
  if (!hasEnoughData) {
    note = "Building your baseline — readiness sharpens after a few days of data.";
  } else if (hrvScore < 0.4) {
    note = "HRV is below your baseline — your body may still be recovering.";
  } else if (sleepScore < 0.6) {
    note = "Short sleep is dragging readiness down.";
  } else if (score >= 80) {
    note = "Strong recovery signals — good day to push.";
  } else {
    note = "Moderate readiness — train, but listen to your body.";
  }

  return {
    score,
    label,
    color,
    breakdown: { hrv: Math.round(hrvPts), rhr: Math.round(rhrPts), sleep: Math.round(sleepPts) },
    note,
    hasEnoughData,
  };
}

export function readinessBand(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Primed", color: "#36D399" };
  if (score >= 60) return { label: "Ready", color: "#C7F23E" };
  if (score >= 40) return { label: "Moderate", color: "#F5B83D" };
  return { label: "Recover", color: "#F2555A" };
}
