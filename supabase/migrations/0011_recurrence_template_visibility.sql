-- Separate a repeating task's "definition" from its day-to-day occurrences.
--
-- Previously, turning on repeat archived the source Task Entry so it wouldn't show
-- twice in the daily list. That hid it everywhere, including Library, and gave no way
-- to edit the series (title/recurrence rule) except by re-opening one of the generated
-- occurrences. Instead: mark that source Entry as the recurrence's template row
-- (is_recurrence_template = true, undated) rather than archiving it.
--
-- Visibility split:
--   - Daily/Upcoming views: exclude template rows (is_recurrence_template = false) —
--     only real, dated occurrences show up there.
--   - Library: exclude generated occurrences (habit_id set AND is_recurrence_template
--     = false) — only the template row (or a plain non-repeating entry) shows there,
--     so Library isn't flooded with months of daily-generated rows.

alter table entries add column is_recurrence_template boolean not null default false;
