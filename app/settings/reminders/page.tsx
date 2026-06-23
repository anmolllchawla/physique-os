"use client";

import { useEffect, useState } from "react";
import {
  REMINDER_DEFS,
  loadReminderPrefs,
  saveReminderPrefs,
  requestPermission,
  notificationsSupported,
  armReminders,
  expandReminderTimes,
  type ReminderKey,
  type ReminderPref,
} from "@/lib/reminders";
import { PageHeader, Section } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, AlertTriangle } from "lucide-react";
import {
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  syncReminderSchedule,
} from "@/lib/push";

export default function RemindersPage() {
  const [prefs, setPrefs] = useState<Record<ReminderKey, ReminderPref> | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [bgOn, setBgOn] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgMsg, setBgMsg] = useState<string | null>(null);

  useEffect(() => {
    loadReminderPrefs().then(setPrefs);
    if (notificationsSupported()) setPerm(Notification.permission);
    else setPerm("unsupported");
    isPushSubscribed().then(setBgOn);
  }, []);

  // Build the flat schedule the server cron uses. Interval reminders (check-in)
  // expand into one entry per fire-time so each fires at its own slot.
  const buildSchedule = (p: Record<ReminderKey, ReminderPref>) =>
    REMINDER_DEFS.flatMap((d) =>
      expandReminderTimes(d.key, p[d.key].time).map((time, i) => ({
        key: `${d.key}${i > 0 ? `_${i}` : ""}`,
        label: d.label,
        body: d.body,
        time,
        enabled: p[d.key].enabled,
      }))
    );

  // Mirror the reminder schedule to the server (for the cron job) whenever
  // background push is on.
  const pushSchedule = async (p: Record<ReminderKey, ReminderPref>) => {
    if (!bgOn) return;
    await syncReminderSchedule(buildSchedule(p));
  };

  const update = async (key: ReminderKey, patch: Partial<ReminderPref>) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: { ...prefs[key], ...patch } };
    setPrefs(next);
    await saveReminderPrefs(next);
    await armReminders();
    await pushSchedule(next);
  };

  const askPermission = async () => {
    const ok = await requestPermission();
    setPerm(ok ? "granted" : Notification.permission);
    if (ok) await armReminders();
  };

  const enableBackground = async () => {
    setBgBusy(true);
    setBgMsg(null);
    const res = await subscribeToPush();
    if (res.ok) {
      setBgOn(true);
      if (prefs) await syncReminderSchedule(buildSchedule(prefs));
      setBgMsg("Background notifications on. They'll fire even when the app is closed.");
    } else {
      setBgMsg(res.error ?? "Couldn't enable background notifications.");
    }
    setBgBusy(false);
  };

  const disableBackground = async () => {
    setBgBusy(true);
    await unsubscribeFromPush();
    setBgOn(false);
    setBgMsg("Background notifications off.");
    setBgBusy(false);
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader title="Reminders" back="/settings" />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {perm === "unsupported" ? (
          <div className="flex items-start gap-2 rounded-xl border border-[#F5B83D]/30 bg-[#F5B83D]/10 px-3.5 py-3 text-sm text-[#F5B83D]">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            This browser doesn&apos;t support notifications. Try installing the app to your home screen.
          </div>
        ) : perm !== "granted" ? (
          <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#C7F23E]" />
              <span className="text-sm font-semibold">Enable notifications</span>
            </div>
            <p className="text-xs text-[#9BA0A6]">
              Allow notifications to get daily reminders. On iPhone, add the app to your home
              screen first, then enable.
            </p>
            <Button onClick={askPermission}>Allow notifications</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[#36D399]">
            <Bell className="w-4 h-4" /> Notifications enabled
          </div>
        )}

        {/* Background notifications (Web Push) */}
        {perm === "granted" && pushSupported() && (
          <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Background notifications</span>
              <span className="text-xs font-bold" style={{ color: bgOn ? "#36D399" : "#5A5F66" }}>
                {bgOn ? "On" : "Off"}
              </span>
            </div>
            <p className="text-xs text-[#9BA0A6]">
              Fire reminders at their exact times even when the app is closed. Requires the app
              installed to your home screen and a one-time scheduler setup.
            </p>
            {bgOn ? (
              <Button variant="ghost" onClick={disableBackground} disabled={bgBusy}>
                Turn off background notifications
              </Button>
            ) : (
              <Button onClick={enableBackground} disabled={bgBusy}>
                {bgBusy ? "Enabling…" : "Enable background notifications"}
              </Button>
            )}
            {bgMsg && <p className="text-xs text-[#9BA0A6]">{bgMsg}</p>}
          </div>
        )}

        <Section label="Daily reminders">
          <div className="flex flex-col gap-2">
            {prefs &&
              REMINDER_DEFS.map((def) => {
                const pref = prefs[def.key];
                return (
                  <div
                    key={def.key}
                    className="flex items-center gap-3 rounded-2xl bg-[#121316] border border-[#24262C] p-3.5"
                  >
                    <button
                      onClick={() => update(def.key, { enabled: !pref.enabled })}
                      disabled={perm !== "granted"}
                      className="shrink-0 disabled:opacity-40"
                      aria-label={pref.enabled ? "Disable" : "Enable"}
                    >
                      {pref.enabled ? (
                        <Bell className="w-5 h-5 text-[#C7F23E]" />
                      ) : (
                        <BellOff className="w-5 h-5 text-[#5A5F66]" />
                      )}
                    </button>
                    <span className="flex-1 text-sm font-medium">{def.label}</span>
                    <input
                      type="time"
                      value={pref.time}
                      disabled={!pref.enabled || perm !== "granted"}
                      onChange={(e) => update(def.key, { time: e.target.value })}
                      className="bg-[#08090A] border border-[#24262C] rounded-lg px-2 py-1 text-sm tnums disabled:opacity-40"
                    />
                  </div>
                );
              })}
          </div>
        </Section>

        <p className="text-[11px] text-[#5A5F66] leading-relaxed">
          Reminders are scheduled locally on this device. For the most reliable delivery, install
          PhysiqueOS to your home screen. A web app can&apos;t guarantee notifications fire when
          fully closed — they&apos;re most reliable while the app has been opened that day.
        </p>
      </div>
    </main>
  );
}
