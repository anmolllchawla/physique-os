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

// Pull a data type's points within [startISO, endISO]. Returns dataPoints[].
async function fetchType(
  accessToken: string,
  dataType: string,
  startISO: string,
  endISO: string
): Promise<unknown[]> {
  // Filter uses snake_case type name; endpoint uses kebab-case.
  const filterField = dataType.replace(/-/g, "_");
  const filter = `${filterField}.sample_time.physical_time >= "${startISO}" AND ${filterField}.sample_time.physical_time <= "${endISO}"`;
  const url = `${HEALTH_BASE}/${dataType}/dataPoints?pageSize=10000&filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { dataPoints?: unknown[] };
  return body.dataPoints ?? [];
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
  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") || "3", 10), 14);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  try {
    const [hrv, rhr, sleep, steps, calories, spo2, resp, azm, ecg, irn] = await Promise.all([
      fetchType(access, "daily-heart-rate-variability", startISO, endISO),
      fetchType(access, "daily-resting-heart-rate", startISO, endISO),
      fetchType(access, "sleep", startISO, endISO),
      fetchType(access, "steps", startISO, endISO),
      fetchType(access, "total-calories", startISO, endISO),
      fetchType(access, "daily-oxygen-saturation", startISO, endISO),
      fetchType(access, "daily-respiratory-rate", startISO, endISO),
      fetchType(access, "active-zone-minutes", startISO, endISO),
      fetchType(access, "ecg", startISO, endISO),
      fetchType(access, "irregular-rhythm-notifications", startISO, endISO),
    ]);

    // Hand raw arrays back to the client; it parses into daily Biometrics.
    // (Parsing client-side keeps this route generic against schema tweaks.)
    return NextResponse.json({
      ok: true,
      window: { startISO, endISO },
      raw: { hrv, rhr, sleep, steps, calories, spo2, resp, azm, ecg, irn },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 }
    );
  }
}
