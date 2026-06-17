"use client";

import { useState } from "react";
import Link from "next/link";
import { useTemplates, createTemplate, deleteTemplate } from "@/hooks/useWorkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const CATEGORIES = [
  { key: "push", label: "Push", color: "#F2555A" },
  { key: "pull", label: "Pull", color: "#C7F23E" },
  { key: "legs", label: "Legs", color: "#36D399" },
  { key: "full_body", label: "Full Body", color: "#A78BFA" },
  { key: "custom", label: "Custom", color: "#F5B83D" },
] as const;

const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.color])
);

export default function TemplateManagerPage() {
  const templates = useTemplates();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("custom");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createTemplate(name.trim(), category as typeof CATEGORIES[number]["key"]);
    setName("");
    setCategory("custom");
    setShowCreate(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    await deleteTemplate(id);
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/workout">
              <Button variant="ghost" size="sm" className="text-[#C7F23E]">
                ← Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Templates</h1>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-3">
              <p className="text-sm font-bold">New Template</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Push Day"
                className="bg-[#08090A] border-[#24262C]"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                      category === c.key
                        ? "border-current"
                        : "border-[#24262C] text-[#9BA0A6]"
                    }`}
                    style={{
                      color: category === c.key ? c.color : undefined,
                      backgroundColor:
                        category === c.key ? c.color + "15" : "transparent",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreate}>
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Template list */}
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <Card key={t.id} className="bg-[#121316] border-[#24262C]">
              <CardContent className="p-4 flex items-center justify-between">
                <Link
                  href={`/workout/templates/${t.id}`}
                  className="flex-1 flex items-center gap-3"
                >
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <Badge
                      variant="outline"
                      className="mt-1 text-[10px]"
                      style={{
                        color: CATEGORY_COLORS[t.category] ?? "#9BA0A6",
                        borderColor:
                          (CATEGORY_COLORS[t.category] ?? "#9BA0A6") + "40",
                      }}
                    >
                      {t.category.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 text-[#F2555A] hover:bg-[#F2555A]/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && !showCreate && (
            <div className="text-center py-12 text-[#9BA0A6]">
              <p>No templates yet.</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setShowCreate(true)}
              >
                Create Your First Template
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
