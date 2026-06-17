// PhysiqueOS Web — Settings hook
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { WeightUnit } from "@/lib/utils";

const DEFAULTS = {
  weight_unit: "lbs" as WeightUnit,
  measurement_unit: "in" as "in" | "cm",
  name: "",
  auto_sync: "off" as "off" | "on",
};

export type SettingKey = keyof typeof DEFAULTS;

export function useSettings() {
  const rows = useLiveQuery(() => db.settings.toArray(), []) ?? [];
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const weight_unit = (map.get("weight_unit") as WeightUnit) ?? DEFAULTS.weight_unit;
  const measurement_unit = (map.get("measurement_unit") as "in" | "cm") ?? DEFAULTS.measurement_unit;
  const name = map.get("name") ?? DEFAULTS.name;
  const auto_sync = (map.get("auto_sync") as "off" | "on") ?? DEFAULTS.auto_sync;

  return { weight_unit, measurement_unit, name, auto_sync };
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
