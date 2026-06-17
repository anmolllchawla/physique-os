// PhysiqueOS — Rest timer notifications.
//
// A web app's JS is suspended when the phone locks or you switch apps, so a
// ticking countdown can't alert you. Instead we ask the OS to hold the alarm:
// when rest starts we schedule a notification keyed to the end time. The
// service worker (or a fallback in-page timer) fires it. This is the only
// "background alert" a PWA gets on iOS — and it requires the app be installed
// to the home screen (iOS 16.4+) and notification permission granted.

let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

// Schedule the "rest complete" notification at `endTime` (epoch ms).
// Uses the service worker if available (survives backgrounding on installed
// PWAs); otherwise falls back to an in-page timeout (works while app is open).
export async function scheduleRestEndNotification(endTime: number, label?: string): Promise<void> {
  cancelRestNotification();
  if (!notificationsSupported() || Notification.permission !== "granted") return;

  const delay = endTime - Date.now();
  if (delay <= 0) return;

  const title = "Rest complete";
  const body = label ? `Time for your next set — ${label}` : "Time for your next set.";

  // Preferred path: ask the service worker to fire it. We message the SW with
  // the target time; the SW sets its own timer (more resilient than the page).
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type: "SCHEDULE_REST_NOTIFICATION",
          endTime,
          title,
          body,
        });
        // Also set an in-page fallback in case the SW is evicted while open.
        fallbackTimeout = setTimeout(() => {
          if (Notification.permission === "granted" && document.hidden) {
            reg.showNotification(title, { body, tag: "rest-timer", icon: "/icon-192.png" });
          }
        }, delay);
        return;
      }
    } catch {
      // fall through to in-page fallback
    }
  }

  // Fallback: in-page timeout. Only fires while the page is alive.
  fallbackTimeout = setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(title, { body, tag: "rest-timer", icon: "/icon-192.png" });
    }
  }, delay);
}

export function cancelRestNotification(): void {
  if (fallbackTimeout) {
    clearTimeout(fallbackTimeout);
    fallbackTimeout = null;
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ type: "CANCEL_REST_NOTIFICATION" }))
      .catch(() => {});
  }
}
