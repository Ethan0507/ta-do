# Ta-do — Checklist

Last updated: 2026-10-03

## Success Metric (MVP)
MVP succeeds if Ethan uses Ta-do **daily for 2 consecutive weeks** as his sole capture point for personal thoughts/tasks (replacing iOS Notes) and work-adjacent personal capture (replacing Slack self-DMs/personal chats), with nothing he cared about falling through the cracks during that window. Checked subjectively at the end of the 2 weeks — did anything get lost, did he revert to Notes or Slack even once — not via an in-app analytics event.

## Scope & Planning
- [x] Define the problem the app solves (context-switching / brain fog / "what's next")
- [x] Survey existing apps (Sunsama, Akiflow, Motion, ADHD brain-dump apps) — none fully overlap
- [x] Decide app boundary: separate app from routein for now, linking revisited later
- [x] Define MVP feature scope
- [x] Define post-MVP ("nice to have") feature scope
- [x] Decide category model: 4 base pillars (Spiritual, Physical, Psychological, Career) + custom labels (starting with Art, Music)
- [x] Decide category behavior: optional at capture, multi-category, editable later, grouping-only purpose
- [x] Decide MVP voice capture approach: iOS Shortcuts action → API endpoint
- [x] List all entities involved
- [x] Tally requirements per feature against skeleton schema
- [x] Finalize schema v0.2 (Habit/Routine layer still draft — see below)
- [x] Rename app to Ta-do

## Data Model
- [x] Skeleton schema drafted and validated against features (see schema.md)
- [x] Resolve: Habit as own entity vs. Task + recurrence rule → own entity
- [x] Finalize Routine model on top of Habit — resolved for the recurring-tasks feature: one Routine per user, lazily created; pause = remove from Routine, stops generation immediately (see schema.md)
- [x] UserSettings: theme + timezone (auto/manual) shipped in an Account settings sheet; further fields added as features need them
- [x] Resolve: PeriodTarget granularity → multiple rows per period allowed, per-category or overall
- [x] Resolve: Goal completion → status enum (ongoing/achieved) + achieved_at
- [x] Resolve: Goal ↔ Habit relationship → many-to-many (GoalHabit)
- [ ] Finalize relationships/foreign keys
- [x] Decide storage/backend → Supabase (Postgres + Auth + Realtime), same as routein

## MVP Core — build first, minimum to start the 2-week usage trial
- [x] Brain dump capture (Thought / Goal / Task)
- [x] Archive entry (hide from lists, still viewable)
- [x] Library view (all entries, filterable by type, sortable by category or newest — not by deadline/priority)
- [x] Category assignment / movement
- [x] iOS Shortcuts capture endpoint (per-user hashed auth token — see Security)
- [x] Rollup for Tasks and Goals (Tasks via status/completed_at, Goals via status/achieved_at)
- [x] Supabase Auth (login) wired up — email magic link + Google OAuth
- [x] RLS policies scoping every table by user_id
- [x] Notes field on Entry (freeform, separate from `content`)
- [x] First-run onboarding walkthrough for Shortcuts setup, with live capture test
- [x] Label (category) option in the Shortcuts capture — `labels` in the POST body, plus a GET that lists label names for a "Choose from List" step
- [x] Multi-line task capture — pasting/typing several lines into the task capture box opens an editable draft-review sheet (edit/remove/add lines) before creating them all together

## MVP Complete — build after Core, still required to call the MVP done, lower priority
- [ ] Altitude changer — moved to Roadmap Phase 3
- [ ] Period target input — moved to Roadmap Phase 3
- [x] Habit tracking MVP slice — shipped as **recurring tasks**: a "Repeat" picker (Daily/Weekly/Monthly/Custom) directly on a Task's detail sheet, backed by Habit + Routine membership and a `pg_cron`-scheduled generator (see schema.md, migrations `0009_recurring_tasks.sql`–`0011_recurrence_template_visibility.sql`). Verified end-to-end in production: cron job confirmed running every 15 min and correctly generating dated occurrences; template/occurrence visibility split (Daily shows only occurrences, Library shows only the template) confirmed correct on freshly-created repeats. Full Routine visualization (grouping by recurrence) still waits.
- [ ] Goal check-off (ongoing/achieved) + linking to Habits — moved to Roadmap Phase 3

## Multi-User
- [x] Confirm multi-user, concurrent use is a real requirement (not just personal use)
- [x] Supabase Auth wired up for signup/login — **moved to MVP Core**, since Ethan uses real personal data from day one
- [ ] Realtime sync verified for concurrent editing (matching routein's approach) — not MVP-blocking, only matters once a second user actually exists

## Security — required before broader personal/production use, not blocking MVP dev
Note: basic Supabase Auth + RLS (data scoped per user_id) are pulled forward into MVP Core above, since Ethan starts using this on real data immediately. Everything below is the remaining hardening pass before relying on it more broadly.
- [x] Auth token / API key for the iOS Shortcuts capture endpoint — per-user token, hashed (SHA-256) at rest, never stored or re-displayed in plain text after generation
- [x] Secrets/env management — Supabase service-role key stays server-side (Edge Function secret only); anon key is public by design, protected by RLS not secrecy
- [ ] Rate limiting on public-facing capture endpoint
- [ ] Data export + account deactivation/deletion flow (ties into "Deactivate account / clear data" below)
- [ ] Dependency/vulnerability scanning before going live for personal use
- [ ] Revisit this whole section before Ethan starts using the app on real data

## Post-MVP
- [ ] AI review of saved Thoughts / Tasks / Goals with suggested changes — after Phase 4 analytics
- [ ] Periodic review (daily/weekly/monthly cadence)
- [ ] AI summary/insights from completed tasks, streaks, check-ins
- [ ] AI burnout/workload suggestions
- [ ] Online-research suggestions for recurring tasks
- [ ] Deeper Siri integration (beyond Shortcuts)
- [ ] Full Routine visualization (grouping habits by recurrence: daily/weekly/monthly)
- [ ] **Good to have:** detect when a Thought actually contains multiple discrete tasks, and offer a one-click "break down" action that splits it into separate Task entries

## Roadmap — project plan (revised 2026-10-03, picked up strictly in this order)
Web UI stays as-is. One phase at a time; each is finished and verified before the next starts.

### Phase 1 — Fix recurring tasks completely
Goal: very few bugs, ideally none. Start by collecting concrete repro cases and checking live rows before changing code.
- [ ] Reconcile CLI migration ledger first (see Deployment) so new migrations apply cleanly
- [x] Agree the expected behaviour — written up as "Recurring tasks — specification" in schema.md (2026-10-03)
- [x] Audit against live data — found: every account stuck on UTC, a double-tapped Save creating duplicate Habits ("Wake up" generating 3x/day), templates being ticked in Library instead of the daily tasks
- [x] Decide what happens to already-generated tasks when a template changes or stops repeating → untouched, and kept out of Library via `is_generated`
- [ ] Clean up leftover junk entries (orphaned "Wake up" task, two old test entries) — Ethan's call; the "Test repeat" verification entries are already deleted
- [x] Update schema.md: Routine layer no longer "draft"
- [x] Code + migration `0012_recurrence_rework.sql` written (builds, lints)
- [x] Apply `0012` to production (CLI ledger repaired first)
- [x] Clear all existing recurring data for a clean slate (Ethan's call)
- [x] Verify end-to-end locally against production data: timezone saved, today's task created once with notes/categories/time copied, template only in Library and not tickable, template edits don't touch today's task, "Edit repeating task" opens it in Library, Repeat → None makes it a normal task, past generated task marked missed, no duplicates on reload
- [x] Account settings sheet: theme + timezone (device or manual), app's "today" follows the account timezone (migration `0013_timezone_setting.sql`)
- [x] Apply `0013` to production
- [x] Deploy (commit + push → Vercel)

### Phase 2 — Native app: iOS first, then Android
Purpose: easier, hassle-free capture with more power than the current Shortcut. Web app stays the main UI.

**Decisions (2026-10-03):** native **Swift / SwiftUI** (Android later as its own Kotlin app); "custom phrase" = a **Siri phrase that starts capture**; **no paid Apple Developer account** for now → reminders are local notifications scheduled on the phone, installs on Ethan's iPhone are free 7-day provisioning, no TestFlight or server push yet. App lives in `ios/` in this repo; Xcode project generated from `project.yml` via XcodeGen. Talks to the same Supabase project (same accounts, same RLS) via `supabase-swift`.

- [x] 2.0 Setup — Xcode 27 + iOS 27 simulator runtime, XcodeGen, `tado://auth-callback` allowed in Supabase Auth. Setup steps in `ios/README.md`
- [x] 2.1 Skeleton + sign-in — SwiftUI app, magic link + Google sign-in, session kept in Keychain, timezone sync + today's repeats like the web app. Verified in the simulator: Google sign-in returns to the app, session survives a restart (magic link not yet tried end to end)
- [x] 2.2 Home + capture — Thoughts / Tasks / Goals lists using the same rules and queries as the web Home (generated tasks, overdue, missed), capture panel (several lines → several tasks), swipe right = done / left = archive, completed-today strip, detail sheet (text, type, due date, done, notes, archive). Styled after the web app's glass design with native controls (sheets, menus, swipe actions, haptics), light + dark, app icon from the logomark. Verified in the simulator against live data. Not yet on iOS: Library, repeat setup, categories, drag-to-reorder (web only for now)
- [ ] 2.3 In-app voice capture — dictation button using on-device speech recognition
- [ ] 2.4 Siri + Shortcuts — "Capture in Ta-do" App Intent with optional type, label(s) and due date (Siri asks follow-ups); built-in App Shortcut phrase (must contain the app name, e.g. "Brain dump in Ta-do") plus a ready-made Shortcut for a fully custom phrase; lock screen / Action button control
- [ ] 2.5 Reminders — per-task reminder time (schema change), local notifications scheduled after each sync; repeating tasks with a time remind at that time
- [ ] 2.6 On-device install via free provisioning; use it for a week
- [ ] 2.7 Android (Kotlin) — plan separately once iOS has settled
- [ ] Later, once a paid Apple account exists: TestFlight, server push

### Phase 3 — Goals: link Tasks to Goals for progress insights
Absorbs the remaining MVP Complete items, planned together since they all feed goal progress.
- [ ] Plan: design Goal ↔ Task linking, Goal ↔ Habit linking, period targets and the altitude view together before building
- [ ] Goal ↔ Task link (schema + UI); goal progress computed implicitly from linked Tasks' completion
- [ ] Goal check-off (ongoing/achieved) + linking Goals to Habits (`GoalHabit`)
- [ ] Altitude changer (day default → week/month/year zoom), undated/uncategorized Tasks float in daily view by default
- [ ] Period target input (manual "ideal vision" per week/month/year)

### Phase 4 — Analytics (no AI yet)
- [ ] Basic stats: completion counts/rates, streaks for repeating tasks, goal progress over time, per-category breakdowns
- [ ] AI review/suggestions stays deferred until after this (see Post-MVP)

### Phase 5 — Production readiness
- [ ] Security — everything still open in the Security section (rate limiting the capture endpoint, data export + account deletion, dependency scanning, final review), plus cookie handling
- [ ] System design review — what has to change for many users rather than one
- [ ] Load handling — capture endpoint, `pg_cron` generator and queries under realistic user counts
- [ ] Upkeep cost — estimate Supabase / Vercel / push / email costs per user and at 50 and 200 users; set up custom SMTP
- [ ] Realtime sync verified for concurrent use (see Multi-User)

### Phase 6 — End-to-end design UI/UX review (before anyone else uses it)
- [ ] Walk every flow on web and iOS end to end (sign-up, onboarding, capture incl. voice/Siri, Home, Library, detail sheets, repeats, goals, analytics, settings) and list UX friction, inconsistencies and visual issues
- [ ] Prioritise the findings and make the changes
- [ ] Re-check both platforms after the changes

### Phase 7 — Trial users (friend circle)
- [ ] Onboard a handful of friends, collect feedback, fix what breaks

### Phase 8 — Alpha users (first- and second-degree circle, ~50 users)
- [ ] Onboarding + feedback channel that works without hand-holding

### Phase 9 — Beta users (~100–200 users)
- [ ] Scale up from Alpha learnings

## Standard App Essentials
- [x] Login/signup (Supabase Auth — email magic link + Google OAuth)
- [x] Data security (see Security section above — RLS + hashed capture tokens; rate limiting and data export/deletion still open)
- [ ] Cookie handling
- [ ] User profile
- [ ] Deactivate account / clear data

## Deployment
- [x] GitHub repo (github.com/Ethan0507/ta-do)
- [x] Production hosting on Vercel (ta-do.vercel.app)
- [x] Supabase project provisioned, migrations applied
- [x] Supabase Auth redirect URLs configured for both localhost (dev) and the production domain
- [x] `pg_cron` extension enabled + `generate_habit_entries()` scheduled (every 15 min) for recurring-task generation
- [ ] Custom SMTP provider (currently on Supabase's default sender — fine for personal use, has a low hourly send-rate limit)
- [ ] Reconcile CLI migration ledger — migrations `0004`–`0011` were applied directly via the Supabase SQL editor rather than `supabase db push`, so the schema is correct but the CLI's local ledger doesn't know it; run `supabase migration repair --status applied 0004 0005 0006 0007 0008 0009 0010 0011 --linked` next time it's convenient so future `db push` runs don't choke on it

## Open Questions
- UserSettings: what belongs here beyond default altitude view?
