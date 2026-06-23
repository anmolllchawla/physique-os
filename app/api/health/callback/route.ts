import { NextRequest, NextResponse } from "next/server";

// Step 2 of OAuth: Google redirects here with ?code=. We exchange it for
// access + refresh tokens, store the refresh token in the GitHub data repo
// (server-side only), then bounce the user back into the app.

const API = "https://api.github.com";
const HEALTH_PATH = "physiqueos-health.json";

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

interface HealthStore {
  refresh_token?: string;
  connected_at?: string;
  scope?: string;
}

async function readSha(token: string, repo: string, branch: string): Promise<string | undefined> {
  const res = await fetch(
    `${API}/repos/${repo}/contents/${encodeURIComponent(HEALTH_PATH)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) return undefined;
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function writeStore(
  token: string,
  repo: string,
  branch: string,
  store: HealthStore
): Promise<void> {
  const sha = await readSha(token, repo, branch);
  const body: Record<string, unknown> = {
    message: "Update health store",
    content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(HEALTH_PATH)}`, {
    method: "PUT",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`store write failed: ${res.status}`);
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL || `https://${req.headers.get("host")}`;
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");

  if (err || !code) {
    return NextResponse.redirect(`${appUrl}/settings?health=error`);
  }

  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  const ghToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!clientId || !clientSecret || !ghToken || !repo) {
    return NextResponse.redirect(`${appUrl}/settings?health=config`);
  }

  try {
    const redirectUri = `${appUrl}/api/health/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenRes.json()) as {
      refresh_token?: string;
      scope?: string;
      error?: string;
    };

    if (!tokenRes.ok || !tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/settings?health=notoken`);
    }

    await writeStore(ghToken, repo, branch, {
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      connected_at: new Date().toISOString(),
    });

    return NextResponse.redirect(`${appUrl}/settings?health=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?health=error`);
  }
}
