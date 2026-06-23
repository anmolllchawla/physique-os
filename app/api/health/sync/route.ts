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

// Pull a data type's points. In debug mode, drops the filter so we can see
// whether data exists at all (and surfaces the real HTTP error if one occurs).
async function fetchType(
  accessToken: string,
  dataType: string,
  startISO: string,
  endISO: string,
  debug = false
): Promise<{ points: unknown[]; status: number; error?: string }> {
  // Filter uses snake_case type name; endpoint uses kebab-case.
  const filterField = dataType.replace(/-/g, "_");
  const filter = `${filterField}.sample_time.physical_time >= "${startISO}" AND ${filterField}.sample_time.physical_time <= "${endISO}"`;
  const qs = debug
    ? `pageSize=100`
    : `pageSize=10000&filter=${encodeURIComponent(filter)}`;
  const url = `${HEALTH_BASE}/${dataType}/dataPoints?${qs}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { points: [], status: res.status, error: text.slice(0, 300) };
  }
  const body = (await res.json()) as { dataPoints?: unknown[] };
  return { points: body.dataPoints ?? [], status: 200 };
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

  const TYPES: [string, string][] = [
    ["hrv", "daily-heart-rate-variability"],
    ["rhr", "daily-resting-heart-rate"],
    ["sleep", "sleep"],
    ["steps", "steps"],
    ["calories", "total-calories"],
    ["spo2", "daily-oxygen-saturation"],
    ["resp", "daily-respiratory-rate"],
    ["azm", "active-zone-minutes"],
    ["ecg", "ecg"],
    ["irn", "irregular-rhythm-notifications"],
  ];

  try {
    const results = await Promise.all(
      TYPES.map(([, dt]) => fetchType(access, dt, startISO, endISO, debug))
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
