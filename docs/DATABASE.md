# PhysiqueOS Web — Database Model

## Storage: IndexedDB via Dexie.js

All data stored locally in the browser. No server, no sync.

## Tables

### exercises
Exercise library (24 default, user can add custom).

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| name | string | "Barbell Bench Press" |
| category | "push" \| "pull" \| "legs" \| "core" \| "cardio" \| "other" | |
| primary_muscle | string? | "Chest" |
| equipment | string? | "Barbell" |
| is_default | boolean | true = system exercise |
| created_at | ISO string | |

### workout_templates
User-created workout templates.

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| name | string | "Push Day" |
| category | "push" \| "pull" \| "legs" \| "full_body" \| "custom" | |
| is_active | boolean | true |
| created_at | ISO string | |

### template_exercises
Junction: template ↔ exercise with config.

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| template_id | string (FK) | → workout_templates.id |
| exercise_id | string (FK) | → exercises.id |
| sort_order | number | 0-based |
| target_sets | number | 4 |
| target_reps | string | "6-10" |
| rest_seconds | number | 180 |
| rpe_target | number | 8.5 |
| notes | string? | |

### workout_sessions
One per workout start.

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| template_id | string? | → workout_templates.id |
| name | string | "Push Day" |
| category | string | "push" |
| started_at | ISO string | |
| completed_at | ISO string? | null = in progress |
| duration_sec | number? | |
| notes | string? | |

### exercise_logs
One row per set.

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| session_id | string (FK) | → workout_sessions.id |
| exercise_id | string (FK) | → exercises.id |
| set_number | number | 1-based |
| weight_lbs | number? | null = bodyweight |
| reps | number | |
| rpe | number? | 1-10 |
| is_warmup | boolean | false |
| notes | string? | |
| created_at | ISO string | |

### daily_checkins
One per day (upsert on date).

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| date | string | "2026-06-17" (unique) |
| sleep_hours | number? | 7.5 |
| sleep_quality | number? | 1-5 |
| energy | number | 1-5 |
| stress | number | 1-5 |
| motivation | number | 1-5 |
| soreness | number? | 1-5 |
| appetite | number? | 1-5 |
| readiness_score | number? | 0-100 |
| notes | string? | |
| created_at | ISO string | |

### bodyweight_logs
One per weigh-in (upsert on date).

| Column | Type | Notes |
|--------|------|-------|
| id | string (PK) | UUID |
| date | string | "2026-06-17" |
| weight_lbs | number | 185.0 |
| source | string | "manual" |
| created_at | ISO string | |

## Indexes

```ts
db.exercises:       'id, category'
db.workout_templates: 'id, is_active'
db.template_exercises: 'template_id, [template_id+sort_order]'
db.workout_sessions: 'id, started_at'
db.exercise_logs:   'session_id, [session_id+created_at]'
db.daily_checkins:  'date'
db.bodyweight_logs: 'date'
```

## Default Data (Seed)

- 24 exercises (same as React Native version)
- 6 default templates (Push, Pull, Legs, Upper, Lower, Arms & Shoulders)
- Seeded on first app launch via Dexie `populate` hook
