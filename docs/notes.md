# Ta-do — Notes & Decision Log

## Current stage
Schema tallied against feature requirements (schema.md v0.2). Habit/Routine layer still needs a proper design pass. Otherwise ready to move into build planning.

## Key decisions made (chronological)
- App job-to-be-done: "tell me what to do next, and let me trust nothing fell through the cracks, at any zoom level."
- Separate app from routein for now; integration/linking to be revisited later, not designed now.
- Entry types: Thought, Goal, Task — same underlying object, type is changeable after capture.
- Archive (not delete): hides from active lists, stays viewable.
- Categories: 4 base pillars (Spiritual, Physical, Psychological, Career) + custom labels (Art, Music to start). Optional at capture, addable/movable later via an action, multi-category allowed, used only for grouping at altitude views — no other planned purpose.
- Altitude view: daily is default (current + next), zoomable to week/month/year. Each altitude shows a computed rollup AND a separately self-set period target — both shown together, not merged.
- AI burnout/workload suggestions (originally MVP idea) demoted to post-MVP — flagged as risky to ship before enough real usage data exists, and framed as a nudge rather than a verdict.
- Auto-grouping of similar entries demoted in favor of explicit category tagging (simpler, more reliable at personal scale).
- Voice capture: iOS Shortcuts action hitting an API endpoint, not deeper Siri/native integration — simplest path given he owns iOS devices.
- Library sort fields trimmed conceptually — start with type + date, expand only if actually needed in use.
- App renamed from working title "Focus App" to **Ta-do**.
- Habit as own entity (not Task + recurrence rule), created via "track as habit" action; streak computed from `completed_at`, not stored.
- Habit tracking gets an additional **Routine** layer on top, modeled after routein: a Routine starts empty, and Habit ids get added to it as Entries are converted — the Routine acts as a filter over "habits currently planned." Visualization can group by recurrence (daily/weekly/monthly). Flagged as still needing thorough design, possibly by referencing routein's actual implementation directly.
- Goals can be checked off like Tasks — own two-state status (ongoing/achieved), separate enum from Task's (open/done).
- Goals can link to multiple Habits (and a Habit can contribute to multiple Goals) — many-to-many via GoalHabit, so a habit's progress can roll up into goal progress.
- Undated/uncategorized Tasks float in the current daily altitude view by default — that's the default view for most users, so nothing should get lost by lacking a date/category.
- Multi-user is a real requirement, not just schema-shaped scaffolding — the app should support multiple people using it simultaneously (like routein), even though only one person uses it today.
- Backend/storage: Supabase, same as routein.
- Security is treated as required before personal/production use, not before MVP — added as its own checklist track so it isn't forgotten once MVP dev starts.
- MVP success metric defined: daily use for 2 consecutive weeks as sole capture point, replacing iOS Notes (personal) and Slack self-DMs/personal chats (work-adjacent), with nothing falling through the cracks — checked subjectively, not via analytics.
- MVP scope split into two tiers, both still "MVP" (neither pushed to Post-MVP): **MVP Core** (brain dump capture, archive, library view, category assignment, iOS Shortcuts endpoint, Task/Goal rollup) is the minimum to start the 2-week trial; **MVP Complete** (altitude changer, period target input, Habit tracking slice, Goal check-off + Goal↔Habit linking) is lower priority but still required before calling the MVP done.
- Auth/RLS floor pulled forward into MVP Core: since real personal data is used from day one, basic Supabase Auth (login) and RLS (per-user_id scoping) ship with MVP Core rather than waiting for the general Security hardening pass. The rest of Security (Shortcuts endpoint token, rate limiting, dependency scanning, data export/deactivation) still waits.

## Open questions (not yet resolved)
1. UserSettings — exact field list beyond default altitude view
2. Routine model details — one Routine per user or multiple named ones? Does removing a habit from the Routine stop generation immediately or let the current period finish? Is "paused" distinct from "done with this habit forever"? (See schema.md Routine section.)

## Reminders for future sessions
- Container/session state does not persist automatically — re-upload the latest docs at the start of a new session to continue from here.
- Diet/grocery tracking (routein) is being treated as a fully separate concern for now — do not conflate schema/scope discussions unless explicitly revisiting the linking question.
- schema.md is the source of truth; notes.md and checklist.md should be kept in sync with it, not the other way around.
