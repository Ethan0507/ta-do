# Ta-do — Checklist

Last updated: 2026-09-27

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
- [ ] Resolve: UserSettings full field list
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
- [ ] Altitude changer (day default → week/month/year zoom), undated/uncategorized Tasks float in daily view by default
- [ ] Period target input (manual "ideal vision")
- [x] Habit tracking MVP slice — shipped as **recurring tasks**: a "Repeat" picker (Daily/Weekly/Monthly/Custom) directly on a Task's detail sheet, backed by Habit + Routine membership and a `pg_cron`-scheduled generator (see schema.md, migrations `0009_recurring_tasks.sql`–`0011_recurrence_template_visibility.sql`). Verified end-to-end in production: cron job confirmed running every 15 min and correctly generating dated occurrences; template/occurrence visibility split (Daily shows only occurrences, Library shows only the template) confirmed correct on freshly-created repeats. Full Routine visualization (grouping by recurrence) still waits.
- [ ] Goal check-off (ongoing/achieved) + linking to Habits

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
- [ ] Periodic review (daily/weekly/monthly cadence)
- [ ] AI summary/insights from completed tasks, streaks, check-ins
- [ ] AI burnout/workload suggestions
- [ ] Online-research suggestions for recurring tasks
- [ ] Deeper Siri integration (beyond Shortcuts)
- [ ] Full Routine visualization (grouping habits by recurrence: daily/weekly/monthly)
- [ ] **Good to have:** detect when a Thought actually contains multiple discrete tasks, and offer a one-click "break down" action that splits it into separate Task entries

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
