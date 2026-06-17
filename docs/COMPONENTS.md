# PhysiqueOS Web — Component Hierarchy

## Legend
- `[P]` = Page component (one per route)
- `[C]` = Container component
- `[UI]` = Primitive (shadcn/ui or custom)

## Tree

```
RootLayout [P]
├── Providers
│   ├── ThemeProvider (dark mode only)
│   └── PWAInstallPrompt
├── BottomNav [C]
│   ├── NavItem (Home)
│   ├── NavItem (Train)
│   ├── NavItem (Body)
│   ├── NavItem (Check)
│   └── NavItem (Stats)
└── Page Content

─────────────────────────────────────

DashboardPage [P]  /
├── DashboardHeader [C]
│   ├── Greeting text
│   ├── Date display
│   └── ReadinessBadge [C] (color-coded score circle)
├── TodaysWorkout [C]
│   ├── ActiveWorkoutBanner [C] (if workout in progress)
│   │   ├── Workout name + progress
│   │   └── Button "Resume"
│   └── NoWorkoutCard [C] (if no workout today)
│       └── QuickStartButtons → template list
├── QuickMetrics [C]
│   ├── MetricCard [UI] (Weight)
│   └── MetricCard [UI] (Sleep)
└── QuickActions [C]
    ├── Button "Daily Check-In" → /checkin
    └── Button "Log Weight" → /body

─────────────────────────────────────

WorkoutHubPage [P]  /workout
├── ActiveWorkoutBanner [C] (if session in progress)
├── Section "Templates"
│   ├── TemplateCard [C] × N
│   │   ├── Name + category badge
│   │   └── Button "Start"
│   └── Link "Manage" → /workout/templates
├── Section "Recent"
│   └── SessionRow [C] × N
└── Section "PRs"
    └── PRRow [C] × N

─────────────────────────────────────

ActiveWorkoutPage [P]  /workout/[id]
├── WorkoutHeader [C]
│   ├── Cancel button
│   ├── Workout name
│   └── Progress (2/6)
├── RestTimer [C] (when resting)
│   ├── Countdown display
│   └── Skip button
├── ExerciseCard [C]
│   ├── Exercise name + target info
│   ├── SetHistory [C] (sets logged so far)
│   │   └── SetRow [C] × N
│   └── Button "Log Set #N"
├── SetLogger [C] (expandable form)
│   ├── Input: Weight (lbs)
│   ├── Input: Reps
│   ├── Input: RPE
│   ├── Checkbox: Warmup
│   └── Actions: Cancel / Log & Rest
├── Button "Next Exercise" / "Finish Workout"
└── ProgressDots [C]

─────────────────────────────────────

TemplateManagerPage [P]  /workout/templates
├── Header + "New" button
├── TemplateList [C]
│   └── TemplateRow [C] × N
│       ├── Name + category
│       ├── Edit button → /workout/templates/[id]
│       └── Delete button
└── CreateModal [C]
    ├── Input: Name
    └── CategoryPicker [C]

─────────────────────────────────────

EditTemplatePage [P]  /workout/templates/[id]
├── NameEditor [C]
├── ExerciseList [C]
│   └── TemplateExerciseRow [C] × N
│       ├── Exercise name + params
│       ├── Edit button (inline form)
│       └── Remove button
├── Button "Add Exercise"
└── AddExerciseModal [C]
    └── Exercise search + list

─────────────────────────────────────

BodyPage [P]  /body
├── WeightChart [C] (Recharts line chart, 90 days)
├── WeightStats [C]
│   ├── MetricCard (Current)
│   ├── MetricCard (90d Avg)
│   ├── MetricCard (Trend)
│   └── MetricCard (Range)
├── WeightForm [C]
│   ├── Input: Weight
│   └── Button: Save
└── WeightHistory [C]
    └── WeightRow [C] × N

─────────────────────────────────────

CheckInPage [P]  /checkin
├── Header + Close
├── SleepSection [C]
│   ├── Input: Hours
│   └── RatingInput [C] (Quality 1-5)
├── MetricSection [C] × 5
│   ├── Label + Emoji
│   └── RatingInput [C] (1-5)
├── NotesInput [C]
├── ReadinessPreview [C]
│   ├── Score (0-100%)
│   └── Label (Peak / Ready / Moderate / Fatigued / Rest Day)
└── Button "Save Check-In"

─────────────────────────────────────

AnalyticsPage [P]  /analytics
├── WeeklyStreak [C]
├── ReadinessChart [C]
├── WeightTrendChart [C]
├── VolumeByWeek [C]
└── ExerciseProgression [C]

─────────────────────────────────────

## Shared Primitives [UI]
- MetricCard — label + value + unit + trend indicator
- Button — primary/secondary/ghost/danger variants
- Card — surface container with border
- Input — labeled text input
- RatingInput — 1-5 selector with emoji labels
- Badge — category/status pill
- ProgressDots — exercise progress indicator
- BottomNav — 5-tab mobile nav
```
