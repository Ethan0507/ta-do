-- Reminders-app-style recurrence: Daily and Weekly can optionally carry a time of day.
-- (Custom already required explicit times; Monthly stays date-only.)
--
-- recurrence_rule shapes, updated:
--   {"freq": "daily"}                                           -- unchanged
--   {"freq": "daily", "time": "HH:MM"}                          -- new: optional time
--   {"freq": "weekly", "weekday": 0-6}                          -- unchanged
--   {"freq": "weekly", "weekday": 0-6, "time": "HH:MM"}         -- new: optional time
--   {"freq": "monthly", "day_of_month": 1-31}                   -- unchanged
--   {"freq": "custom", "weekdays": [0-6, ...], "times": ["HH:MM", ...]} -- unchanged

-- Shared dedupe-and-insert helper, factored out since every recurrence branch now
-- needs the same "one entry per habit per due_date(+due_time)" guard.
create or replace function insert_habit_entry_if_missing(
  p_user_id uuid, p_title text, p_habit_id uuid, p_due_date date, p_due_time time
) returns void as $$
begin
  if not exists (
    select 1 from entries
    where habit_id = p_habit_id and due_date = p_due_date and due_time is not distinct from p_due_time
  ) then
    insert into entries (user_id, type, content, due_date, due_time, habit_id, task_status)
    values (p_user_id, 'task', p_title, p_due_date, p_due_time, p_habit_id, 'open');
  end if;
end;
$$ language plpgsql security definer set search_path = public;

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
      if h.recurrence_rule ? 'time' then
        target_time := (h.recurrence_rule ->> 'time')::time;
        if local_time >= target_time then
          perform insert_habit_entry_if_missing(h.user_id, h.title, h.id, local_date, target_time);
        end if;
      else
        perform insert_habit_entry_if_missing(h.user_id, h.title, h.id, local_date, null);
      end if;

    elsif h.recurrence_rule ->> 'freq' = 'weekly' then
      if local_weekday = (h.recurrence_rule ->> 'weekday')::int then
        if h.recurrence_rule ? 'time' then
          target_time := (h.recurrence_rule ->> 'time')::time;
          if local_time >= target_time then
            perform insert_habit_entry_if_missing(h.user_id, h.title, h.id, local_date, target_time);
          end if;
        else
          perform insert_habit_entry_if_missing(h.user_id, h.title, h.id, local_date, null);
        end if;
      end if;

    elsif h.recurrence_rule ->> 'freq' = 'monthly' then
      if extract(day from local_date) = (h.recurrence_rule ->> 'day_of_month')::int then
        perform insert_habit_entry_if_missing(h.user_id, h.title, h.id, local_date, null);
      end if;

    elsif h.recurrence_rule ->> 'freq' = 'custom' then
      if (h.recurrence_rule -> 'weekdays') @> to_jsonb(local_weekday) then
        for time_text in select jsonb_array_elements_text(h.recurrence_rule -> 'times')
        loop
          target_time := time_text::time;
          if local_time >= target_time then
            perform insert_habit_entry_if_missing(h.user_id, h.title, h.id, local_date, target_time);
          end if;
        end loop;
      end if;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;
