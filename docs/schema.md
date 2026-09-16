# Ta-do — Schema (Draft v0.3)

Status: core entities resolved; auth + Shortcuts capture shipped and in production; Habit/Routine layer still being finalized; one open question remains (UserSettings fields).
Last updated: 2026-09-16

This is the schema after tallying against feature requirements. Backend: **Supabase** (Postgres + Auth + Realtime), same as routein — chosen so multiple users can use the app simultaneously (this is a real multi-user app from day one, not just schema-shaped for it; currently only one person uses it, but concurrent multi-user is a hard requirement, not a nice-to-have).

---

## User

Auth: Supabase Auth, passwordless — email magic link (`signInWithOtp`) as the primary path, Google OAuth as a lower-friction alternative. No passwords stored. (Originally scoped as a typed 6-digit OTP code, but Supabase's default email template only supports a clickable link without custom SMTP configured; switched to magic-link-only rather than take on an SMTP dependency — see notes.md.)

| Field | Type | Notes |
|---|---|---|
| id | uuid | Supabase `auth.users` id |
| email | string | via `auth.users`, not duplicated on `profiles` |
| created_at | timestamp | |
| timezone | string | affects what "today" / "this week" means |
| status | enum | active / deactivated |
| capture_token_hash | text, nullable, unique | SHA-256 hash of the per-user iOS Shortcuts capture token; raw value is never stored, only shown once client-side at generation time |
| onboarded_at | timestamp, nullable | set once the user completes (or dismisses) the first-run Shortcuts setup walkthrough |

## UserSettings

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid (FK → User) | |
| default_altitude | enum | day / week / month / year |
| (more TBD) | | |

**Still open** — see Open Questions below.

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
| habit_id | uuid (FK → Habit, nullable) | set if this Entry was generated from a recurring Habit |

Type-specific fields:

| Field | Applies to | Notes |
|---|---|---|
| due_date / scheduled_date | Task | drives which daily/weekly list it appears in. **If null, the Task floats in the current daily altitude view by default** — undated/uncategorized entries are meant to surface there, not get lost in Library only |
| priority | Task | for library sorting |
| status | Task | open / done |
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
| recurrence_rule | string/struct | e.g. daily, specific weekdays |
| created_at | timestamp | |

Created via a "track as habit" action on an existing Task Entry (not created standalone). Flow:
1. User hits "track as habit" on a Task Entry.
2. A Habit row is created — `title` copied from the Entry's content, `recurrence_rule` set at that point.
3. The original Entry's `habit_id` is set to point at the new Habit (it becomes the first occurrence).
4. Each subsequent period, a new Task Entry auto-generates with the same `habit_id`.
5. The new Habit's id is added to the user's **Routine** (see below) — this is also how it becomes visible/active.

**Streak is not a stored field.** It's computed by reading `completed_at` across all Entries sharing a given `habit_id`, so it can never drift out of sync with actual entry data — no `streak_count` column needed on Habit itself.

**`active` boolean removed** — superseded by Routine membership (see below): a Habit not currently in the Routine is effectively paused, without losing its definition or history.

## Routine / RoutineHabit — **draft, not yet finalized**

Modeled after how routein manages routines. Intent: the Routine is a lightweight container that acts as a **filter over "habits currently planned"** — Habit rows remain the source of truth for definition/recurrence/history, and Routine membership just marks which ones are currently active/surfaced.

| Table | Field | Type | Notes |
|---|---|---|---|
| Routine | id | uuid | |
| Routine | user_id | uuid (FK → User) | |
| Routine | created_at | timestamp | |
| RoutineHabit | routine_id | uuid (FK → Routine) | |
| RoutineHabit | habit_id | uuid (FK → Habit) | |

Flow: a user starts with an empty Routine. As Entries are converted to Habits, the new Habit's id is added to the Routine (see Habit flow above, step 5). Removing a habit_id from RoutineHabit pauses it (stops new Entry generation, keeps history) without deleting the Habit.

Visualization: habits within the Routine can be grouped by recurrence (daily / weekly / monthly, etc.) for display — this is a query concern, not a schema one.

**Open questions on this model (needs more design time before build):**
- One Routine per user, or can a user have multiple named Routines (e.g. "Morning," "Work")? Current framing ("the routine") suggests one, but worth confirming against routein's actual model.
- Does removing a habit from the Routine stop entry generation immediately, or let the current period's Entry finish first?
- Should pausing (removal from Routine) be distinguishable from "done with this habit forever," or is it the same state?

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

---

## Not stored — computed views

- **Altitude View**: a query over Entry (+ Category, + PeriodTarget) filtered/grouped by day/week/month/year. Not a table. Undated Tasks default into the current daily altitude view (the "parking lot" — this is the default view for most users).
- **Rollup/Summary**: computed aggregation of Entry completion/status for a given period + category, shown alongside PeriodTarget. For Tasks this reads `status`/`completed_at`; for Goals it reads `status`/`achieved_at`, optionally factoring in linked Habits via GoalHabit. Not a table.

---

## Resolved
- ~~Habit as own entity vs. Task + recurrence rule~~ → own entity, created via "track as habit" action on a Task; streak computed, not stored. (Routine layer on top still draft — see above.)
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

## Open questions still to resolve

1. UserSettings — what actually belongs here beyond `default_altitude`
2. Routine model — see open questions under Routine/RoutineHabit above; needs a proper design pass, possibly informed by reading routein's actual routine implementation
