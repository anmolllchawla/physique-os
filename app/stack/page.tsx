"use client";

import { useState } from "react";
import {
  useStackItems,
  useStackLogs,
  useStackSafety,
  useLabMarkers,
  addStackItem,
  archiveStackItem,
  toggleTakenToday,
  updateTodayLog,
  saveSafetyCheckIn,
  addLabMarker,
  deleteLabMarker,
} from "@/hooks/useStack";
import {
  RED_FLAG_SYMPTOMS,
  MODERATE_SYMPTOMS,
  MILD_SYMPTOMS,
  INJECTION_SITE_ISSUES,
  DEFAULT_LAB_MARKERS,
  compoundMonitoring,
} from "@/lib/stackSafety";
import type { StackItem, StackCategory, StackRoute } from "@/lib/db";
import { PageHeader, Section } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/utils";
import {
  ShieldAlert, ShieldCheck, Shield, AlertTriangle, Plus, Check, ChevronDown, Trash2, FlaskConical, Archive,
} from "lucide-react";

const SYMPTOM_GROUPS = [
  { label: "Serious — seek care", items: RED_FLAG_SYMPTOMS, color: "#F2555A" },
  { label: "Concerning", items: MODERATE_SYMPTOMS, color: "#F5B83D" },
  { label: "Mild", items: MILD_SYMPTOMS, color: "#9BA0A6" },
];

export default function StackPage() {
  const items = useStackItems();
  const todayLogs = useStackLogs();
  const safety = useStackSafety();
  const labs = useLabMarkers();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showLab, setShowLab] = useState(false);

  const logFor = (itemId: string) => todayLogs.find((l) => l.stackItemId === itemId);

  const SafetyIcon =
    safety?.state === "Low" ? ShieldCheck : safety?.state === "Watch" ? Shield : ShieldAlert;

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader title="Stack Monitor" back="/" subtitle="Safety tracking — not dosing advice" />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Urgent red-flag banner */}
        {safety?.urgentMessage && (
          <div className="rounded-2xl border border-[#F2555A] bg-[#F2555A]/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F2555A] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#F2555A]">Stop and seek medical care</p>
              <p className="text-sm text-[#F2D0D1] mt-1 leading-snug">{safety.urgentMessage}</p>
              {safety.redFlags.length > 0 && (
                <p className="text-xs text-[#F2555A] mt-2">Flagged: {safety.redFlags.join(", ")}</p>
              )}
            </div>
          </div>
        )}

        {/* Safety score */}
        {safety && (
          <div
            className="relative rounded-2xl bg-[#121316] border p-5 overflow-hidden"
            style={{ borderColor: safety.color + "55" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="grid place-items-center h-16 w-16 rounded-2xl shrink-0"
                style={{ backgroundColor: safety.color + "1A" }}
              >
                <SafetyIcon className="w-7 h-7" style={{ color: safety.color }} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#5A5F66] uppercase tracking-[0.14em]">
                  Stack Safety
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-extrabold tnums" style={{ color: safety.color }}>
                    {safety.score}
                  </span>
                  <span className="text-sm font-bold uppercase" style={{ color: safety.color }}>
                    {safety.state}
                  </span>
                </div>
              </div>
            </div>
            {safety.reasons.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {safety.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-[#9BA0A6] flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-[#5A5F66]" /> {r}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-[#5A5F66] mt-3">
              This is a tracking signal, not medical advice. It never suggests doses.
            </p>
          </div>
        )}

        {/* Today's items */}
        <Section
          label="Today"
          action={
            <button onClick={() => setShowAdd((v) => !v)} className="text-[11px] font-semibold text-[#C7F23E]">
              {showAdd ? "Close" : "Add item"}
            </button>
          }
        >
          {showAdd && <AddItemForm onDone={() => setShowAdd(false)} />}

          <div className="flex flex-col gap-2">
            {items.length === 0 && (
              <p className="text-sm text-[#9BA0A6] text-center py-6">
                No active items. Add one to start tracking.
              </p>
            )}
            {items.map((item) => {
              const log = logFor(item.id);
              const taken = log?.taken ?? false;
              const isOpen = expanded === item.id;
              return (
                <div key={item.id} className="rounded-2xl bg-[#121316] border border-[#24262C] overflow-hidden">
                  <div className="flex items-center gap-3 p-3.5">
                    <button
                      onClick={() => toggleTakenToday(item.id)}
                      className="grid place-items-center h-9 w-9 rounded-full border-2 shrink-0 transition-colors"
                      style={{
                        borderColor: taken ? "#36D399" : "#3A3D45",
                        backgroundColor: taken ? "#36D39922" : "transparent",
                      }}
                      aria-label={taken ? "Mark not taken" : "Mark taken"}
                    >
                      {taken && <Check className="w-5 h-5 text-[#36D399]" />}
                    </button>
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-[11px] text-[#5A5F66] uppercase tracking-wide">
                        {item.category} · {item.route}
                        {log?.doseText ? ` · ${log.doseText}` : ""}
                      </p>
                    </button>
                    <ChevronDown
                      className={`w-4 h-4 text-[#5A5F66] transition-transform ${isOpen ? "rotate-180" : ""}`}
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                    />
                  </div>
                  {isOpen && <ItemDetail item={item} />}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Safety check-in */}
        <Section
          label="Safety check-in"
          action={
            <button onClick={() => setShowCheckIn((v) => !v)} className="text-[11px] font-semibold text-[#C7F23E]">
              {showCheckIn ? "Close" : "Log how you feel"}
            </button>
          }
        >
          {showCheckIn ? (
            <SafetyCheckInForm onDone={() => setShowCheckIn(false)} />
          ) : (
            <p className="text-xs text-[#5A5F66] px-1">
              Log symptoms and how you feel daily. Missing check-ins lowers your safety signal.
            </p>
          )}
        </Section>

        {/* Labs */}
        <Section
          label="Lab markers"
          action={
            <button onClick={() => setShowLab((v) => !v)} className="text-[11px] font-semibold text-[#C7F23E]">
              {showLab ? "Close" : "Add result"}
            </button>
          }
        >
          {showLab && <AddLabForm onDone={() => setShowLab(false)} />}
          <div className="flex flex-col gap-1.5 mt-1">
            {labs.length === 0 && !showLab && (
              <p className="text-xs text-[#5A5F66] px-1">
                Track fasting glucose, HbA1c, IGF-1, lipids, and more.
              </p>
            )}
            {labs.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl bg-[#121316] border border-[#24262C] px-3.5 py-2.5"
              >
                <FlaskConical className="w-4 h-4 text-[#9BCBF2] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-[#5A5F66]">{m.date}</p>
                </div>
                <span className="text-sm font-semibold tnums">
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ""}
                </span>
                <button onClick={() => deleteLabMarker(m.id)} aria-label="Delete">
                  <Trash2 className="w-4 h-4 text-[#5A5F66]" />
                </button>
              </div>
            ))}
          </div>
        </Section>

        <p className="text-[11px] text-[#5A5F66] leading-relaxed px-1">
          Stack Monitor is a safety and tracking tool. It does not prescribe, recommend, or adjust
          doses for any compound. Follow your own or your clinician&apos;s plan, and seek medical
          care for concerning symptoms.
        </p>
      </div>
    </main>
  );
}

function ItemDetail({ item }: { item: StackItem }) {
  const log = useStackLogs().find((l) => l.stackItemId === item.id);
  const [dose, setDose] = useState(log?.doseText ?? "");
  const [time, setTime] = useState(log?.time ?? "");
  const mon = compoundMonitoring(item.name);
  const selectedSymptoms = log?.symptoms ?? [];

  const toggleSymptom = (s: string) => {
    const next = selectedSymptoms.includes(s)
      ? selectedSymptoms.filter((x) => x !== s)
      : [...selectedSymptoms, s];
    updateTodayLog(item.id, { symptoms: next });
  };

  const watchList = mon?.watch ?? MODERATE_SYMPTOMS.slice(0, 8);

  return (
    <div className="border-t border-[#24262C] p-3.5 flex flex-col gap-3 bg-[#0E0F12]">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-[#5A5F66] uppercase font-bold">Dose (your own)</label>
          <Input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            onBlur={() => updateTodayLog(item.id, { doseText: dose.trim() || undefined })}
            placeholder="e.g. as per my plan"
            className="bg-[#08090A] border-[#24262C] mt-1"
          />
        </div>
        <div className="w-28">
          <label className="text-[10px] text-[#5A5F66] uppercase font-bold">Time</label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => updateTodayLog(item.id, { time: time || undefined })}
            className="bg-[#08090A] border-[#24262C] mt-1"
          />
        </div>
      </div>

      {mon && (
        <p className="text-[11px] text-[#9BCBF2] bg-[#9BCBF2]/10 rounded-lg px-2.5 py-2">
          {mon.note}
        </p>
      )}

      <div>
        <label className="text-[10px] text-[#5A5F66] uppercase font-bold">Symptoms to watch</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {watchList.map((s) => {
            const on = selectedSymptoms.includes(s);
            const isRed = (RED_FLAG_SYMPTOMS as readonly string[]).includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                className="text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors"
                style={{
                  borderColor: on ? (isRed ? "#F2555A" : "#F5B83D") : "#24262C",
                  backgroundColor: on ? (isRed ? "#F2555A22" : "#F5B83D22") : "transparent",
                  color: on ? (isRed ? "#F2555A" : "#F5B83D") : "#9BA0A6",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => archiveStackItem(item.id)}
        className="flex items-center gap-1.5 text-xs text-[#5A5F66] self-start mt-1"
      >
        <Archive className="w-3.5 h-3.5" /> Archive item
      </button>
    </div>
  );
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StackCategory>("supplement");
  const [route, setRoute] = useState<StackRoute>("oral");
  const [plan, setPlan] = useState("");

  const save = async () => {
    if (!name.trim()) return;
    await addStackItem({
      name: name.trim(),
      category,
      route,
      userEnteredPlan: plan.trim() || undefined,
    });
    onDone();
  };

  return (
    <div className="rounded-2xl bg-[#1B1D22] border border-[#C7F23E]/30 p-3.5 flex flex-col gap-2.5 mb-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus className="bg-[#08090A] border-[#24262C]" />
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StackCategory)}
          className="flex-1 bg-[#08090A] border border-[#24262C] rounded-lg px-2 py-2 text-sm"
        >
          {["peptide", "supplement", "medication", "skincare", "other"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={route}
          onChange={(e) => setRoute(e.target.value as StackRoute)}
          className="flex-1 bg-[#08090A] border border-[#24262C] rounded-lg px-2 py-2 text-sm"
        >
          {["oral", "nasal", "topical", "injectable", "other"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <Input
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        placeholder="Your/clinician plan (optional, your words)"
        className="bg-[#08090A] border-[#24262C]"
      />
      <div className="flex gap-2">
        <Button onClick={save} className="flex-1">Add</Button>
        <Button variant="ghost" onClick={onDone} className="flex-1">Cancel</Button>
      </div>
    </div>
  );
}

function SafetyCheckInForm({ onDone }: { onDone: () => void }) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [injIssues, setInjIssues] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [sleepQuality, setSleepQuality] = useState(3);
  const [saved, setSaved] = useState(false);

  const toggle = (arr: string[], setArr: (v: string[]) => void, s: string) =>
    setArr(arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);

  const save = async () => {
    await saveSafetyCheckIn({
      symptoms,
      injectionSiteIssues: injIssues.length ? injIssues : undefined,
      sleepQuality,
      notes: notes.trim() || undefined,
    });
    setSaved(true);
    setTimeout(onDone, 700);
  };

  return (
    <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-3.5 flex flex-col gap-3">
      {SYMPTOM_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: g.color }}>
            {g.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((s) => {
              const on = symptoms.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(symptoms, setSymptoms, s)}
                  className="text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors"
                  style={{
                    borderColor: on ? g.color : "#24262C",
                    backgroundColor: on ? g.color + "22" : "transparent",
                    color: on ? g.color : "#9BA0A6",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9BA0A6] mb-1.5">
          Injection-site issues
        </p>
        <div className="flex flex-wrap gap-1.5">
          {INJECTION_SITE_ISSUES.map((s) => {
            const on = injIssues.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggle(injIssues, setInjIssues, s)}
                className="text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors"
                style={{
                  borderColor: on ? "#F5B83D" : "#24262C",
                  backgroundColor: on ? "#F5B83D22" : "transparent",
                  color: on ? "#F5B83D" : "#9BA0A6",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="bg-[#08090A] border-[#24262C]"
      />
      <Button onClick={save} disabled={saved}>
        {saved ? "Saved ✓" : "Save check-in"}
      </Button>
    </div>
  );
}

function AddLabForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(todayISO());

  const save = async () => {
    if (!name.trim() || !value.trim()) return;
    await addLabMarker({ name: name.trim(), value: value.trim(), unit: unit.trim() || undefined, date });
    onDone();
  };

  return (
    <div className="rounded-2xl bg-[#1B1D22] border border-[#C7F23E]/30 p-3.5 flex flex-col gap-2.5 mb-2">
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_LAB_MARKERS.map((m) => (
          <button
            key={m}
            onClick={() => setName(m)}
            className="text-[11px] rounded-full px-2.5 py-1 border border-[#24262C] text-[#9BA0A6] active:bg-[#08090A]"
          >
            {m}
          </button>
        ))}
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marker name" className="bg-[#08090A] border-[#24262C]" />
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className="bg-[#08090A] border-[#24262C]" />
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="bg-[#08090A] border-[#24262C] w-24" />
      </div>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-[#08090A] border-[#24262C]" />
      <div className="flex gap-2">
        <Button onClick={save} className="flex-1"><Plus className="w-4 h-4 mr-1" /> Add</Button>
        <Button variant="ghost" onClick={onDone} className="flex-1">Cancel</Button>
      </div>
    </div>
  );
}
