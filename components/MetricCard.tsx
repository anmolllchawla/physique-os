"use client";

import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  color = "#F2F4F3",
}: MetricCardProps) {
  const trendColor =
    trend === "up"
      ? "#36D399"
      : trend === "down"
        ? "#F2555A"
        : "#9BA0A6";

  return (
    <Card className="flex-1 min-w-[120px] bg-[#121316] border-[#24262C]">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-1">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm text-[#9BA0A6] font-medium">
              {unit}
            </span>
          )}
        </div>
        {trendValue && (
          <div className="flex items-center gap-0.5 mt-1">
            <span
              className="text-sm font-bold"
              style={{ color: trendColor }}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: trendColor }}
            >
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
