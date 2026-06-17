"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useTemplate,
  useTemplateExercises,
  useExercises,
  createExercise,
  updateTemplate,
  addExerciseToTemplate,
  updateTemplateExercise,
  removeExerciseFromTemplate,
} from "@/hooks/useWorkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Edit3, Trash2, X, Check } from "lucide-react";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const template = useTemplate(templateId);
  const exercises = useTemplateExercises(templateId);
  const allExercises = useExercises();

  const [editName, setEditName] = useState(template?.name ?? "");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRest, setEditRest] = useState("");
  const [editRPE, setEditRPE] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [exSearch, setExSearch] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  if (!template) {
    return (
      <main className="min-h-screen bg-[#08090A] flex items-center justify-center">
        <p className="text-[#9BA0A6] animate-pulse">Loading...</p>
      </main>
    );
  }

  const handleUpdateName = async () => {
    if (editName.trim() && editName !== template.name) {
      await updateTemplate(templateId, { name: editName.trim() });
    }
  };

  const handleAddExercise = async (exerciseId: string) => {
    await addExerciseToTemplate(templateId, exerciseId);
    setShowAdd(false);
    setExSearch("");
  };

  const handleCreateCustom = async () => {
    const name = exSearch.trim();
    if (!name) return;
    setCreatingCustom(true);
    try {
      const newId = await createExercise(name, "other");
      await addExerciseToTemplate(templateId, newId);
      setShowAdd(false);
      setExSearch("");
    } finally {
      setCreatingCustom(false);
    }
  };

  const startEdit = (te: typeof exercises[number]) => {
    setEditingId(te.id);
    setEditSets(String(te.target_sets));
    setEditReps(te.target_reps);
    setEditRest(String(te.rest_seconds));
    setEditRPE(String(te.rpe_target));
    setEditNotes(te.notes ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateTemplateExercise(editingId, {
      target_sets: parseInt(editSets, 10) || 3,
      target_reps: editReps || "8-12",
      rest_seconds: parseInt(editRest, 10) || 120,
      rpe_target: parseFloat(editRPE) || 8,
      notes: editNotes || null,
    });
    setEditingId(null);
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this exercise from the template?")) return;
    await removeExerciseFromTemplate(id);
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#C7F23E]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Edit Template</h1>
        </div>

        {/* Name */}
        <Card className="bg-[#121316] border-[#24262C]">
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-wider">
              Name
            </p>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleUpdateName}
              className="bg-[#08090A] border-[#24262C] text-lg font-semibold"
            />
          </CardContent>
        </Card>

        {/* Exercises */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-wider">
              Exercises
            </p>
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Add exercise picker */}
          {showAdd && (
            <Card className="bg-[#1B1D22] border-[#3A3D45] mb-3">
              <CardContent className="p-3 flex flex-col gap-2">
                <Input
                  value={exSearch}
                  onChange={(e) => setExSearch(e.target.value)}
                  placeholder="Search or type a new exercise…"
                  autoFocus
                  className="bg-[#121316] border-[#24262C]"
                />
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {(() => {
                    const q = exSearch.trim().toLowerCase();
                    const available = allExercises
                      .filter((ex) => !exercises.some((te) => te.exercise_id === ex.id))
                      .filter((ex) => !q || ex.name.toLowerCase().includes(q))
                      .sort((a, b) => a.name.localeCompare(b.name));
                    const exactExists = allExercises.some(
                      (ex) => ex.name.toLowerCase() === q
                    );
                    return (
                      <>
                        {available.map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => handleAddExercise(ex.id)}
                            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#121316] transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-medium">{ex.name}</p>
                              <p className="text-xs text-[#5A5F66]">
                                {[ex.primary_muscle, ex.equipment].filter(Boolean).join(" · ") || ex.category}
                              </p>
                            </div>
                            <Plus className="w-4 h-4 text-[#C7F23E]" />
                          </button>
                        ))}

                        {/* Create custom exercise */}
                        {q && !exactExists && (
                          <button
                            onClick={handleCreateCustom}
                            disabled={creatingCustom}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#C7F23E]/10 border border-[#C7F23E]/30 hover:bg-[#C7F23E]/15 transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-[#C7F23E]">
                                Create &ldquo;{exSearch.trim()}&rdquo;
                              </p>
                              <p className="text-xs text-[#9BA0A6]">Add as a custom exercise</p>
                            </div>
                            <Plus className="w-4 h-4 text-[#C7F23E]" />
                          </button>
                        )}

                        {available.length === 0 && !q && (
                          <p className="text-sm text-[#9BA0A6] text-center py-4">
                            All exercises already in this template. Type a name to add a custom one.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exercise list */}
          <div className="flex flex-col gap-2">
            {exercises.map((te, i) => (
              <Card key={te.id} className="bg-[#121316] border-[#24262C]">
                <CardContent className="p-4">
                  {editingId === te.id ? (
                    /* Edit mode */
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-semibold">
                        {te.exercise?.name ?? "Exercise"}
                      </p>
                      <div className="flex gap-2">
                        {[
                          { label: "Sets", val: editSets, set: setEditSets, type: "number" },
                          { label: "Reps", val: editReps, set: setEditReps, type: "text" },
                          { label: "Rest", val: editRest, set: setEditRest, type: "number" },
                          { label: "RPE", val: editRPE, set: setEditRPE, type: "number" },
                        ].map((f) => (
                          <div key={f.label} className="flex-1">
                            <p className="text-[10px] font-bold text-[#5A5F66] uppercase mb-1">
                              {f.label}
                            </p>
                            <Input
                              type={f.type}
                              value={f.val}
                              onChange={(e) => f.set(e.target.value)}
                              className="bg-[#08090A] border-[#24262C] text-center text-sm h-9"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[#5A5F66] w-5 h-5 rounded-full bg-[#1B1D22] flex items-center justify-center">
                            {i + 1}
                          </span>
                          <p className="text-sm font-semibold">
                            {te.exercise?.name ?? "Unknown"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(te)}
                            className="p-1.5 text-[#9BA0A6] hover:text-[#F2F4F3] transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemove(te.id)}
                            className="p-1.5 text-[#9BA0A6] hover:text-[#F2555A] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-8 mt-1 text-xs text-[#9BA0A6]">
                        <span>{te.target_sets}s × {te.target_reps}</span>
                        <span>·</span>
                        <span>Rest {te.rest_seconds}s</span>
                        <span>·</span>
                        <span>RPE {te.rpe_target}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {exercises.length === 0 && (
              <p className="text-center py-8 text-sm text-[#9BA0A6]">
                No exercises yet. Tap &ldquo;Add&rdquo; to build your template.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
