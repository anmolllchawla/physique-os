import { NextRequest, NextResponse } from "next/server";

// Per-photo storage in GitHub, one file per photo under photos/<id>.json.
// This keeps each request small (well under Vercel's 4.5MB body limit) instead
// of cramming every base64 image into the single main backup request.
// The GitHub token stays server-side, as with the main backup route.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.github.com";

function config() {
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

function photoPath(id: string) {
  // Sanitize the id to a safe filename.
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return `photos/${safe}.json`;
}

async function getSha(token: string, repo: string, branch: string, path: string): Promise<string | undefined> {
  const res = await fetch(
    `${API}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) return undefined;
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

// GET ?action=list → list of stored photo ids.
// GET ?id=<id> → the single photo JSON.
export async function GET(req: NextRequest) {
  const { token, repo, branch } = config();
  if (!token || !repo) return NextResponse.json({ configured: false });

  const action = req.nextUrl.searchParams.get("action");
  const id = req.nextUrl.searchParams.get("id");

  try {
    if (action === "list") {
      const res = await fetch(
        `${API}/repos/${repo}/contents/photos?ref=${encodeURIComponent(branch)}`,
        { headers: ghHeaders(token), cache: "no-store" }
      );
      if (res.status === 404) return NextResponse.json({ ids: [] });
      if (!res.ok) throw new Error(`list failed: ${res.status}`);
      const items = (await res.json()) as { name: string }[];
      const ids = items
        .filter((i) => i.name.endsWith(".json"))
        .map((i) => i.name.replace(/\.json$/, ""));
      return NextResponse.json({ ids });
    }

    if (id) {
      const path = photoPath(id);
      const res = await fetch(
        `${API}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
        { headers: ghHeaders(token), cache: "no-store" }
      );
      if (res.status === 404) return NextResponse.json({ photo: null }, { status: 404 });
      if (!res.ok) throw new Error(`read failed: ${res.status}`);
      const data = (await res.json()) as { content: string; sha: string };
      // Large files may return empty inline content → fall back to blob.
      let json: string;
      if (data.content && data.content.trim()) {
        json = Buffer.from(data.content, "base64").toString("utf-8");
      } else {
        const blobRes = await fetch(`${API}/repos/${repo}/git/blobs/${data.sha}`, {
          headers: ghHeaders(token),
          cache: "no-store",
        });
        const blob = (await blobRes.json()) as { content: string };
        json = Buffer.from(blob.content, "base64").toString("utf-8");
      }
      return NextResponse.json({ photo: JSON.parse(json) });
    }

    return NextResponse.json({ error: "Specify ?action=list or ?id=" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "photo read error" },
      { status: 500 }
    );
  }
}

// PUT { photo } → store one photo. DELETE-style handled via action=delete.
export async function PUT(req: NextRequest) {
  const { token, repo, branch } = config();
  if (!token || !repo) {
    return NextResponse.json({ error: "Not configured." }, { status: 400 });
  }

  let body: { photo?: { id?: string } & Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const photo = body.photo;
  if (!photo?.id) return NextResponse.json({ error: "Missing photo id." }, { status: 400 });

  try {
    const path = photoPath(photo.id);
    const sha = await getSha(token, repo, branch, path);
    const content = Buffer.from(JSON.stringify(photo), "utf-8").toString("base64");
    const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify({
        message: `photo ${photo.id}`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `write failed: ${res.status} ${err}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "photo write error" },
      { status: 500 }
    );
  }
}

// DELETE ?id=<id> → remove one photo file.
export async function DELETE(req: NextRequest) {
  const { token, repo, branch } = config();
  if (!token || !repo) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    const path = photoPath(id);
    const sha = await getSha(token, repo, branch, path);
    if (!sha) return NextResponse.json({ ok: true }); // already gone
    const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: ghHeaders(token),
      body: JSON.stringify({ message: `delete photo ${id}`, sha, branch }),
    });
    if (!res.ok) return NextResponse.json({ error: `delete failed: ${res.status}` }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "photo delete error" },
      { status: 500 }
    );
  }
}
