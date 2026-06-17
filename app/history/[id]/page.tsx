"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { estimatedOneRM } from "@/lib/progression";
import { useSettings } from "@/hooks/useSettings";
import { formatDateShort, formatDuration, displayWeight, toLbs } from "@/lib/utils";
import { PageHeader, Section, StatTile, EmptyState } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { Dumbbell, Pencil, Trash2, Check, X } from "lucide-react";

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { weight_unit } = useSettings();
  const wu = weight_unit;

  const session = useLiveQuery(() => db.workoutSessions.get(id), [id]);
  const logs = useLiveQuery(
    () => db.exerciseLogs.where("session_id").equals(id).sortBy("created_at"),
    [id]
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = new Map(exercises.map((e) => [e.id, e.name]));

  const [editingMeta, setEditingMeta] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveMeta = async () => {
    await db.workoutSessions.update(id, {
      name: nameDraft.trim() || "Workout",
      notes: notesDraft.trim() || null,
    });
    setEditingMeta(false);
  };

  const saveSet = async (logId: string, weightDisplay: string, reps: string) => {
    const repsNum = parseInt(reps, 10);
    if (isNaN(repsNum) || repsNum <= 0) return;
    const w = weightDisplay.trim() === "" ? null : toLbs(parseFloat(weightDisplay), wu);
    await db.exerciseLogs.update(logId, { weight_lbs: w, reps: repsNum });
    setEditingSetId(null);
  };

  const deleteSet = async (logId: string) => {
    await db.exerciseLogs.delete(logId);
    setEditingSetId(null);
  };

  const deleteSession = async () => {
    await db.exerciseLogs.where("session_id").equals(id).delete();
    await db.workoutSessions.delete(id);
    router.push("/workout");
  };

  if (session === undefined || logs === undefined) {
    return (
      <main className="min-h-screen bg-[#08090A] grid place-items-center">
        <p className="text-[#9BA0A6] animate-pulse">Loading…</p>
      </main>
    );
  }
  if (session === null) {
    return (
      <main className="min-h-screen bg-[#08090A] grid place-items-center px-4 text-center gap-3">
        <p className="text-[#9BA0A6]">This session no longer exists.</p>
        <Button onClick={() => router.push("/workout")}>Back to Workouts</Button>
      </main>
    );
  }

  // Group sets by exercise, preserving first-seen order.
  const order: string[] = [];
  const grouped = new Map<string, typeof logs>();
  for (const l of logs) {
    if (!grouped.has(l.exercise_id)) {
      grouped.set(l.exercise_id, []);
      order.push(l.exercise_id);
    }
    grouped.get(l.exercise_id)!.push(l);
  }

  const workSets = logs.filter((l) => !l.is_warmup);
  const totalVolume = workSets.reduce((s, l) => s + (l.weight_lbs ?? 0) * l.reps, 0);
  const totalReps = workSets.reduce((s, l) => s + l.reps, 0);
  const topE1rm = workSets.reduce((mx, l) => {
    if (!l.weight_lbs) return mx;
    return Math.max(mx, estimatedOneRM(l.weight_lbs, l.reps));
  }, 0);

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader
        title={session.name}
        back="/workout"
        subtitle={formatDateShort(session.started_at)}
        right={
          <button
            onClick={() => {
              setNameDraft(session.name);
              setNotesDraft(session.notes ?? "");
              setEditingMeta(true);
            }}
            className="flex items-center gap-1 text-sm font-semibold text-[#9BA0A6] active:text-[#C7F23E]"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Edit name/notes panel */}
        {editingMeta && (
          <div className="rounded-2xl bg-[#121316] border border-[#C7F23E]/30 p-4 flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-bold text-[#5A5F66] uppercase tracking-wider">
                Name
              </label>
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="bg-[#08090A] border-[#24262C] mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#5A5F66] uppercase tracking-wider">
                Notes
              </label>
              <Input
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="How did it feel?"
                className="bg-[#08090A] border-[#24262C] mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveMeta}>
                Save
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setEditingMeta(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="flex gap-3">
          <StatTile
            label="Volume"
            value={`${((displayWeight(totalVolume, wu) ?? totalVolume) / 1000).toFixed(1)}k`}
            unit={wu}
          />
          <StatTile label="Sets" value={workSets.length} accent="#A78BFA" />
          <StatTile
            label="Time"
            value={session.duration_sec ? formatDuration(session.duration_sec) : "—"}
            accent="#36D399"
          />
        </div>
        <div className="flex gap-3">
          <StatTile label="Total reps" value={totalReps} accent="#9BA0A6" />
          <StatTile
            label="Top e1RM"
            value={topE1rm ? (displayWeight(Math.round(topE1rm), wu) ?? 0) : "—"}
            unit={topE1rm ? wu : undefined}
            accent="#C7F23E"
          />
        </div>

        {session.notes && !editingMeta && (
          <p className="text-sm text-[#9BA0A6] bg-[#121316] border border-[#24262C] rounded-xl p-3 italic">
            {session.notes}
          </p>
        )}

        {/* Per-exercise breakdown */}
        {order.length === 0 ? (
          <EmptyState icon={Dumbbell} title="No sets were logged in this session" />
        ) : (
          <Section label="Exercises">
            <div className="flex flex-col gap-3">
              {order.map((exId) => {
                const sets = grouped.get(exId)!;
                const name = exMap.get(exId) ?? "Exercise";
                const exVol = sets
                  .filter((s) => !s.is_warmup)
                  .reduce((sum, s) => sum + (s.weight_lbs ?? 0) * s.reps, 0);
                return (
                  <div key={exId} className="rounded-2xl bg-[#121316] border border-[#24262C] p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="font-semibold">{name}</p>
                      <span className="text-[11px] text-[#5A5F66] tnums">
                        {(displayWeight(exVol, wu) ?? exVol).toLocaleString()} {wu}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {sets.map((s) =>
                        editingSetId === s.id ? (
                          <HistorySetEdit
                            key={s.id}
                            weightDisplay={
                              s.weight_lbs != null
                                ? String(displayWeight(s.weight_lbs, wu))
                                : ""
                            }
                            reps={String(s.reps)}
                            unit={wu}
                            onSave={(w, r) => saveSet(s.id, w, r)}
                            onDelete={() => deleteSet(s.id)}
                            onCancel={() => setEditingSetId(null)}
                          />
                        ) : (
                          <button
                            key={s.id}
                            onClick={() => setEditingSetId(s.id)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1B1D22] text-left active:bg-[#23262C]"
                          >
                            <span className="text-[11px] font-bold text-[#5A5F66] w-4">
                              {s.set_number}
                            </span>
                            <span className="text-sm font-semibold tnums">
                              {s.weight_lbs
                                ? `${displayWeight(s.weight_lbs, wu)} ${wu}`
                                : "BW"}{" "}
                              × {s.reps}
                            </span>
                            {s.rpe != null && (
                              <span className="text-xs text-[#5A5F66]">@ {s.rpe}</span>
                            )}
                            {s.is_warmup && (
                              <span className="text-[10px] font-bold text-[#F5B83D]">WARMUP</span>
                            )}
                            <Pencil className="w-3.5 h-3.5 text-[#3A3D45] ml-auto" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Delete session */}
        <Section label="Manage">
          {!confirmDelete ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete this workout
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={deleteSession}>
                Yes, delete it
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </Section>
      </div>

      <BottomNav />
    </main>
  );
}

function HistorySetEdit({
  weightDisplay,
  reps,
  unit,
  onSave,
  onDelete,
  onCancel,
}: {
  weightDisplay: string;
  reps: string;
  unit: string;
  onSave: (weight: string, reps: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [w, setW] = useState(weightDisplay);
  const [r, setR] = useState(reps);
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[#08090A] border border-[#C7F23E]/30">
      <input
        type="number"
        inputMode="decimal"
        value={w}
        onChange={(e) => setW(e.target.value)}
        placeholder={unit}
        className="w-16 bg-[#1B1D22] rounded px-2 py-1 text-sm tnums outline-none"
      />
      <span className="text-[#5A5F66]">×</span>
      <input
        type="number"
        inputMode="numeric"
        value={r}
        onChange={(e) => setR(e.target.value)}
        placeholder="reps"
        className="w-16 bg-[#1B1D22] rounded px-2 py-1 text-sm tnums outline-none"
      />
      <button
        onClick={() => onSave(w, r)}
        className="ml-auto grid place-items-center h-8 w-8 rounded-md bg-[#C7F23E] text-[#08090A]"
        aria-label="Save"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        className="grid place-items-center h-8 w-8 rounded-md bg-[#F2555A]/15 text-[#F2555A]"
        aria-label="Delete set"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="grid place-items-center h-8 w-8 rounded-md text-[#9BA0A6]"
        aria-label="Cancel"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
