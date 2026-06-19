import { NextRequest, NextResponse } from "next/server";

// Stores push subscriptions + reminder schedule in the GitHub data repo (no
// database). The cron endpoint (/api/push/send) reads this to fire reminders.

const API = "https://api.github.com";
const PUSH_PATH = "physiqueos-push.json";

function ghConfig() {
  return {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export interface PushStore {
  subscriptions: PushSubscriptionJSON[];
  reminders: { key: string; label: string; time: string; body: string; enabled: boolean }[];
}

async function readStore(token: string, repo: string, branch: string): Promise<{ store: PushStore; sha?: string }> {
  const res = await fetch(
    `${API}/repos/${repo}/contents/${encodeURIComponent(PUSH_PATH)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (res.status === 404) return { store: { subscriptions: [], reminders: [] } };
  if (!res.ok) throw new Error(`read failed: ${res.status}`);
  const data = (await res.json()) as { content: string; sha: string };
  try {
    const json = Buffer.from(data.content, "base64").toString("utf-8");
    return { store: JSON.parse(json), sha: data.sha };
  } catch {
    return { store: { subscriptions: [], reminders: [] }, sha: data.sha };
  }
}

async function writeStore(
  token: string,
  repo: string,
  branch: string,
  store: PushStore,
  sha?: string
): Promise<void> {
  const body: Record<string, unknown> = {
    message: "Update push store",
    content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(PUSH_PATH)}`, {
    method: "PUT",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`write failed: ${res.status}`);
}

// GET → return the VAPID public key (safe to expose) and whether push is set up.
export async function GET() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? null;
  return NextResponse.json({
    configured: !!vapidPublicKey && !!process.env.VAPID_PRIVATE_KEY,
    vapidPublicKey,
  });
}

export async function POST(req: NextRequest) {
  const { token, repo, branch } = ghConfig();
  if (!token || !repo) {
    return NextResponse.json({ error: "GitHub sync isn't configured." }, { status: 400 });
  }

  let body: {
    action?: "subscribe" | "unsubscribe" | "schedule";
    subscription?: PushSubscriptionJSON;
    endpoint?: string;
    reminders?: PushStore["reminders"];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const { store, sha } = await readStore(token, repo, branch);

    if (body.action === "subscribe" && body.subscription) {
      const endpoint = body.subscription.endpoint;
      const exists = store.subscriptions.some((s) => s.endpoint === endpoint);
      if (!exists) store.subscriptions.push(body.subscription);
    } else if (body.action === "unsubscribe" && body.endpoint) {
      store.subscriptions = store.subscriptions.filter((s) => s.endpoint !== body.endpoint);
    } else if (body.action === "schedule" && body.reminders) {
      store.reminders = body.reminders;
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await writeStore(token, repo, branch, store, sha);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Push store error." },
      { status: 500 }
    );
  }
}
