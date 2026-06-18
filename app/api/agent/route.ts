// PhysiqueOS — AI Coach API (server-side only)
//
// The DeepSeek API key lives ONLY in the server environment (.env.local /
// Vercel env vars) and is never sent to the browser. The frontend posts the
// user's message plus an optional local data summary to this route; the route
// calls DeepSeek and returns the assistant text.
//
// Env:
//   DEEPSEEK_API_KEY   required to enable the coach
//   DEEPSEEK_MODEL     optional, defaults to "deepseek-chat"
//   DEEPSEEK_BASE_URL  optional, defaults to "https://api.deepseek.com"

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the coaching assistant inside PhysiqueOS, a personal training and habit-tracking app. You help one user understand their own training, bodyweight, readiness check-ins, and habits.

Your roles:
- Gym progression coach: read the user's recent training data and give specific, actionable progression and programming feedback.
- Habit coach: help with consistency, adherence, and routine.
- Weekly review assistant: interpret weekly stats and highlight what matters.
- Decision helper: help the user weigh options about their training and routine.

Hard safety rules — never break these:
- Do NOT give medical advice, diagnoses, or interpret symptoms.
- Do NOT recommend, calculate, or suggest doses for any supplement, peptide, medication, or drug. If asked, decline and say the app is for tracking only.
- Do NOT give peptide or PED protocols or dosing of any kind.
- Take a harm-reduction, tracking-only stance: you can discuss what the user has logged, but you do not advise what to take or how much.
- For any health concern, symptom, injury, or medication question, tell the user to consult a qualified medical professional.

Style:
- Be concise and direct. Lead with the most useful point.
- Ground advice in the data summary provided. If a stat isn't in the data, say you don't have it rather than inventing numbers.
- Encourage sustainable, evidence-based training. Avoid hype.
- It's fine to be warm and motivating, but never pushy about intensity at the cost of health.`;

const PLAN_PROMPT = `You are the workout generator inside PhysiqueOS. The user wants a single workout session built for them. Use any provided data summary (readiness, recent training, bodyweight) to tailor it — e.g. lighter or fewer sets if readiness is low.

Respond with ONLY a JSON object, no prose, no markdown fences. Schema:
{
  "name": "string — short session name, e.g. 'Push Day' or 'Full Body A'",
  "category": "push" | "pull" | "legs" | "full_body" | "custom",
  "exercises": [
    {
      "name": "string — exercise name; prefer names from the user's library when suitable",
      "category": "push" | "pull" | "legs" | "core" | "cardio" | "other",
      "target_sets": number (1-6),
      "target_reps": "string range, e.g. '8-12'",
      "rest_seconds": number (30-300),
      "rpe_target": number (6-9),
      "notes": "string or null"
    }
  ],
  "rationale": "string — one or two sentences on why this fits today"
}

Rules:
- 4 to 8 exercises for a normal session.
- Balanced, sensible programming. Compound movements first.
- No medical, dosing, or injury-rehab prescriptions. If the user mentions pain or injury, set rationale to advise seeing a professional and keep the plan gentle/general.
- Output valid JSON only. No text before or after.`;

const PROTOCOL_PROMPT = `You are the daily protocol generator inside PhysiqueOS, a lifestyle operating system. Build the user's plan for TODAY using the provided data summary (readiness, recent training, fuel/protein, supplements). If readiness is low, scale back training and prioritize recovery.

Respond with ONLY a JSON object, no prose, no markdown fences. Schema:
{
  "summary": "string — one or two sentences framing today",
  "tasks": [
    {
      "pillar": "training" | "fuel" | "water" | "recovery" | "supplements" | "mindset" | "presence" | "career",
      "title": "string — short imperative task",
      "description": "string — optional one-line detail"
    }
  ]
}

Rules:
- Include one task per relevant pillar (6-9 tasks total). Always include training (or active recovery), fuel/protein, water, recovery, mindset.
- Add ONE lightweight "presence" task (grooming, skincare, outfit/fragrance, posture, dating-photo, or a social-confidence rep) and ONE "career" task (sales follow-up, job outreach, high-income skill, money/admin, or communication rep). Each 5-20 min, concrete.
- No medical or dosing advice. For supplements just say "take your stack", never doses.
- Output valid JSON only.`;

// Extremely small in-memory rate guard. Per serverless instance, best-effort.
// Not a security boundary — just stops accidental rapid-fire loops.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits: number[] = [];

function rateLimited(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0] > WINDOW_MS) hits.shift();
  if (hits.length >= MAX_PER_WINDOW) return true;
  hits.push(now);
  return false;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function GET() {
  // Lets the frontend show whether the coach is configured.
  return NextResponse.json({ configured: !!process.env.DEEPSEEK_API_KEY });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The AI coach isn't set up. Add DEEPSEEK_API_KEY to your environment to enable it.",
      },
      { status: 503 }
    );
  }

  if (rateLimited()) {
    return NextResponse.json(
      { error: "Too many requests in a short time. Give it a minute and try again." },
      { status: 429 }
    );
  }

  let body: {
    message?: string;
    history?: ChatMessage[];
    context?: unknown;
    intent?: "chat" | "plan" | "protocol";
    exercise_library?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = (body.message ?? "").toString().trim();
  if (!message) {
    return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const isPlan = body.intent === "plan";
  const isProtocol = body.intent === "protocol";
  const wantsJson = isPlan || isProtocol;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  // Build the message list. Context (if the user opted in) is injected as a
  // system message so the model treats it as ground-truth data, not user text.
  const messages: { role: string; content: string }[] = [
    { role: "system", content: isProtocol ? PROTOCOL_PROMPT : isPlan ? PLAN_PROMPT : SYSTEM_PROMPT },
  ];

  // In plan mode, give the model the user's existing exercise library so it
  // prefers names that already exist (those map directly; anything new becomes
  // a custom exercise on save).
  if (isPlan && Array.isArray(body.exercise_library) && body.exercise_library.length) {
    messages.push({
      role: "system",
      content:
        "The user's existing exercise library (prefer these exact names where suitable):\n" +
        body.exercise_library.slice(0, 200).join(", "),
    });
  }

  if (body.context) {
    messages.push({
      role: "system",
      content:
        "Here is a summary of the user's recent PhysiqueOS data (JSON). Use it to ground your answer. Weights are in pounds unless noted.\n\n" +
        JSON.stringify(body.context),
    });
  }

  // Keep only the last ~10 turns of history to bound token use.
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  for (const m of history) {
    if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  }
  messages.push({ role: "user", content: message });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: wantsJson ? 0.4 : 0.6,
        max_tokens: wantsJson ? 1200 : 900,
        stream: false,
        ...(wantsJson ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("DeepSeek error:", res.status, text);
      const msg =
        res.status === 401
          ? "The coach's API key was rejected. Check DEEPSEEK_API_KEY."
          : res.status === 402
            ? "The coach's account is out of credit."
            : "The coach is temporarily unavailable. Try again shortly.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await res.json();
    const reply: string =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I didn't get a usable response. Try rephrasing.";

    return NextResponse.json({ reply });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("Agent route failure:", e);
    return NextResponse.json(
      {
        error: aborted
          ? "The coach took too long to respond. Try again."
          : "Something went wrong reaching the coach.",
      },
      { status: 502 }
    );
  }
}
