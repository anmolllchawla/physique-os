# PhysiqueOS Web — MVP Roadmap

## Phase 1: Foundation + Dashboard

**Goal:** Scaffold the project, set up data layer, build dashboard. PWA installable.

### Tasks
- [ ] `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- [ ] Install shadcn/ui (components: button, card, input, badge)
- [ ] Install Dexie.js
- [ ] Set up dark mode Tailwind config (dark-only)
- [ ] Create `lib/db.ts` — Dexie schema for all 7 tables
- [ ] Create `lib/seed.ts` — 24 exercises + 6 default templates
- [ ] Create `lib/utils.ts` — ID generation, date formatting
- [ ] Create `lib/scoring.ts` — readiness score calculator
- [ ] Build Dashboard page (`/`)
  - [ ] DashboardHeader with greeting + date
  - [ ] ReadinessBadge (if check-in exists)
  - [ ] MetricCard component (weight, sleep)
  - [ ] QuickActions (check-in + weight log links)
- [ ] Build `components/ui/MetricCard.tsx`
- [ ] Create PWA manifest (`app/manifest.ts`)
- [ ] Add `public/sw.js` for offline caching
- [ ] Test: `npm run dev` → dashboard renders on iPhone Safari
- [ ] Test: "Add to Home Screen" works

**Ship criteria:** Open URL on iPhone → see dashboard with today's date → "Add to Home Screen" → app icon on home screen.

---

## Phase 2: Workout System

**Goal:** Full workout logging — templates, active sessions, set tracking.

### Tasks
- [ ] Build `/workout` — template list + recent sessions
- [ ] Build `/workout/[id]` — active workout session
  - [ ] Exercise card with target info
  - [ ] Set logger form (weight, reps, RPE, warmup)
  - [ ] Rest timer (countdown + skip)
  - [ ] Exercise progression (next/previous)
  - [ ] Complete workout flow
- [ ] Build `/workout/templates` — template CRUD
- [ ] Build `/workout/templates/[id]` — exercise management
- [ ] `hooks/useWorkout.ts` — Dexie queries + mutations
- [ ] `store/useWorkoutStore.ts` — active session state
- [ ] Double progression logic (`lib/progression.ts`)

**Ship criteria:** Start a workout → log sets → rest timer → finish workout → see it in recent sessions.

---

## Phase 3: Check-Ins + Body Tracking

**Goal:** Daily check-in flow + bodyweight logging with chart.

### Tasks
- [ ] Build `/checkin` — 6 metrics + readiness score
- [ ] Build `/body` — weight chart + log + history
- [ ] `hooks/useCheckIn.ts`
- [ ] `hooks/useBodyweight.ts`
- [ ] Install Recharts for weight chart
- [ ] RatingInput component (1-5 selector)

**Ship criteria:** Complete a check-in → see score → log weight → see chart update.

---

## Phase 4: Analytics

**Goal:** Progress visualization — trends, streaks, insights.

### Tasks
- [ ] Build `/analytics` page
- [ ] Weekly streak tracker
- [ ] Readiness score chart (30 days)
- [ ] Weight trend chart (90 days)
- [ ] Training volume chart (by week)
- [ ] All-time PRs display

**Ship criteria:** See your training history visualized with charts.

---

## Phase 5: Polish + Deploy

**Goal:** Production-ready, fast, reliable.

### Tasks
- [ ] PWA install prompt (custom banner)
- [ ] Offline indicator
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Vercel deployment
- [ ] Custom domain (optional)
- [ ] Lighthouse audit → 90+ PWA score

**Ship criteria:** `git push` → live on Vercel → install as PWA on iPhone → works offline.
