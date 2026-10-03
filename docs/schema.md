# Ta-do — Schema (Draft v0.4)

Status: core entities resolved; auth + Shortcuts capture shipped and in production; Habit/Routine layer shipped as the recurring-tasks feature; one open question remains (UserSettings fields).
Last updated: 2026-09-27

This is the schema after tallying against feature requirements. Backend: **Supabase** (Postgres + Auth + Realtime), same as routein — chosen so multiple users can use the app simultaneously (this is a real multi-user app from day one, not just schema-shaped for it; currently only one person uses it, but concurrent multi-user is a hard requirement, not a nice-to-have).

---

## User

Auth: Supabase Auth, passwordless — email magic link (`signInWithOtp`) as the primary path, Google OAuth as a lower-friction alternative. No passwords stored. (Originally scoped as a typed 6-digit OTP code, but Supabase's default email template only supports a clickable link without custom SMTP configured; switched to magic-link-only rather than take on an SMTP dependency — see notes.md.)

| Field | Type | Notes |
|---|---|---|
| id | uuid | Supabase `auth.users` id |
| email | string | via `auth.users`, not duplicated on `profiles` |
| created_at | timestamp | |
| timezone | string (IANA, e.g. `Asia/Calcutta`) | decides when the user's day starts — both for the app's Home view and for the repeat generator. Synced from the device on every app load while `user_settings.timezone_auto` is true; otherwise set manually in Account settings |
| status | enum | active / deactivated |
| capture_token_hash | text, nullable, unique | SHA-256 hash of the per-user iOS Shortcuts capture token; raw value is never stored, only shown once client-side at generation time |
| onboarded_at | timestamp, nullable | set once the user completes (or dismisses) the first-run Shortcuts setup walkthrough |

## UserSettings

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User) | |
| default_altitude | enum | day / week / month / year |
| theme_preference | enum | light / dark / auto (auto follows the device) — migration `0008` |
| timezone_auto | boolean, default true | true = `profiles.timezone` follows the device; false = picked manually and left alone — migration `0013` |

Edited from the **Account settings** sheet (gear button on Home), which currently holds Theme and Timezone.

## Category

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User, nullable) | null = base/system category (shared, one row total); set = custom label (one row per user) |
| name | string | e.g. "Physical", "Art" |
| created_at | timestamp | |

Base four exist as exactly 4 global rows, shared across all users: Spiritual, Physical, Psychological, Career.
Custom labels are one row per user per label (e.g. two users each adding "Music" creates two separate rows).

## Entry

The core object. A brain-dump item; type determines which extra fields apply.

**Design decision: single table, not per-type tables.** Thought/Goal/Task are the same row, distinguished by `type`. Converting a Thought into a Task doesn't create a new row — the same Entry's `type` flips and the relevant fields get filled in. `id` never changes across an Entry's life. This costs some null columns per row (acceptable at personal scale) in exchange for type conversion being a non-event rather than a migration. No history/audit trail on type changes.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User) | |
| type | enum | thought / goal / task — defaults to `thought`, changeable after capture |
| content | text | the only required field at capture |
| notes | text, nullable | freeform longer-form notes, separate from the short `content` line; editable from Entry Detail |
| created_at | timestamp | immutable |
| archived_at | timestamp, nullable | null = active; set = hidden from lists, still viewable |
| habit_id | uuid (FK → Habit, nullable) | on a template: the Habit holding its rule. On a generated task: the Habit it came from (used only for the "Edit repeating task" link; nulled if the Habit is removed) |

Type-specific fields:

| Field | Applies to | Notes |
|---|---|---|
| due_date / scheduled_date | Task | drives which daily/weekly list it appears in. **If null, the Task floats in the current daily altitude view by default** — undated/uncategorized entries are meant to surface there, not get lost in Library only |
| due_time | Task, nullable | time-of-day, only ever set by the recurrence generator from the rule's optional `time`; not manually editable |
| is_recurrence_template | Task, boolean, default false | true = this row IS a repeating task's template (lives in Library only, never tickable) — see Recurring tasks below |
| is_generated | Task, boolean, default false | true = this row was created automatically from a template (lives on Home only, never in Library). Stays true even if the template is later removed |
| priority | Task | for library sorting |
| status | Task | open / done / **missed** — `missed` is only ever set by the generator, on a generated task left open past its day |
| completed_at | Task | timestamp, feeds rollup stats |
| period_scope | Goal | week / month / year |
| period_identifier | Goal | e.g. 2026-W34, 2026-08, 2026 |
| target_metric | Goal | optional, freeform or numeric |
| status | Goal | **ongoing / achieved** — Goals are checkable off like Tasks, but with their own two-state enum (kept distinct from Task's open/done since the domains differ) |
| achieved_at | Goal | timestamp, set when status flips to achieved; feeds rollup stats the same way Task's `completed_at` does |

## EntryCategory (join table)

| Field | Type | Notes |
|---|---|---|
| entry_id | uuid (FK → Entry) | |
| category_id | uuid (FK → Category) | |

Many-to-many: an Entry can have 0+ categories, added at capture or later.

## GoalHabit (join table)

| Field | Type | Notes |
|---|---|---|
| goal_entry_id | uuid (FK → Entry, type=goal) | |
| habit_id | uuid (FK → Habit) | |

Many-to-many: **a Habit can contribute to a Goal, and a Goal can have multiple Habits.** Modeled many-to-many (not one-to-many) since a single habit could plausibly feed more than one goal (e.g. a daily "read 20 pages" habit contributing to both a yearly reading-count goal and a psychological-wellbeing goal). Rollup for a Goal with linked Habits can factor in the habits' streak/completion data alongside the Goal's own `status`.

## Habit

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User) | |
| title | string | template content for generated Entries |
| recurrence_rule | jsonb | see shapes below |
| created_at | timestamp | |

`recurrence_rule` shapes (one of) — **every rule has at most one optional time**:
```jsonc
{ "freq": "daily", "time"?: "09:00" }
{ "freq": "weekly", "weekday": 0, "time"?: "09:00" }          // 0 = Sunday .. 6 = Saturday
{ "freq": "monthly", "day_of_month": 15, "time"?: "09:00" }   // day 29–31 is skipped in shorter months (calendar logic later)
{ "freq": "custom", "weekdays": [1, 3, 5], "time"?: "09:00" }
```
(Before migration `0012`, `custom` carried a `times` array — multiple tasks per day. That's gone; `0012` keeps only the first time.)

### Recurring tasks — specification (agreed 2026-10-03)

**Two kinds of row, never mixed:**
- **Template** (`is_recurrence_template = true`): the recurring task's config — content, notes, categories, plus the rule on its Habit. Shown **only in Library**. Never tickable. Undated.
- **Generated task** (`is_generated = true`): an ordinary, fully independent task created from the template for one day. Shown **only on Home** (and Upcoming). Never in Library — open, done or missed.

**Lifecycle:**
1. A task exists. On its detail sheet the user sets Repeat: Daily / Weekly / Monthly / Custom (weekdays), each with an optional time.
2. That task becomes the template: a Habit is created for the rule, and the task gets `is_recurrence_template = true`, undated, open. It disappears from Home and stays in Library.
3. **Generation:** at the start of each day in the user's timezone (`profiles.timezone`, kept in sync from the device on every app load), every active template whose rule matches today gets **one** task for today. Implemented as `generate_habit_entries()` via `pg_cron` every 15 minutes (so it fires shortly after each user's local midnight, including :30/:45-offset timezones) and also called on app load and right after a repeat is set, for the current user only, so Home is never stale. Deduped per Habit + date. **No backfill** — days the job didn't run are simply skipped.
4. **Everything is copied** from the template onto the generated task at creation time: content, notes, categories, and the rule's time as `due_time`. The time is *when it's due*, not when it appears — it appears at the start of the day.
5. **Independence:** once created, a generated task is its own task. Editing, completing, notes etc. affect only that task. Editing the template affects only tasks generated *after* the edit — today's already-created task is untouched.
6. **Missed:** a generated task still open after its day ends is set to `missed` by the generator. It leaves Home. There's no catching up — you do it next time it's generated. (Ordinary, non-generated tasks are different: if past their due date they stay on Home as **overdue**.)
7. **Edit link:** a generated task's detail sheet shows "Edit repeating task" while its template still exists; it switches to Library and opens the template there.
8. **Stop repeating:** setting the template's Repeat to None turns it back into a normal task (template flag cleared, Habit deleted). It reappears on Home as an undated task. Already-generated tasks are untouched and still never appear in Library.
9. **Archiving the template** stops generation; unarchiving resumes it.
10. **Not yet:** pausing (planned later), calendar-aware monthly rules.

**Flow detail:** the Habit row (`title` kept in sync with the template's content) is added to the user's **Routine**; Routine membership is what makes it active. Generator source: `supabase/migrations/0012_recurrence_rework.sql` (supersedes the generator in `0009`/`0010`).

**Streak is not a stored field.** It's computed by reading `completed_at` across all Entries sharing a given `habit_id`, so it can never drift out of sync with actual entry data — no `streak_count` column needed on Habit itself.

**`active` boolean removed** — superseded by Routine membership (see below): a Habit not currently in the Routine is effectively paused, without losing its definition or history.

## Routine / RoutineHabit

Intent: the Routine is a lightweight container that acts as a **filter over "habits currently planned"** — Habit rows remain the source of truth for definition/recurrence/history, and Routine membership just marks which ones are currently active/surfaced (and thus generating new Entries).

| Table | Field | Type | Notes |
|---|---|---|---|
| Routine | id | uuid | |
| Routine | user_id | uuid (FK → User) | |
| Routine | created_at | timestamp | |
| RoutineHabit | routine_id | uuid (FK → Routine) | |
| RoutineHabit | habit_id | uuid (FK → Habit) | |

Flow: a user starts with an empty Routine, created lazily (one per user) the first time a repeat is set. As Entries are converted to Habits, the new Habit's id is added to the Routine (see Habit flow above, step 4). Removing a habit_id from RoutineHabit would pause it (stops new Entry generation, keeps history) without deleting the Habit — reserved for the future Pause feature. Clearing the "Repeat" option now deletes the Habit instead (see spec step 8).

Visualization: habits within the Routine can be grouped by recurrence (daily / weekly / monthly, etc.) for display — this is a query concern, not a schema one.

**Resolved:** one Routine per user (lazily created). Stopping a repeat deletes its Habit; Routine membership stays as the hook for a future Pause.

## PeriodTarget

The "self-set ideal vision" for a given period — separate from the computed rollup.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User) | |
| period_type | enum | week / month / year |
| period_identifier | string | e.g. 2026-W34 |
| category_id | uuid (FK → Category, nullable) | null = overall target, set = per-category target |
| description | text | freeform target statement |
| created_at | timestamp | |

No uniqueness constraint on (user_id, period_type, period_identifier) — a single period can have multiple PeriodTarget rows (e.g. several goals for the month, some general, some per-category).

## Review (post-MVP)

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User) | |
| cadence | enum | daily / weekly / monthly |
| period_identifier | string | |
| reflection_content | text | |
| created_at | timestamp | |

## iOS Shortcuts capture (Edge Function, not a table)

`supabase/functions/capture-entry` — a Supabase Edge Function, not a Postgres table, but documented here since it's a real integration surface.

- Auth: caller sends `x-capture-token` header; the function hashes it (SHA-256) and looks up `profiles.capture_token_hash` to resolve which user it belongs to, then inserts the Entry as that user via the service-role client (bypassing RLS deliberately, since the request itself isn't a Supabase session).
- One token per user (not one global secret) — originally shipped as a single hard-coded `SHORTCUT_USER_ID`/`SHORTCUT_SECRET` env-var pair, which meant a shared Shortcut would silently write into the original owner's account; redesigned so each user has their own token and the same Shortcut structure can be shared, with each recipient swapping in their own token.
- Token is shown to the user exactly once (at generation, in the app's "Set up voice capture" screen) and never re-displayed — only its hash is stored. Losing it means regenerating (and updating the Shortcut).
- A pre-built, importable `.shortcut` file is hosted at `/Brain Dump.shortcut` (public/ directory) — built once by hand in the Shortcuts app with a placeholder token value, then hosted directly rather than distributed through Apple's iCloud share flow (which would require an Apple ID signed into automation tooling, not available in this environment).
- Body: `{ content: string, type?: 'thought' | 'goal' | 'task' }` — `type` defaults to `thought` if omitted.
- Body also accepts `labels?: string[] | string` — Category names (base or the user's own), matched case-insensitively and written to `entry_categories`. A single string may be newline- or comma-separated, since that's how Shortcuts serializes a multi-select "Choose from List" result into a Text field. Unknown names are skipped (returned as `unmatchedLabels`), not auto-created, so a misheard label can't silently add a custom one.
- `GET` with the same token header returns `{ labels: string[] }` — the user's available label names, so a Shortcut can offer them in "Choose from List" before dictation.

---

## Not stored — computed views

- **Altitude View**: a query over Entry (+ Category, + PeriodTarget) filtered/grouped by day/week/month/year. Not a table. Undated Tasks default into the current daily altitude view (the "parking lot" — this is the default view for most users). Exception: an entry with `is_recurrence_template = true` never floats in here regardless of its (null) due date — it's a series definition, not an occurrence.
- **Rollup/Summary**: computed aggregation of Entry completion/status for a given period + category, shown alongside PeriodTarget. For Tasks this reads `status`/`completed_at`; for Goals it reads `status`/`achieved_at`, optionally factoring in linked Habits via GoalHabit. Not a table.
- **Recurrence template/generated split**: Home and Upcoming query `is_recurrence_template = false`, and only show generated tasks for today or later (past ones are about to be / already marked missed); Library queries `is_generated = false` (templates and ordinary entries only). Not separate tables, just complementary filters over the same `entries` rows.
- **Home task list**: open tasks with no due date, due today, or overdue (past due date, ordinary tasks only).

---

## Resolved
- ~~Habit as own entity vs. Task + recurrence rule~~ → own entity, created via "track as habit" action on a Task; streak computed, not stored. 
- ~~PeriodTarget: multiple per period?~~ → yes, no uniqueness constraint.
- Category `kind` field → removed, redundant with `user_id IS NULL`.
- Entry `type` default → `thought`.
- Goal can be checked off like a Task → `status` enum (ongoing/achieved) + `achieved_at`, mirroring Task's status/completed_at.
- Goal ↔ Habit relationship → many-to-many via GoalHabit; a habit can contribute to multiple goals.
- Undated/uncategorized Tasks → float in the current daily altitude view by default.
- Storage/backend → Supabase (Postgres + Auth + Realtime), matching routein.
- Multi-user, concurrent → confirmed requirement, not just personal-use scaffolding.
- Auth approach → passwordless: email magic link + Google OAuth, both via Supabase Auth. No passwords stored.
- Entry `notes` field → added, freeform text separate from `content`, nullable.
- Shortcuts capture endpoint auth → per-user hashed capture token (see dedicated section above), not a single shared secret.
- First-run onboarding → `profiles.onboarded_at`, walkthrough shown once, dismissible or auto-completed by a live capture test.
- Routine model → resolved for the recurring-tasks feature scope: one Routine per user, lazily created; see Habit/Routine sections above.
- Recurring tasks → shipped via Habit/Routine + `entries.due_time` + the `generate_habit_entries()` scheduled job (migration `0009_recurring_tasks.sql`).

## Open questions still to resolve

1. UserSettings — anything beyond `default_altitude`, theme and timezone (add as features need them)
