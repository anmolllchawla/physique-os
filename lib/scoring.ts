// PhysiqueOS Web — Readiness Score Calculator

export interface CheckInMetrics {
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number;
  stress: number;
  motivation: number;
  soreness: number | null;
  appetite: number | null;
}

export function calculateReadinessScore(m: CheckInMetrics): number {
  let score = 0;
  let maxScore = 0;

  if (m.sleep_hours != null) {
    score += Math.min(m.sleep_hours / 8, 1) * 20;
    maxScore += 20;
  }
  if (m.sleep_quality != null) {
    score += (m.sleep_quality / 5) * 15;
    maxScore += 15;
  }

  score += (m.energy / 5) * 20;
  maxScore += 20;
  score += (m.motivation / 5) * 15;
  maxScore += 15;

  if (m.soreness != null) {
    score += ((5 - m.soreness) / 4) * 15;
    maxScore += 15;
  }

  score += ((5 - m.stress) / 4) * 15;
  maxScore += 15;

  const normalized = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return Math.round(normalized * 10) / 10;
}

export function readinessLabel(
  score: number
): { label: string; color: string } {
  if (score >= 85) return { label: "Peak", color: "#36D399" };
  if (score >= 70) return { label: "Ready", color: "#C7F23E" };
  if (score >= 50) return { label: "Moderate", color: "#F5B83D" };
  if (score >= 30) return { label: "Fatigued", color: "#F97316" };
  return { label: "Rest Day", color: "#F2555A" };
}
