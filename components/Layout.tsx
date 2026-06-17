"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Sticky page header with optional back button and right-side slot.
export function PageHeader({
  title,
  back,
  right,
  subtitle,
}: {
  title: string;
  back?: string;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-3 bg-[#08090A]/85 backdrop-blur-xl border-b border-[#1A1C20]">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="grid place-items-center h-9 w-9 -ml-1.5 rounded-full text-[#9BA0A6] active:bg-[#1B1D22] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-[#5A5F66] -mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

// Section with a small uppercase eyebrow label.
export function Section({
  label,
  action,
  children,
  className,
}: {
  label?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {(label || action) && (
        <div className="flex items-center justify-between px-0.5">
          {label && (
            <p className="text-[11px] font-bold text-[#5A5F66] uppercase tracking-[0.12em]">
              {label}
            </p>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// The signature data card: hairline accent rule on top, big tabular value.
export function StatTile({
  label,
  value,
  unit,
  sub,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex-1 min-w-0 rounded-2xl bg-[#121316] border border-[#24262C] p-4 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute top-0 left-0 h-[2px] w-12 rounded-full"
        style={{ background: accent ?? "#C7F23E", opacity: 0.8 }}
      />
      <p className="text-[10px] font-bold text-[#9BA0A6] uppercase tracking-[0.14em]">
        {label}
      </p>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span
          className="text-[28px] leading-none font-extrabold tnums"
          style={{ color: accent ?? undefined }}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-[#5A5F66] font-semibold">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-[#5A5F66]">{sub}</div>}
    </div>
  );
}

export function Pill({
  children,
  color = "#9BA0A6",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color, backgroundColor: color + "1A" }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-14">
      <div className="grid place-items-center mx-auto mb-3 h-14 w-14 rounded-2xl bg-[#121316] border border-[#24262C]">
        <Icon className="w-6 h-6 text-[#3A3D45]" />
      </div>
      <p className="text-[#9BA0A6] text-sm font-medium">{title}</p>
      {hint && <p className="text-[#3A3D45] text-xs mt-1 max-w-[16rem] mx-auto">{hint}</p>}
    </div>
  );
}
