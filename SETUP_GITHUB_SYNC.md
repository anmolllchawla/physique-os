# GitHub Sync + Vercel Deployment Guide

PhysiqueOS works fully offline with zero setup. This guide is only for enabling
**cloud backup** — pushing your data to a private GitHub repo so it survives a
cleared browser and syncs across devices.

## How it works

- Your data lives in your browser (IndexedDB).
- "Backup now" sends a single JSON snapshot to a file in a GitHub repo.
- "Restore" pulls that file back and replaces local data.
- The GitHub token lives **only** in Vercel's server environment. The browser
  never sees it — all GitHub calls go through `/api/github`, a server route.

```
Browser (IndexedDB)  ──►  /api/github  ──►  GitHub Contents API
   your data            (holds token)        your private repo
```

## Step 1 — Create a private data repo

Create a new **private** repository, separate from the app code. For example:

```
github.com/anmolllchawla/physique-os-data
```

Keep it private. Your snapshot contains body measurements and progress photos.
You don't need to add any files — the app creates `physiqueos-backup.json` on
the first "Backup now".

## Step 2 — Create a fine-grained access token

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. **Repository access** → Only select repositories → pick your data repo.
3. **Permissions** → Repository permissions → **Contents: Read and write**.
4. Set an expiry you're comfortable with, generate, and copy the token
   (starts with `github_pat_...`). You won't see it again.

A classic token with the `repo` scope also works, but fine-grained scoped to
one repo is safer.

## Step 3 — Add environment variables in Vercel

Vercel → your project → Settings → **Environment Variables**. Add:

| Name | Value | Required |
|------|-------|----------|
| `GITHUB_TOKEN` | the token from Step 2 | yes |
| `GITHUB_REPO` | `owner/repo`, e.g. `anmolllchawla/physique-os-data` | yes |
| `GITHUB_BRANCH` | branch name | no (defaults to `main`) |
| `GITHUB_PATH` | file path in the repo | no (defaults to `physiqueos-backup.json`) |

Apply them to Production (and Preview if you want sync there too).

## Step 4 — Redeploy

Environment variables only take effect on a new deployment.

```bash
npx vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

## Step 5 — Verify

Open the app → **Settings → GitHub Sync**. It should read
"Connected to `owner/repo`". Tap **Backup now**, then check your data repo —
you'll see `physiqueos-backup.json` committed.

## Daily use

- After a workout or weigh-in, open Settings and tap **Backup now**.
- On a new device, open Settings and tap **Restore** to pull everything down.
- Prefer no cloud at all? Use **Export JSON** / **Import JSON** instead — same
  data, manual file.

## Local development with sync

To test sync locally, create `.env.local` (git-ignored):

```
GITHUB_TOKEN=github_pat_...
GITHUB_REPO=anmolllchawla/physique-os-data
```

Then `npm run dev`.

## Security notes

- Keep the data repo **private**.
- The token is server-only. It is never bundled into the client and never
  appears in network responses to the browser.
- "Restore" and "Import" **replace** all local data. Back up first if unsure.
- Rotate the token if it's ever exposed; update `GITHUB_TOKEN` in Vercel and redeploy.

## Troubleshooting

- **"Not configured"** — env vars missing or you didn't redeploy after adding them.
- **"No backup found in repo yet"** — you haven't pushed once; tap Backup now first.
- **Write failures** — token lacks Contents: write, or it's scoped to the wrong repo.
- **Photos make the file large** — photos are auto-resized, but many photos add up. GitHub allows files up to 100 MB via the API path used here; if you store hundreds of photos, prefer periodic Export JSON instead.
