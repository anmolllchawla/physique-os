// PhysiqueOS — Web Push (client side).
//
// Background notifications require: (1) an installed PWA on iOS 16.4+, (2) a
// push subscription registered with the server, and (3) an external scheduler
// (cron-job.org) pinging /api/push/send at the times reminders are due. This
// module handles the client subscription; the server holds the subscription +
// schedule in the GitHub data repo (no database).

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Fetch the server's VAPID public key (safe to expose).
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push");
    if (!res.ok) return null;
    const data = await res.json();
    return data.vapidPublicKey ?? null;
  } catch {
    return null;
  }
}

// Subscribe this device and register with the server. Returns true on success.
export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "Push isn't supported on this browser." };
  if (Notification.permission === "denied") {
    return { ok: false, error: "Notifications are blocked. Enable them in your settings." };
  }
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "Notification permission was not granted." };
  }

  const vapid = await getVapidPublicKey();
  if (!vapid) return { ok: false, error: "Push isn't configured on the server yet." };

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      }));

    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription: sub }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "Couldn't register with the server." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Subscription failed." };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
}

// Push the current reminder schedule to the server so the cron job knows the
// times. Reminders are stored locally; this mirrors the times server-side.
export async function syncReminderSchedule(
  reminders: { key: string; label: string; time: string; body: string; enabled: boolean }[]
): Promise<void> {
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "schedule", reminders }),
    });
  } catch {
    /* ignore */
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}
