"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Supplement } from "@/lib/db";
import {
  useSupplements,
  createSupplement,
  updateSupplement,
  toggleSupplementTaken,
} from "@/hooks/useSupplements";
import { todayISO, formatDateShort } from "@/lib/utils";
import { PageHeader, Section, Pill, EmptyState } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill as PillIcon, Plus, X, Check, Pencil } from "lucide-react";

const CATEGORIES: { key: Supplement["category"]; label: string; color: string }[] = [
  { key: "supplement", label: "Supplement", color: "#36D399" },
  { key: "peptide", label: "Peptide", color: "#A78BFA" },
  { key: "medication", label: "Medication", color: "#F5B83D" },
  { key: "other", label: "Other", color: "#9BA0A6" },
];

function catMeta(c: Supplement["category"]) {
  return CATEGORIES.find((x) => x.key === c) ?? CATEGORIES[3];
}

const blankForm = {
  name: "",
  category: "supplement" as Supplement["category"],
  dose: "",
  schedule: "",
  notes: "",
  start_date: todayISO(),
  end_date: "",
};

export default function SupplementsPage() {
  const today = todayISO();
  const supplements = useSupplements();
  const todayLogs =
    useLiveQuery(() => db.supplementLogs.where("date").equals(today).toArray(), [today]) ?? [];
  const takenSet = new Set(todayLogs.filter((l) => l.taken).map((l) => l.supplement_id));

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const active = supplements.filter((s) => s.is_active);
  const archived = supplements.filter((s) => !s.is_active);
  const takenCount = active.filter((s) => takenSet.has(s.id)).length;

  const openAdd = () => {
    setEditId(null);
    setForm(blankForm);
    setShowForm(true);
  };
  const openEdit = (s: Supplement) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      category: s.category,
      dose: s.dose ?? "",
      schedule: s.schedule ?? "",
      notes: s.notes ?? "",
      start_date: s.start_date ?? todayISO(),
      end_date: s.end_date ?? "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        dose: form.dose.trim() || null,
        schedule: form.schedule.trim() || null,
        notes: form.notes.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editId) await updateSupplement(editId, payload);
      else await createSupplement(payload);
      setShowForm(false);
      setForm(blankForm);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader
        title="Supplements"
        back="/"
        right={
          <Button variant="ghost" size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        }
      />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Today progress ring-ish summary */}
        {active.length > 0 && (
          <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#5A5F66] uppercase tracking-[0.12em]">
                Today
              </p>
              <p className="text-2xl font-extrabold tnums mt-1">
                {takenCount}
                <span className="text-[#5A5F66] text-base font-bold"> / {active.length}</span>
              </p>
              <p className="text-[11px] text-[#5A5F66] mt-0.5">taken so far</p>
            </div>
            <div className="text-right">
              <p
                className="text-3xl font-extrabold tnums"
                style={{ color: takenCount === active.length ? "#36D399" : "#C7F23E" }}
              >
                {active.length ? Math.round((takenCount / active.length) * 100) : 0}%
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{editId ? "Edit item" : "New item"}</p>
              <button onClick={() => setShowForm(false)} aria-label="Close">
                <X className="w-4 h-4 text-[#9BA0A6]" />
              </button>
            </div>

            <Input
              placeholder="Name (e.g. Creatine, Vitamin D)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#08090A] border-[#24262C]"
              autoFocus
            />

            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setForm({ ...form, category: c.key })}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                  style={
                    form.category === c.key
                      ? { backgroundColor: c.color + "22", color: c.color }
                      : { backgroundColor: "#1B1D22", color: "#5A5F66" }
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Dose (free text)"
                value={form.dose}
                onChange={(e) => setForm({ ...form, dose: e.target.value })}
                className="bg-[#08090A] border-[#24262C]"
              />
              <Input
                placeholder="Schedule (e.g. Daily AM)"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                className="bg-[#08090A] border-[#24262C]"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-[#5A5F66] uppercase font-bold">Start</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="bg-[#08090A] border-[#24262C]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[#5A5F66] uppercase font-bold">
                  End (optional)
                </label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="bg-[#08090A] border-[#24262C]"
                />
              </div>
            </div>

            <Input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-[#08090A] border-[#24262C]"
            />

            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full">
              {saving ? "Saving…" : editId ? "Save changes" : "Add item"}
            </Button>
          </div>
        )}

        {/* Active list — today checklist */}
        {active.length > 0 && (
          <Section label="Active">
            <div className="flex flex-col gap-2">
              {active.map((s) => {
                const meta = catMeta(s.category);
                const taken = takenSet.has(s.id);
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl bg-[#121316] border border-[#24262C] p-3.5 flex items-center gap-3"
                  >
                    <button
                      onClick={() => toggleSupplementTaken(s.id, today, !taken)}
                      aria-label={taken ? "Mark not taken" : "Mark taken"}
                      className="grid place-items-center h-11 w-11 rounded-full border-2 transition-colors shrink-0"
                      style={
                        taken
                          ? { borderColor: "#36D399", backgroundColor: "#36D39922" }
                          : { borderColor: "#24262C" }
                      }
                    >
                      {taken && <Check className="w-5 h-5 text-[#36D399]" />}
                    </button>

                    <Link href={`/supplements/${s.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{s.name}</p>
                        <Pill color={meta.color}>{meta.label}</Pill>
                      </div>
                      <p className="text-xs text-[#5A5F66] truncate mt-0.5">
                        {[s.dose, s.schedule].filter(Boolean).join(" · ") || "Tap for history"}
                      </p>
                    </Link>

                    <button
                      onClick={() => openEdit(s)}
                      aria-label="Edit"
                      className="p-2 text-[#5A5F66] hover:text-[#9BA0A6]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <Section label="Archived">
            <div className="flex flex-col gap-2">
              {archived.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl bg-[#121316]/60 border border-[#24262C] p-3.5 flex items-center justify-between"
                >
                  <Link href={`/supplements/${s.id}`} className="min-w-0">
                    <p className="font-medium text-[#9BA0A6] truncate">{s.name}</p>
                    <p className="text-xs text-[#5A5F66]">
                      Stopped {s.end_date ? formatDateShort(s.end_date) : "—"}
                    </p>
                  </Link>
                  <button
                    onClick={() => updateSupplement(s.id, { is_active: true, end_date: null })}
                    className="text-xs font-semibold text-[#C7F23E]"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {supplements.length === 0 && !showForm && (
          <EmptyState
            icon={PillIcon}
            title="Nothing tracked yet"
            hint="Add a supplement, peptide, or medication to log adherence over time. Tracking only — no dosing advice."
          />
        )}

        <p className="text-[11px] text-[#3A3D45] text-center px-4 leading-relaxed">
          PhysiqueOS records only what you enter. It does not recommend doses.
          Talk to a qualified professional about anything you take.
        </p>
      </div>
    </main>
  );
}
