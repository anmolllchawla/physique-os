"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface SetLoggerProps {
  setNumber: number;
  onLog: (data: {
    weight_lbs: number | null;
    reps: number;
    rpe: number | null;
    is_warmup: boolean;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SetLogger({ setNumber, onLog, onCancel, loading }: SetLoggerProps) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);

  const handleSubmit = () => {
    const repsNum = parseInt(reps, 10);
    if (!repsNum || repsNum < 1) return;
    onLog({
      weight_lbs: weight ? parseFloat(weight) : null,
      reps: repsNum,
      rpe: rpe ? parseFloat(rpe) : null,
      is_warmup: isWarmup,
    });
    setWeight("");
    setReps("");
    setRpe("");
    setIsWarmup(false);
  };

  return (
    <Card className="bg-[#1B1D22] border-[#3A3D45]">
      <CardContent className="p-4 flex flex-col gap-3">
        <p className="text-xs font-bold text-[#9BA0A6] uppercase tracking-wider">
          Log Set #{setNumber}
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-[#9BA0A6] font-semibold uppercase mb-1 block">
              Weight (lbs)
            </label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="185"
              className="bg-[#121316] border-[#24262C] text-center text-lg font-bold h-12"
              autoFocus
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-[#9BA0A6] font-semibold uppercase mb-1 block">
              Reps
            </label>
            <Input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="10"
              className="bg-[#121316] border-[#24262C] text-center text-lg font-bold h-12"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-[#9BA0A6] font-semibold uppercase mb-1 block">
              RPE
            </label>
            <Input
              type="number"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              placeholder="8"
              className="bg-[#121316] border-[#24262C] text-center text-lg font-bold h-12"
              step="0.5"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isWarmup}
            onChange={(e) => setIsWarmup(e.target.checked)}
            className="w-4 h-4 rounded accent-[#C7F23E]"
          />
          <span className="text-sm text-[#9BA0A6]">Warmup set</span>
        </label>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleSubmit} disabled={loading}>
            Log &amp; Rest
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
