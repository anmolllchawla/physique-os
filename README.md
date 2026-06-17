# PhysiqueOS

A local-first physique tracker PWA — workouts, bodyweight, measurements, progress
photos, daily readiness, and analytics. Everything lives in your browser
(IndexedDB). Optional one-tap backup to a private GitHub repo so your data
survives a cleared browser and follows you across devices.

Built with Next.js 16, Dexie.js, shadcn/ui, Tailwind CSS, Recharts, and Zustand.

## Features

- **Dashboard** — Greeting, readiness score, weight/sleep metrics, quick-start templates, settings.
- **Workout logging** — Template-based sessions, set-by-set logging, rest timer, double-progression engine. Shows your **last session's numbers and a progression suggestion** for each exercise so you know what to beat.
- **Template manager** — Create / edit / delete custom templates from an exercise library.
- **Daily check-in** — Sleep, energy, stress, motivation, soreness, appetite → readiness score. One record per day (re-saving overwrites).
- **Body section**
  - **Bodyweight** — Log weight with a 90-day trend chart and per-entry deltas.
  - **Measurements** — 11 circumferences + body fat %, with history.
  - **Progress photos** — Front / side / back / other, auto-resized, stored privately on device.
- **Progress analytics** — Real charts: bodyweight line, weekly training volume bars, readiness line. Plus PRs (e1RM), weekly summary, and consistency.
- **Settings** — Units (lbs/kg, in/cm), name, GitHub sync, JSON export/import, reset.
- **PWA** — Installable on iPhone/Android, works offline. The service worker is now actually registered (production builds).
- **Supplements** — Manual tracker for supplements, peptides, and medications with a daily checklist and a 90-day adherence heatmap. Tracking only — no dosing advice.
- **Workout history** — Tap any past session for a full read-only breakdown (sets, volume, e1RM, duration).
- **Weekly review** — Week-over-week stats for training, readiness, weight, and supplement adherence, with prev/next week navigation.
- **AI Coach** *(optional)* — A chat coach powered by DeepSeek. Calls run **server-side only** via `/api/agent`; your API key never reaches the browser. You toggle per-chat whether to share a summary of your data. Coaching and tracking only — no medical or dosing advice.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Data & privacy

All data is stored locally in IndexedDB. Two backup options:

1. **Manual JSON** — Settings → Export / Import. A single file with everything (including photos as base64).
2. **GitHub sync** — Settings → Backup now / Restore. Pushes the same JSON to a private repo via a serverless route. **Your token never reaches the browser.**

Your snapshot includes body stats and progress photos. If you use GitHub sync,
use a **private** repo for the data — ideally separate from the app's code repo.

## GitHub sync setup (optional)

See **SETUP_GITHUB_SYNC.md** for the full walkthrough. In short:

1. Create a **private** data repo (e.g. `you/physique-os-data`).
2. Create a fine-grained personal access token with **Contents: Read and write** scoped to that repo.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `GITHUB_TOKEN` — the token
   - `GITHUB_REPO` — `owner/repo`
   - `GITHUB_BRANCH` — optional, defaults to `main`
   - `GITHUB_PATH` — optional, defaults to `physiqueos-backup.json`
4. Redeploy. The Settings page will show "Connected".

## AI Coach setup (optional)

The coach uses DeepSeek and is off until you add a key.

1. Get an API key at platform.deepseek.com.
2. Add it to your environment **server-side only** (never `NEXT_PUBLIC_`):
   - Local: create `.env.local` with `DEEPSEEK_API_KEY=sk-...`
   - Vercel: Project → Settings → Environment Variables → `DEEPSEEK_API_KEY`
3. Redeploy (or restart `npm run dev`). The `/coach` page activates automatically.

Optional overrides: `DEEPSEEK_MODEL` (default `deepseek-chat`), `DEEPSEEK_BASE_URL`
(default `https://api.deepseek.com`).

The key is read only inside the `/api/agent` route handler on the server. The
frontend posts your message (and an optional data summary, if you leave the
toggle on) to that route — it never talks to DeepSeek directly.

## Deploy to Vercel

```bash
npx vercel --prod
# or push to GitHub and import at vercel.com/new (zero config)
```

The app works with no environment variables (local-only). Add the GitHub vars
above only if you want cloud backup.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| Database | IndexedDB via Dexie.js (schema v2) |
| State | Zustand + dexie-react-hooks |
| Sync | GitHub Contents API via a Next.js Route Handler |
| PWA | Service Worker + Web Manifest |

## Data model (IndexedDB, v2)

| Table | Key | Notes |
|-------|-----|-------|
| exercises | id | category index |
| workoutTemplates | id | is_active |
| templateExercises | id | [template_id+sort_order] |
| workoutSessions | id | started_at, completed_at |
| exerciseLogs | id | session_id, exercise_id |
| dailyCheckins | id | **&date** (unique — one per day) |
| bodyweightLogs | id | **&date** (unique — one per day) |
| measurements | id | **&date** (unique — one per day) |
| progressPhotos | id | date, pose |
| settings | key | units, name |

The v1→v2 migration de-duplicates any pre-existing duplicate-per-day rows.

## License

MIT
