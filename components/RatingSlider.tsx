"use client";

import { cn } from "@/lib/utils";

interface RatingSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  labels?: readonly string[];
}

export function RatingSlider({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  labels,
}: RatingSliderProps) {
  const dots = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#D6D9D6]">{label}</span>
        <span className="text-xs font-bold tabular-nums text-[#9BA0A6]">
          {value}/{max}
        </span>
      </div>
      <div className="flex gap-2">
        {dots.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              "flex-1 h-10 rounded-lg border text-sm font-bold transition-all",
              d <= value
                ? "border-[#C7F23E] bg-[#C7F23E]/20 text-[#C7F23E]"
                : "border-[#24262C] bg-[#121316] text-[#5A5F66] hover:border-[#C7F23E]/50 hover:text-[#9BA0A6]"
            )}
            aria-label={`${label}: ${d}`}
          >
            {d}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between px-1">
          <span className="text-[10px] text-[#5A5F66]">{labels[0]}</span>
          <span className="text-[10px] text-[#5A5F66]">
            {labels[labels.length - 1]}
          </span>
        </div>
      )}
    </div>
  );
}
