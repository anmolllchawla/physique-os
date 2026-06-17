# PhysiqueOS Web — Page Map

## Navigation Structure

```
┌─────────────────────────────────────────────────┐
│                   Bottom Nav                     │
│  🏠 Home  │ 🏋️ Train │ 📊 Body │ 💭 Check │ 📈 │
└─────────────────────────────────────────────────┘
```

5-tab bottom navigation (mobile-first, max 5 items).

## Routes

| Route | Page | Tab | Description |
|-------|------|-----|-------------|
| `/` | Dashboard | 🏠 Home | Today's summary: workout status, weight, readiness score, quick actions |
| `/workout` | Workout Hub | 🏋️ Train | Templates list + "Start Workout" + recent sessions |
| `/workout/[id]` | Active Session | — | Log sets, rest timer, exercise progression |
| `/workout/templates` | Template Manager | — | Create/edit/delete workout templates |
| `/workout/templates/[id]` | Edit Template | — | Manage exercises in a template |
| `/body` | Body Tracking | 📊 Body | Weight log + 90-day chart + stats |
| `/checkin` | Daily Check-In | 💭 Check | 6-metric check-in form with readiness score |
| `/analytics` | Analytics | 📈 | Progress charts, streaks, trends (Phase 4) |

## Screen Flows

### 1. Start Workout
```
/workout → tap "Start" on template → /workout/[id]
  → Log Set → Rest Timer → Next Exercise → Finish → /workout
```

### 2. Daily Check-In
```
/ → tap "Check-In" → /checkin
  → Rate 6 metrics → See readiness score → Save → /
```

### 3. Log Weight
```
/body → tap "Log Weight" → enter value → Save → chart updates
```

### 4. Manage Templates
```
/workout → tap "Manage" → /workout/templates
  → "New" → name + category → Create
  → Tap template → /workout/templates/[id]
    → Add exercise from library
    → Edit sets/reps/rest/RPE
    → Remove exercise
```

## Navigation Rules

- Dashboard is always reachable via Home tab
- Active workout suppresses nav (fullscreen session mode)
- Check-in is a modal-style screen (new each day)
- All screens work offline
- Back navigation via browser back or gesture
