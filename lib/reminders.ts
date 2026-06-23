// PhysiqueOS — Daily reminders.
//
// Local, browser-based reminders. Honest limitation: a web app can only fire
// notifications reliably while it's open (or briefly via the service worker on
// an installed PWA). We schedule today's upcoming reminders when the app is
// open and re-arm on each launch. This is "local scheduled reminders," not a
// push server — exactly the scope requested.

import { db } from "./db";

export type ReminderKey =
  | "checkin"
  | "workout"
  | "protein"
  | "water"
  | "supplement"
  | "bedtime"
  | "weekly_review"
  | "progress_photo";

export interface ReminderPref {
  enabled: boolean;
  time: string; // "HH:MM" 24h — for interval reminders this is the START time
}

// The check-in reminder is an INTERVAL reminder: it fires every N hours from
// its start time until (and not including) the end hour. Everything else is a
// single fixed-time reminder.
export const CHECKIN_INTERVAL_HOURS = 2;
export const CHECKIN_END_HOUR = 21; // stop at 9pm (bedtime takes over)

export const REMINDER_DEFS: { key: ReminderKey; label: string; defaultTime: string; body: string }[] = [
  { key: "checkin", label: "Check-in (every 2h)", defaultTime: "09:00", body: "Quick check-in — log water, fuel, and how you feel." },
  { key: "workout", label: "Workout", defaultTime: "17:00", body: "Time to train. Open your session." },
  { key: "protein", label: "Protein check", defaultTime: "14:00", body: "How's your protein? Log your fuel." },
  { key: "water", label: "Water", defaultTime: "11:00", body: "Hydrate — log your water." },
  { key: "supplement", label: "Supplements", defaultTime: "09:00", body: "Take and log your stack." },
  { key: "bedtime", label: "Bedtime", defaultTime: "21:00", body: "Wind down. Time to sleep." },
  { key: "weekly_review", label: "Weekly review", defaultTime: "10:00", body: "Review your week in PhysiqueOS." },
  { key: "progress_photo", label: "Progress photo", defaultTime: "08:00", body: "Snap today's progress photo." },
];

// Expand a reminder pref into concrete fire-times. The check-in interval
// reminder becomes multiple times (start, +2h, +4h … up to but not past the
// end hour); all others are a single time.
export function expandReminderTimes(key: ReminderKey, startTime: string): string[] {
  if (key !== "checkin") return [startTime];
  const [sh] = startTime.split(":").map(Number);
  const startMin = parseInt(startTime.split(":")[1] || "0", 10);
  const times: string[] = [];
  for (let h = sh; h < CHECKIN_END_HOUR; h += CHECKIN_INTERVAL_HOURS) {
    times.push(`${String(h).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`);
  }
  return times;
}

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

function firedKey(key: string): string {
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

    // Interval reminders (check-in) expand into several fire-times.
    const fireTimes = expandReminderTimes(def.key, pref.time);

    fireTimes.forEach((ft, idx) => {
      const [h, m] = ft.split(":").map(Number);
      const when = new Date(now);
      when.setHours(h, m, 0, 0);
      const delay = when.getTime() - now.getTime();
      if (delay <= 0) return; // already passed today

      // Per-time spam guard so each slot fires at most once/day.
      const slotKey = `${def.key}_${ft}`;
      let alreadyFired = false;
      try {
        alreadyFired = sessionStorage.getItem(firedKey(slotKey)) === "1";
      } catch {
        /* ignore */
      }
      if (alreadyFired) return;

      const t = setTimeout(() => {
        try {
          sessionStorage.setItem(firedKey(slotKey), "1");
        } catch {
          /* ignore */
        }
        if (Notification.permission === "granted") {
          if (navigator.serviceWorker?.ready) {
            navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification(`PhysiqueOS · ${def.label}`, {
                  body: def.body,
                  tag: `reminder-${def.key}-${idx}`,
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
    });
  }
}
