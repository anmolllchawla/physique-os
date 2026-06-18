// PhysiqueOS — Daily reminders.
//
// Local, browser-based reminders. Honest limitation: a web app can only fire
// notifications reliably while it's open (or briefly via the service worker on
// an installed PWA). We schedule today's upcoming reminders when the app is
// open and re-arm on each launch. This is "local scheduled reminders," not a
// push server — exactly the scope requested.

import { db } from "./db";

export type ReminderKey =
  | "workout"
  | "protein"
  | "water"
  | "supplement"
  | "bedtime"
  | "weekly_review"
  | "progress_photo";

export interface ReminderPref {
  enabled: boolean;
  time: string; // "HH:MM" 24h
}

export const REMINDER_DEFS: { key: ReminderKey; label: string; defaultTime: string; body: string }[] = [
  { key: "workout", label: "Workout", defaultTime: "17:00", body: "Time to train. Open your session." },
  { key: "protein", label: "Protein check", defaultTime: "14:00", body: "How's your protein? Log your fuel." },
  { key: "water", label: "Water", defaultTime: "11:00", body: "Hydrate — log your water." },
  { key: "supplement", label: "Supplements", defaultTime: "09:00", body: "Take and log your stack." },
  { key: "bedtime", label: "Bedtime", defaultTime: "22:30", body: "Wind down. Protect your sleep." },
  { key: "weekly_review", label: "Weekly review", defaultTime: "10:00", body: "Review your week in PhysiqueOS." },
  { key: "progress_photo", label: "Progress photo", defaultTime: "08:00", body: "Snap today's progress photo." },
];

const SETTING_KEY = "reminders";

export async function loadReminderPrefs(): Promise<Record<ReminderKey, ReminderPref>> {
  const row = await db.settings.get(SETTING_KEY);
  const defaults = Object.fromEntries(
    REMINDER_DEFS.map((d) => [d.key, { enabled: false, time: d.defaultTime }])
  ) as Record<ReminderKey, ReminderPref>;
  if (!row?.value) return defaults;
  try {
    const saved = JSON.parse(row.value) as Partial<Record<ReminderKey, ReminderPref>>;
    return { ...defaults, ...saved } as Record<ReminderKey, ReminderPref>;
  } catch {
    return defaults;
  }
}

export async function saveReminderPrefs(prefs: Record<ReminderKey, ReminderPref>): Promise<void> {
  await db.settings.put({ key: SETTING_KEY, value: JSON.stringify(prefs) });
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

// In-session scheduling. Clears prior timers and arms reminders that are still
// upcoming today. Called on app launch and whenever prefs change. Avoids spam
// by firing each reminder at most once per day (tracked in sessionStorage).
let timers: ReturnType<typeof setTimeout>[] = [];

function firedKey(key: ReminderKey): string {
  return `reminder_fired_${new Date().toISOString().slice(0, 10)}_${key}`;
}

export async function armReminders(): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  // Clear existing.
  timers.forEach((t) => clearTimeout(t));
  timers = [];

  const prefs = await loadReminderPrefs();
  const now = new Date();

  for (const def of REMINDER_DEFS) {
    const pref = prefs[def.key];
    if (!pref?.enabled) continue;

    const [h, m] = pref.time.split(":").map(Number);
    const when = new Date(now);
    when.setHours(h, m, 0, 0);
    const delay = when.getTime() - now.getTime();
    if (delay <= 0) continue; // already passed today

    let alreadyFired = false;
    try {
      alreadyFired = sessionStorage.getItem(firedKey(def.key)) === "1";
    } catch {
      /* ignore */
    }
    if (alreadyFired) continue;

    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(firedKey(def.key), "1");
      } catch {
        /* ignore */
      }
      if (Notification.permission === "granted") {
        if (navigator.serviceWorker?.ready) {
          navigator.serviceWorker.ready
            .then((reg) =>
              reg.showNotification(`PhysiqueOS · ${def.label}`, {
                body: def.body,
                tag: `reminder-${def.key}`,
                icon: "/icon-192.png",
              })
            )
            .catch(() => new Notification(`PhysiqueOS · ${def.label}`, { body: def.body }));
        } else {
          new Notification(`PhysiqueOS · ${def.label}`, { body: def.body });
        }
      }
    }, delay);
    timers.push(t);
  }
}
