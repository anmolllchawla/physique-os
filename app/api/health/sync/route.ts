import { NextRequest, NextResponse } from "next/server";

// Step 3: pull data. The client calls this; we use the stored refresh token to
// get a fresh access token, then read the Google Health data types and return
// a normalized daily summary the client writes into IndexedDB.

const API = "https://api.github.com";
const HEALTH_PATH = "physiqueos-health.json";
const HEALTH_BASE = "https://health.googleapis.com/v4/users/me/dataTypes";

function ghHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
}

async function getRefreshToken(token: string, repo: string, branch: string): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${repo}/contents/${encodeURIComponent(HEALTH_PATH)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { content: string };
  try {
    const store = JSON.parse(Buffer.from(data.content, "base64").toString("utf-8"));
    return store.refresh_token ?? null;
  } catch {
    return null;
  }
}

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

// Pull a data type's points. Most types use the `list` endpoint; daily
// aggregate types (e.g. total-calories) only support `dailyRollUp`.
async function fetchType(
  accessToken: string,
  dataType: string,
  startISO: string,
  endISO: string,
  mode: "list" | "dailyRollUp" = "list"
): Promise<{ points: unknown[]; status: number; error?: string }> {
  let url: string;
  if (mode === "dailyRollUp") {
    // dailyRollUp aggregates by civil day over the window.
    const params = new URLSearchParams({
      "startTime.physicalTime": startISO,
      "endTime.physicalTime": endISO,
    });
    url = `${HEALTH_BASE}/${dataType}/dataPoints:dailyRollUp?${params.toString()}`;
  } else {
    // No filter: the list endpoint returns recent points by default, which is
    // what actually works (the filter syntax was being rejected → empty). We
    // pull a generous page and attribute each point to its date in the parser.
    url = `${HEALTH_BASE}/${dataType}/dataPoints?pageSize=10000`;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { points: [], status: res.status, error: text.slice(0, 300) };
  }
  const body = (await res.json()) as { dataPoints?: unknown[]; rollUps?: unknown[] };
  return { points: body.dataPoints ?? body.rollUps ?? [], status: 200 };
}

export async function GET(req: NextRequest) {
  const ghToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!ghToken || !repo) {
    return NextResponse.json({ error: "Not configured." }, { status: 400 });
  }

  const refresh = await getRefreshToken(ghToken, repo, branch);
  if (!refresh) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const access = await getAccessToken(refresh);
  if (!access) {
    // Refresh token expired (7-day testing-mode limit) → user must reconnect.
    return NextResponse.json({ error: "reconnect" }, { status: 401 });
  }

  // Window: last N days (default 3) up to now.
  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") || "3", 10), 30);
  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // [key, dataType, mode]. Calories only supports dailyRollUp. ECG/IRN use the
  // corrected singular IDs (may still be gated by Google — failures are
  // non-fatal and just return empty).
  const TYPES: [string, string, "list" | "dailyRollUp"][] = [
    ["hrv", "daily-heart-rate-variability", "list"],
    ["rhr", "daily-resting-heart-rate", "list"],
    ["sleep", "sleep", "list"],
    ["steps", "steps", "list"],
    ["calories", "total-calories", "dailyRollUp"],
    ["spo2", "daily-oxygen-saturation", "list"],
    ["resp", "daily-respiratory-rate", "list"],
    ["azm", "active-zone-minutes", "list"],
    ["ecg", "electrocardiogram", "list"],
    ["irn", "irregular-rhythm-notification", "list"],
  ];

  try {
    const results = await Promise.all(
      TYPES.map(([, dt, mode]) => fetchType(access, dt, startISO, endISO, mode))
    );

    // In debug mode, return per-type status + counts so we can see exactly
    // which calls error vs. return empty vs. return data.
    if (debug) {
      const diag: Record<string, { status: number; count: number; error?: string; sample?: unknown }> = {};
      TYPES.forEach(([key], i) => {
        const r = results[i];
        diag[key] = {
          status: r.status,
          count: r.points.length,
          error: r.error,
          sample: r.points[0],
        };
      });
      return NextResponse.json({ ok: true, debug: true, window: { startISO, endISO }, diag });
    }

    const raw: Record<string, unknown[]> = {};
    TYPES.forEach(([key], i) => {
      raw[key] = results[i].points;
    });

    return NextResponse.json({ ok: true, window: { startISO, endISO }, raw });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 }
    );
  }
}
