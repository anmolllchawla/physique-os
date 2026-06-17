// PhysiqueOS — GitHub sync (server-side)
//
// Stores your backup JSON as a single file in a private GitHub repo via the
// Contents API. The token lives ONLY in server env vars and never reaches the
// browser. Configure these in Vercel → Project → Settings → Environment Vars:
//
//   GITHUB_TOKEN   fine-grained PAT with "Contents: Read and write" on the repo
//   GITHUB_REPO    "owner/repo"   e.g. "anmolllchawla/physique-os-data"
//   GITHUB_BRANCH  optional, defaults to "main"
//   GITHUB_PATH    optional, defaults to "physiqueos-backup.json"
//
// Use a SEPARATE PRIVATE repo for data (not the public app repo) — your
// snapshot contains body stats and progress photos.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.github.com";

function config() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.GITHUB_PATH || "physiqueos-backup.json";
  return { token, repo, branch, path };
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "physiqueos",
  };
}

async function getExisting(token: string, repo: string, path: string, branch: string) {
  const res = await fetch(
    `${API}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  return res.json() as Promise<{ sha: string; content: string; encoding: string }>;
}

// GET            → status (configured?, repo, last commit time)
// GET ?action=pull → returns { snapshot }
export async function GET(req: NextRequest) {
  const { token, repo, branch, path } = config();
  if (!token || !repo) {
    return NextResponse.json({ configured: false });
  }

  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "pull") {
      const existing = await getExisting(token, repo, path, branch);
      if (!existing) return NextResponse.json({ snapshot: null }, { status: 404 });
      const json = Buffer.from(existing.content, "base64").toString("utf-8");
      return NextResponse.json({ snapshot: JSON.parse(json) });
    }

    // status
    let last_commit: string | null = null;
    const commits = await fetch(
      `${API}/repos/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=1`,
      { headers: ghHeaders(token), cache: "no-store" }
    );
    if (commits.ok) {
      const arr = await commits.json();
      last_commit = arr?.[0]?.commit?.committer?.date ?? null;
    }
    return NextResponse.json({ configured: true, repo, path, last_commit });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT { snapshot } → commits the snapshot to the repo
export async function PUT(req: NextRequest) {
  const { token, repo, branch, path } = config();
  if (!token || !repo) {
    return NextResponse.json(
      { error: "GitHub sync not configured. Set GITHUB_TOKEN and GITHUB_REPO." },
      { status: 400 }
    );
  }

  let body: { snapshot?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.snapshot) {
    return NextResponse.json({ error: "Missing snapshot" }, { status: 400 });
  }

  try {
    const existing = await getExisting(token, repo, path, branch);
    const content = Buffer.from(JSON.stringify(body.snapshot, null, 2), "utf-8").toString("base64");

    const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify({
        message: `PhysiqueOS backup ${new Date().toISOString()}`,
        content,
        branch,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `GitHub write failed: ${res.status} ${err}` }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json({ ok: true, sha: json?.content?.sha ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
