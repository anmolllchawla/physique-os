"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  buildContextSummary,
  parseWorkoutPlan,
  saveWorkoutPlanAsTemplate,
  type WorkoutPlan,
} from "@/lib/agent";
import { generateProtocol, saveProtocol } from "@/lib/protocol";
import type { DailyProtocol } from "@/lib/db";
import { PageHeader } from "@/components/Layout";
import {
  Sparkles, Send, Trash2, ShieldCheck, AlertTriangle, Database, Dumbbell, Check,
  ClipboardList, Activity, CalendarRange, CalendarCheck, HelpCircle,
} from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  plan?: WorkoutPlan; // present when this message is a generated workout
  savedTemplateId?: string; // set once the user saves the plan
  protocol?: DailyProtocol; // present when this message is a daily protocol
  protocolSaved?: boolean;
}

const SUGGESTIONS = [
  "Build me a workout for today",
  "How's my training trending this week?",
  "Am I recovering well based on my check-ins?",
  "What should I focus on next?",
];

// Heuristic: does the message look like a request to generate/revise a workout?
function looksLikeWorkoutRequest(text: string, hasPriorPlan = false): boolean {
  const t = text.toLowerCase();
  const isNew =
    /\b(workout|session|routine|template|train(ing)?\s*(plan|day)?)\b/.test(t) &&
    /\b(make|build|create|generate|give|plan|design|write|today|for me|new)\b/.test(t);
  // If a plan already exists, treat revision phrasing as plan mode too.
  const isRevision =
    hasPriorPlan &&
    /\b(harder|easier|lighter|heavier|more|fewer|less|swap|replace|change|adjust|shorter|longer|add|remove|instead|tweak|modify|different)\b/.test(t);
  return isNew || isRevision;
}

export default function CoachPage() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState(true);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;
    setError(null);
    setInput("");
    const history = messages.slice();
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);

    const hasPriorPlan = messages.some((m) => m.plan);
    const wantsPlan = looksLikeWorkoutRequest(message, hasPriorPlan);

    try {
      let context: unknown = undefined;
      if (shareData) {
        try {
          context = await buildContextSummary();
        } catch {
          context = undefined;
        }
      }

      // In plan mode, also send the user's exercise names so the model reuses them.
      let exercise_library: string[] | undefined;
      if (wantsPlan) {
        try {
          const exs = await db.exercises.toArray();
          exercise_library = exs.map((e) => e.name);
        } catch {
          exercise_library = undefined;
        }
      }

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          // For prior assistant messages that were workout plans, send the full
          // plan JSON (not just the rationale) so the model has the actual
          // workout in context and can revise it when asked.
          history: history.map((h) => ({
            role: h.role,
            content: h.plan
              ? `[Workout plan I generated]\n${JSON.stringify(h.plan)}`
              : h.content,
          })),
          context,
          intent: wantsPlan ? "plan" : "chat",
          exercise_library,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      if (wantsPlan) {
        const plan = parseWorkoutPlan(data.reply ?? "");
        if (plan) {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: plan.rationale ?? `Here's a ${plan.name} I put together for you.`,
              plan,
            },
          ]);
        } else {
          // Model didn't return usable JSON — fall back to showing the text.
          setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        }
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Couldn't reach the coach. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (idx: number, plan: WorkoutPlan) => {
    setSavingIdx(idx);
    try {
      const templateId = await saveWorkoutPlanAsTemplate(plan);
      setMessages((m) =>
        m.map((msg, i) => (i === idx ? { ...msg, savedTemplateId: templateId } : msg))
      );
    } catch {
      setError("Couldn't save the workout. Try again.");
    } finally {
      setSavingIdx(null);
    }
  };

  const handleGenerateProtocol = async () => {
    if (loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: "Generate today's protocol" }]);
    setLoading(true);
    try {
      // Works with or without an API key — generateProtocol falls back locally.
      const protocol = await generateProtocol();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: protocol.summary ?? "Here's your protocol for today.",
          protocol,
        },
      ]);
    } catch {
      setError("Couldn't build a protocol. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProtocol = async (idx: number, protocol: DailyProtocol) => {
    setSavingIdx(idx);
    try {
      await saveProtocol(protocol);
      setMessages((m) =>
        m.map((msg, i) => (i === idx ? { ...msg, protocolSaved: true } : msg))
      );
    } catch {
      setError("Couldn't save the protocol.");
    } finally {
      setSavingIdx(null);
    }
  };

  // Quick coach actions. Protocol is special (local fallback); the rest are
  // preset chat prompts routed through the normal send().
  const runAction = (id: string) => {
    if (id === "protocol") return handleGenerateProtocol();
    const prompts: Record<string, string> = {
      adjust: "Adjust today's plan based on my current readiness and recent training.",
      week: "Review my week — what went well and what to fix.",
      plan7: "Create a 7-day lifestyle plan covering training, fuel, recovery, and habits.",
      avoiding: "Based on my data, what am I avoiding or neglecting? Be direct.",
    };
    const stackPrompts: Record<string, string> = {
      stack_review: "Review my stack logs — summarize what I'm taking and any patterns.",
      stack_sides: "What side effects or symptoms are showing up in my logs?",
      stack_pause: "Based on my logs, should I consider pausing anything? Flag risks.",
      stack_risk: "Give me a stack risk review based on my symptoms and check-ins.",
    };
    if (prompts[id]) {
      send(prompts[id]);
    } else if (stackPrompts[id]) {
      sendStack(stackPrompts[id]);
    }
  };

  // Stack review goes through the guarded "stack" intent with stack context.
  const sendStack = async (message: string) => {
    if (loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);
    try {
      const { buildStackContext } = await import("@/lib/agent");
      let context: unknown = undefined;
      try {
        context = await buildStackContext();
      } catch {
        context = undefined;
      }
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, intent: "stack", context }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Couldn't reach the coach. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const ACTIONS = [
    { id: "protocol", label: "Today's Protocol", icon: ClipboardList },
    { id: "adjust", label: "Adjust for Readiness", icon: Activity },
    { id: "week", label: "Review My Week", icon: CalendarRange },
    { id: "plan7", label: "7-Day Plan", icon: CalendarCheck },
    { id: "avoiding", label: "What Am I Avoiding?", icon: HelpCircle },
    { id: "stack_review", label: "Review My Stack", icon: ClipboardList },
    { id: "stack_sides", label: "Side Effects Showing Up?", icon: Activity },
    { id: "stack_pause", label: "Should I Pause Anything?", icon: HelpCircle },
    { id: "stack_risk", label: "Stack Risk Review", icon: Activity },
  ];

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] flex flex-col">
      <PageHeader
        title="Coach"
        back="/"
        right={
          messages.length > 0 ? (
            <button
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-[#9BA0A6] active:text-[#F2555A]"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          ) : null
        }
      />

      {/* Data toggle */}
      <div className="max-w-lg mx-auto w-full px-4 pt-3">
        <button
          onClick={() => setShareData((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors"
          style={
            shareData
              ? { borderColor: "#C7F23E40", backgroundColor: "#C7F23E0F" }
              : { borderColor: "#24262C", backgroundColor: "#121316" }
          }
        >
          <span className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4" style={{ color: shareData ? "#C7F23E" : "#5A5F66" }} />
            <span className={shareData ? "text-[#F2F4F3]" : "text-[#9BA0A6]"}>
              {shareData ? "Sharing your data summary" : "Not sharing data"}
            </span>
          </span>
          <span
            className="relative inline-flex h-5 w-9 rounded-full transition-colors"
            style={{ backgroundColor: shareData ? "#C7F23E" : "#3A3D45" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-[#08090A] transition-all"
              style={{ left: shareData ? "1.125rem" : "0.125rem" }}
            />
          </span>
        </button>
        <p className="text-[11px] text-[#5A5F66] mt-1.5 px-1">
          {shareData
            ? "A summary (stats & trends) is sent to the coach to ground its answers."
            : "The coach answers generally, without seeing your logged data."}
        </p>
      </div>

      {/* Chat scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ minHeight: 0 }}
      >
        <div className="max-w-lg mx-auto flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="pt-6">
              <div className="grid place-items-center mx-auto mb-4 h-14 w-14 rounded-2xl bg-[#C7F23E]/10 border border-[#C7F23E]/30">
                <Sparkles className="w-6 h-6 text-[#C7F23E]" />
              </div>
              <p className="text-center text-sm text-[#9BA0A6] mb-5">
                Ask about your workouts, recovery, bodyweight, or habits.
              </p>

              {/* Quick coach actions */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {ACTIONS.map((a) => {
                  const Icon = a.icon;
                  // Protocol works even without an API key (local fallback).
                  const disabled = configured === false && a.id !== "protocol";
                  return (
                    <button
                      key={a.id}
                      onClick={() => runAction(a.id)}
                      disabled={disabled}
                      className="flex items-center gap-2 rounded-xl bg-[#121316] border border-[#24262C] px-3 py-3 active:bg-[#1B1D22] transition-colors disabled:opacity-40 text-left"
                    >
                      <Icon className="w-4 h-4 text-[#C7F23E] shrink-0" />
                      <span className="text-[13px] font-semibold leading-tight">{a.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={configured === false}
                    className="text-left text-sm rounded-xl bg-[#121316] border border-[#24262C] px-3.5 py-3 text-[#D6D9D6] active:bg-[#1B1D22] transition-colors disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {configured === false && (
                <p className="text-[11px] text-[#5A5F66] text-center mt-3">
                  No API key set — chat is off, but &ldquo;Today&apos;s Protocol&rdquo; still works using your data.
                </p>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-2 animate-fade-up">
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "self-end bg-[#C7F23E] text-[#08090A] font-medium rounded-br-md"
                    : "self-start bg-[#121316] border border-[#24262C] text-[#E8EAE8] rounded-bl-md"
                }`}
              >
                {m.content}
              </div>

              {/* Generated workout plan card */}
              {m.plan && (
                <div className="self-start w-[92%] rounded-2xl bg-[#121316] border border-[#C7F23E]/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#24262C]">
                    <Dumbbell className="w-4 h-4 text-[#C7F23E]" />
                    <p className="font-bold text-sm">{m.plan.name}</p>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[#5A5F66]">
                      {m.plan.exercises.length} exercises
                    </span>
                  </div>
                  <div className="px-4 py-2 flex flex-col divide-y divide-[#1A1C20]">
                    {m.plan.exercises.map((ex, j) => (
                      <div key={j} className="flex items-center justify-between py-2">
                        <span className="text-sm">{ex.name}</span>
                        <span className="text-xs text-[#9BA0A6] tnums">
                          {ex.target_sets} × {ex.target_reps}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-[#24262C]">
                    {m.savedTemplateId ? (
                      <button
                        onClick={() => router.push("/workout")}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#36D399]/15 text-[#36D399] font-semibold text-sm"
                      >
                        <Check className="w-4 h-4" /> Saved — start it in Train
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSavePlan(i, m.plan!)}
                        disabled={savingIdx === i}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#C7F23E] text-[#08090A] font-semibold text-sm disabled:opacity-50"
                      >
                        {savingIdx === i ? "Saving…" : "Save as template"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Generated daily protocol card */}
              {m.protocol && (
                <div className="self-start w-[92%] rounded-2xl bg-[#121316] border border-[#C7F23E]/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#24262C]">
                    <ClipboardList className="w-4 h-4 text-[#C7F23E]" />
                    <p className="font-bold text-sm">Today&apos;s Protocol</p>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[#5A5F66]">
                      {m.protocol.source === "ai" ? "AI" : "Local"}
                    </span>
                  </div>
                  <div className="px-4 py-2 flex flex-col divide-y divide-[#1A1C20]">
                    {m.protocol.tasks.map((t) => (
                      <div key={t.id} className="flex items-start gap-2 py-2">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#5A5F66] mt-1 w-14 shrink-0">
                          {t.pillar}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm">{t.title}</p>
                          {t.description && (
                            <p className="text-[11px] text-[#5A5F66] mt-0.5">{t.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-[#24262C]">
                    {m.protocolSaved ? (
                      <button
                        onClick={() => router.push("/")}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#36D399]/15 text-[#36D399] font-semibold text-sm"
                      >
                        <Check className="w-4 h-4" /> Saved — see it on your dashboard
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSaveProtocol(i, m.protocol!)}
                        disabled={savingIdx === i}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#C7F23E] text-[#08090A] font-semibold text-sm disabled:opacity-50"
                      >
                        {savingIdx === i ? "Saving…" : "Save protocol"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="self-start bg-[#121316] border border-[#24262C] rounded-2xl rounded-bl-md px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-[#5A5F66] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          )}

          {error && (
            <div className="self-stretch flex items-start gap-2 rounded-xl border border-[#F2555A]/30 bg-[#F2555A]/10 px-3.5 py-2.5 text-sm text-[#F2555A]">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 bg-[#08090A]/90 backdrop-blur-xl border-t border-[#1A1C20] px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="max-w-lg mx-auto">
          {configured === false ? (
            <div className="flex items-center gap-2 text-xs text-[#9BA0A6] justify-center py-2">
              <ShieldCheck className="w-4 h-4" />
              Coach not configured. Add DEEPSEEK_API_KEY to enable it.
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask your coach…"
                className="flex-1 resize-none max-h-32 rounded-2xl bg-[#121316] border border-[#24262C] px-4 py-3 text-[16px] outline-none focus:border-[#C7F23E]/50 transition-colors"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="grid place-items-center h-11 w-11 shrink-0 rounded-full bg-[#C7F23E] text-[#08090A] disabled:opacity-30 transition-opacity"
                aria-label="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-[#3A3D45] text-center mt-2 leading-snug">
            Coaching &amp; tracking only — not medical advice. No dosing guidance.
            Consult a professional for health concerns.
          </p>
        </div>
      </div>
    </main>
  );
}
