-- Recurring tasks: task entries can now repeat via their linked Habit's recurrence_rule.
-- Generation happens server-side on a schedule (not just on completion), so a repeating
-- task's next occurrence appears even if the previous one was never checked off.

alter table entries add column due_time time;

-- ============================================================
-- generate_habit_entries: creates the next Task occurrence(s) for every Habit
-- that is active (a member of its user's Routine) and due, per its recurrence_rule.
--
-- recurrence_rule shapes:
--   {"freq": "daily"}
--   {"freq": "weekly", "weekday": 0-6}                         -- 0 = Sunday
--   {"freq": "monthly", "day_of_month": 1-31}
--   {"freq": "custom", "weekdays": [0-6, ...], "times": ["HH:MM", ...]}
--
-- Dedupes against already-generated entries so re-running (or a missed cron tick)
-- never produces duplicates.
-- ============================================================
create or replace function generate_habit_entries()
returns void as $$
declare
  h record;
  local_date date;
  local_time time;
  local_weekday int;
  time_text text;
  target_time time;
begin
  for h in
    select habits.id, habits.user_id, habits.title, habits.recurrence_rule, profiles.timezone
    from habits
    join routine_habits on routine_habits.habit_id = habits.id
    join routines on routines.id = routine_habits.routine_id
    join profiles on profiles.id = habits.user_id
  loop
    local_date := (now() at time zone h.timezone)::date;
    local_time := (now() at time zone h.timezone)::time;
    local_weekday := extract(dow from local_date);

    if h.recurrence_rule ->> 'freq' = 'daily' then
      if not exists (select 1 from entries where habit_id = h.id and due_date = local_date) then
        insert into entries (user_id, type, content, due_date, habit_id, task_status)
        values (h.user_id, 'task', h.title, local_date, h.id, 'open');
      end if;

    elsif h.recurrence_rule ->> 'freq' = 'weekly' then
      if local_weekday = (h.recurrence_rule ->> 'weekday')::int
         and not exists (select 1 from entries where habit_id = h.id and due_date = local_date) then
        insert into entries (user_id, type, content, due_date, habit_id, task_status)
        values (h.user_id, 'task', h.title, local_date, h.id, 'open');
      end if;

    elsif h.recurrence_rule ->> 'freq' = 'monthly' then
      if extract(day from local_date) = (h.recurrence_rule ->> 'day_of_month')::int
         and not exists (select 1 from entries where habit_id = h.id and due_date = local_date) then
        insert into entries (user_id, type, content, due_date, habit_id, task_status)
        values (h.user_id, 'task', h.title, local_date, h.id, 'open');
      end if;

    elsif h.recurrence_rule ->> 'freq' = 'custom' then
      if (h.recurrence_rule -> 'weekdays') @> to_jsonb(local_weekday) then
        for time_text in select jsonb_array_elements_text(h.recurrence_rule -> 'times')
        loop
          target_time := time_text::time;
          if local_time >= target_time
             and not exists (
               select 1 from entries where habit_id = h.id and due_date = local_date and due_time = target_time
             ) then
            insert into entries (user_id, type, content, due_date, due_time, habit_id, task_status)
            values (h.user_id, 'task', h.title, local_date, target_time, h.id, 'open');
          end if;
        end loop;
      end if;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- Schedule it. Requires the pg_cron extension; on hosted Supabase this may need
-- to be enabled once via Dashboard > Database > Extensions if this statement fails.
-- ============================================================
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'generate-habit-entries') then
    perform cron.unschedule('generate-habit-entries');
  end if;
end $$;

select cron.schedule('generate-habit-entries', '*/15 * * * *', $$select generate_habit_entries()$$);
