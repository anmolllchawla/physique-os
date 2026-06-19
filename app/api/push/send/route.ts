import { NextRequest, NextResponse } from "next/server";
import * as webpush from "web-push";

// Pinged by an external scheduler (cron-job.org) on a schedule (e.g. every
// 5 min). Reads the push store from the GitHub data repo, finds reminders due
// in the current window, and sends them to all subscriptions.
//
// Security: requires a secret (CRON_SECRET) so randoms can't trigger pushes.

const API = "https://api.github.com";
const PUSH_PATH = "physiqueos-push.json";
const WINDOW_MIN = 10; // fire reminders whose time falls within the last N minutes

interface PushStore {
  subscriptions: PushSubscriptionJSON[];
  reminders: { key: string; label: string; time: string; body: string; enabled: boolean }[];
}

function ghHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
}

async function readStore(token: string, repo: string, branch: string): Promise<PushStore | null> {
  const res = await fetch(
    `${API}/repos/${repo}/contents/${encodeURIComponent(PUSH_PATH)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { content: string };
  try {
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function minutesSinceMidnight(d: Date, tzOffsetMin: number): number {
  // Convert to the user's local time using a fixed offset (minutes).
  const utc = d.getUTCHours() * 60 + d.getUTCMinutes();
  let local = utc + tzOffsetMin;
  local = ((local % 1440) + 1440) % 1440;
  return local;
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@physiqueos.app";

  if (!token || !repo || !pub || !priv) {
    return NextResponse.json({ error: "Not configured." }, { status: 400 });
  }

  // User's timezone offset in minutes (e.g. Vancouver PDT = -420). Defaults to
  // the value set in env; can be overridden per-call with ?tz=.
  const tzOffsetMin = parseInt(
    req.nextUrl.searchParams.get("tz") || process.env.REMINDER_TZ_OFFSET || "-420",
    10
  );

  const store = await readStore(token, repo, branch);
  if (!store || store.subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "No subscriptions." });
  }

  const now = minutesSinceMidnight(new Date(), tzOffsetMin);
  const due = store.reminders.filter((r) => {
    if (!r.enabled) return false;
    const [h, m] = r.time.split(":").map(Number);
    const rm = h * 60 + m;
    const diff = now - rm;
    return diff >= 0 && diff < WINDOW_MIN;
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  webpush.setVapidDetails(subject, pub, priv);

  let sent = 0;
  for (const r of due) {
    const payload = JSON.stringify({
      title: `PhysiqueOS · ${r.label}`,
      body: r.body,
      tag: `reminder-${r.key}`,
    });
    for (const sub of store.subscriptions) {
      try {
        // web-push accepts the PushSubscriptionJSON shape directly.
        await webpush.sendNotification(sub as unknown as webpush.PushSubscription, payload);
        sent++;
      } catch {
        // Expired/invalid subscriptions are ignored here; they get cleaned up
        // when the client re-subscribes.
      }
    }
  }

  return NextResponse.json({ ok: true, sent, due: due.map((d) => d.key) });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
