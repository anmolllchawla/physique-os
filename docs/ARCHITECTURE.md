# PhysiqueOS Web — Architecture

## 1. Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router) | File-based routing, RSC, best PWA support |
| Language | TypeScript 5.9, strict | Same as RN version |
| Styling | Tailwind CSS v4 | Utility-first, mobile-first, fast iteration |
| Components | shadcn/ui | Accessible, copy-paste, no npm package |
| Database | Dexie.js (IndexedDB) | 4KB wrapper over IndexedDB, async, queryable |
| Fallback | localStorage | For PWA service worker context |
| PWA | next-pwa + manifest | Installable on iPhone home screen |
| Icons | Lucide React | Already ships with shadcn/ui |
| Charts | Recharts | Lightweight, React-native API |
| Forms | React Hook Form + Zod | Validation without boilerplate |
| State | Zustand + React Query | Client state + server/async state |
| Deployment | Vercel | One-click, free tier, Edge |

## 2. Why Web Over React Native

| Concern | Web Solution |
|---------|-------------|
| Dev speed | Instant refresh, no build step, no Expo Go |
| Deployment | `git push` → live in 30 seconds |
| iPhone | PWA — app icon, fullscreen, no App Store |
| Data | IndexedDB is persistent, no AsyncStorage quirks |
| UI iteration | Tailwind is 10x faster than StyleSheet |
| Debugging | Chrome DevTools, no Metro bundler |

## 3. Data Flow

```
User Action → React Component → Zustand Store → Dexie (IndexedDB)
                    ↓                    ↓
              Optimistic UI     Query invalidation
```

Single source of truth: IndexedDB via Dexie.
Zustand for UI state (active workout session, rest timer).
No React Query needed — Dexie's `liveQuery()` provides reactivity.

## 4. PWA Architecture

```
manifest.json  →  "Add to Home Screen" prompt
sw.js          →  Offline caching (CacheFirst for static, NetworkFirst for data)
```

- App icon: 192×192 + 512×512 PNG
- Splash: solid #0A0A0A background
- Display: standalone (no browser chrome)
- Orientation: portrait
- Scope: `/`

## 5. File Structure

```
physique-os-web/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (providers, nav, PWA meta)
│   ├── page.tsx            # Dashboard
│   ├── globals.css         # Tailwind + dark mode
│   ├── manifest.ts         # PWA manifest
│   ├── workout/
│   │   ├── page.tsx        # Templates list + active session
│   │   ├── [id]/page.tsx   # Active workout session
│   │   └── templates/
│   │       ├── page.tsx    # Template management
│   │       └── [id]/page.tsx # Edit template
│   ├── body/page.tsx       # Bodyweight tracking
│   ├── checkin/page.tsx    # Daily check-in
│   └── analytics/page.tsx  # Progress analytics
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── dashboard/          # MetricCard, RecentWorkout, QuickActions
│   ├── workout/            # SetLogger, RestTimer, ExerciseCard
│   ├── body/               # WeightChart, WeightForm
│   └── checkin/            # RatingInput, ReadinessDisplay
├── lib/
│   ├── db.ts               # Dexie database definition
│   ├── seed.ts             # Default exercises + templates
│   ├── scoring.ts          # Readiness score calculator
│   ├── progression.ts      # Double progression logic
│   └── utils.ts            # Date formatting, ID generation
├── store/
│   ├── useWorkoutStore.ts  # Active workout session state
│   └── useSettingsStore.ts # User preferences
├── hooks/
│   ├── useCheckIn.ts       # Check-in queries + mutations
│   ├── useBodyweight.ts    # Weight queries + mutations
│   ├── useWorkout.ts       # Workout queries + mutations
│   └── useDashboard.ts     # Aggregated dashboard data
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── sw.js
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 6. Design System

Same as React Native:
- Background: #0A0A0A
- Surface: #1A1A1A
- Surface Elevated: #252525
- Primary: #3B82F6
- Success: #22C55E
- Warning: #F59E0B
- Danger: #EF4444
- Text Primary: #FAFAFA
- Text Secondary: #A1A1AA
- Text Muted: #52525B
- Border: #2A2A2A

Dark mode only. Tailwind dark-class strategy by default.

## 7. Constraints

- No server rendering needed (fully client-side after initial load)
- No API routes (no backend)
- All data local to the browser
- Must work offline after first visit
- Must be installable as PWA on iOS Safari
