"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface Point {
  label: string;
  value: number;
}

const AXIS = "#5A5F66";
const GRID = "#1A1C20";

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Point }>;
  unit?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-[#24262C] bg-[#121316] px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wider text-[#5A5F66]">{p.payload.label}</p>
      <p className="text-sm font-bold tabular-nums text-[#F2F4F3]">
        {p.value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

export function LineTrend({
  data,
  color = "#C7F23E",
  unit,
  height = 160,
  domainPad = 2,
}: {
  data: Point[];
  color?: string;
  unit?: string;
  height?: number;
  domainPad?: number;
}) {
  if (data.length < 2) {
    return <EmptyChart message="Log at least 2 entries to see a trend." height={height} />;
  }
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={[Math.floor(min - domainPad), Math.ceil(max + domainPad)]}
          width={40}
        />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "#24262C" }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarTrend({
  data,
  color = "#A78BFA",
  unit,
  height = 160,
  average,
}: {
  data: Point[];
  color?: string;
  unit?: string;
  height?: number;
  average?: number;
}) {
  if (data.length === 0) {
    return <EmptyChart message="No data yet." height={height} />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={8}
        />
        <YAxis tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "#FFFFFF08" }} />
        {average != null && (
          <ReferenceLine y={average} stroke="#5A5F66" strokeDasharray="4 4" />
        )}
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message, height }: { message: string; height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-[#24262C]"
      style={{ height }}
    >
      <p className="text-xs text-[#5A5F66]">{message}</p>
    </div>
  );
}
