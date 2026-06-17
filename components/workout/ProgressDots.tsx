"use client";

interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex gap-2 justify-center py-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i < current
              ? "bg-[#C7F23E]"
              : i === current
                ? "bg-[#C7F23E] ring-2 ring-[#C7F23E]/30"
                : "bg-[#24262C]"
          }`}
        />
      ))}
    </div>
  );
}
