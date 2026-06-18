// PhysiqueOS — Daily Protocol generator.
//
// Produces a structured DailyProtocol. Works fully offline with a deterministic
// local generator built from the user's data (readiness, recent training, fuel,
// supplements). When DeepSeek is configured, the coach can produce a smarter
// version, but the local generator guarantees a useful result with no API key.

import { db, type DailyProtocol, type ProtocolTask, type ProtocolPillar } from "./db";
import { generateId, todayISO } from "./utils";
import { buildContextSummary } from "./agent";

// Rotating lightweight nudges — deterministic by day so they feel intentional.
const CAREER_ACTIONS = [
  "Send one sales or networking follow-up message.",
  "Apply to or reach out about one role/opportunity.",
  "Spend 15 min learning a high-income skill.",
  "Study one insurance/collision/cyber sales concept.",
  "Clear one money or admin task you've been avoiding.",
  "Practice a 5-min confident communication rep (pitch, call, voice note).",
];

const PRESENCE_ACTIONS = [
  "Groom: trim/shape and tidy up — 10 min.",
  "Run your skincare routine, morning and night.",
  "Plan an outfit + fragrance for tomorrow.",
  "Do 10 min of posture / body-language drills.",
  "Improve one dating-app photo or your bio.",
  "Take one small social-confidence action today.",
];

function dayIndex(date: string): number {
  // Stable rotation based on the date string.
  const d = new Date(date + "T00:00:00");
  return Math.floor(d.getTime() / 86400000);
}

function task(
  pillar: ProtocolPillar,
  title: string,
  description?: string
): ProtocolTask {
  return { id: generateId(), pillar, title, description, completed: false };
}

export interface ProtocolContext {
  readiness: number | null;
  isRestDay: boolean;
  proteinTarget: number;
  proteinSoFar: number;
  waterTarget: number;
  hasActiveSupplements: boolean;
  nextWorkoutName: string | null;
}

// Gather just what the protocol needs from the DB.
export async function gatherProtocolContext(date = todayISO()): Promise<ProtocolContext> {
  const [checkin, fuel, supps, templates, sessions] = await Promise.all([
    db.dailyCheckins.where("date").equals(date).first(),
    db.fuelLogs.where("date").equals(date).first(),
    db.supplements.filter((s) => s.is_active).toArray(),
    db.workoutTemplates.filter((t) => t.is_active).toArray(),
    db.workoutSessions.toArray(),
  ]);

  // Rest day heuristic: trained in the last ~24h with a completed session.
  const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const trainedRecently = sessions.some(
    (s) => s.completed_at && s.started_at.slice(0, 10) >= yday
  );

  return {
    readiness: checkin?.readiness_score ?? null,
    isRestDay: trainedRecently && (checkin?.readiness_score ?? 100) < 50,
    proteinTarget: fuel?.protein_target_g ?? 160,
    proteinSoFar: fuel?.protein_g ?? 0,
    waterTarget: fuel?.water_target_ml ?? 3000,
    hasActiveSupplements: supps.length > 0,
    nextWorkoutName: templates[0]?.name ?? null,
  };
}

// Deterministic local protocol — always works, no network.
export function generateLocalProtocol(ctx: ProtocolContext, date = todayISO()): DailyProtocol {
  const tasks: ProtocolTask[] = [];
  const lowReadiness = ctx.readiness != null && ctx.readiness < 50;

  // Training
  if (ctx.isRestDay || lowReadiness) {
    tasks.push(
      task("training", "Active recovery", "Easy walk + 10 min mobility. Keep it light today.")
    );
  } else {
    tasks.push(
      task(
        "training",
        ctx.nextWorkoutName ? `Train: ${ctx.nextWorkoutName}` : "Train",
        lowReadiness ? "Auto-regulate — drop a set if needed." : "Hit your planned session with intent."
      )
    );
  }

  // Fuel
  const remaining = Math.max(0, ctx.proteinTarget - ctx.proteinSoFar);
  tasks.push(
    task(
      "fuel",
      `Hit ${ctx.proteinTarget}g protein`,
      remaining > 0 ? `${remaining}g to go — spread across meals.` : "Target met — maintain."
    )
  );
  tasks.push(task("water", `Drink ${ctx.waterTarget}ml water`, "Keep a bottle in sight."));

  // Recovery
  tasks.push(
    task(
      "recovery",
      lowReadiness ? "Prioritize sleep tonight" : "Protect 7+ hours sleep",
      lowReadiness ? "Readiness is low — bank recovery." : "Wind down screen-free 30 min before bed."
    )
  );

  // Supplements
  if (ctx.hasActiveSupplements) {
    tasks.push(task("supplements", "Take your stack", "Log it in Supplements."));
  }

  // Mindset
  tasks.push(task("mindset", "2-min mindset rep", "Write one line: what matters most today."));

  // Presence + Career (rotating, lightweight)
  const i = dayIndex(date);
  tasks.push(task("presence", PRESENCE_ACTIONS[i % PRESENCE_ACTIONS.length]));
  tasks.push(task("career", CAREER_ACTIONS[i % CAREER_ACTIONS.length]));

  const summary = lowReadiness
    ? "Readiness is low — recover hard, keep the basics, don't force it."
    : ctx.isRestDay
      ? "Rest day. Move easy, eat well, set up tomorrow."
      : "Full send day. Train, fuel, recover, and take one step on looks and income.";

  return {
    id: generateId(),
    date,
    source: "local",
    summary,
    tasks,
    created_at: new Date().toISOString(),
  };
}

// Try the AI coach for a protocol; fall back to local on any failure.
export async function generateProtocol(date = todayISO()): Promise<DailyProtocol> {
  const ctx = await gatherProtocolContext(date);
  const local = generateLocalProtocol(ctx, date);

  try {
    const summary = await buildContextSummary();
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "protocol",
        message: "Generate today's protocol.",
        context: summary,
      }),
    });
    if (!res.ok) return local;
    const data = await res.json();
    const parsed = parseProtocolReply(data.reply, date);
    return parsed ?? local;
  } catch {
    return local;
  }
}

// Parse an AI protocol reply (JSON) into a DailyProtocol; null if unusable.
function parseProtocolReply(raw: string, date: string): DailyProtocol | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    const obj = JSON.parse(text.slice(first, last + 1));
    if (!Array.isArray(obj.tasks)) return null;
    const valid: ProtocolPillar[] = [
      "training", "fuel", "water", "recovery", "supplements", "mindset", "presence", "career",
    ];
    const tasks: ProtocolTask[] = obj.tasks
      .filter((t: { pillar?: string; title?: string }) => t && valid.includes(t.pillar as ProtocolPillar) && typeof t.title === "string")
      .slice(0, 12)
      .map((t: { pillar: ProtocolPillar; title: string; description?: string }) => ({
        id: generateId(),
        pillar: t.pillar,
        title: String(t.title).slice(0, 120),
        description: typeof t.description === "string" ? t.description.slice(0, 240) : undefined,
        completed: false,
      }));
    if (tasks.length === 0) return null;
    return {
      id: generateId(),
      date,
      source: "ai",
      summary: typeof obj.summary === "string" ? obj.summary.slice(0, 300) : null,
      tasks,
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Persistence (date-keyed, one protocol per day) ──
export async function saveProtocol(protocol: DailyProtocol): Promise<void> {
  const existing = await db.dailyProtocols.where("date").equals(protocol.date).first();
  if (existing) {
    await db.dailyProtocols.update(existing.id, {
      source: protocol.source,
      summary: protocol.summary,
      tasks: protocol.tasks,
    });
  } else {
    await db.dailyProtocols.add(protocol);
  }
}

export async function toggleProtocolTask(date: string, taskId: string): Promise<void> {
  const p = await db.dailyProtocols.where("date").equals(date).first();
  if (!p) return;
  const tasks = p.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
  await db.dailyProtocols.update(p.id, { tasks });
}
