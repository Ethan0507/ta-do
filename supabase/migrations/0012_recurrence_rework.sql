-- Recurring tasks, reworked to the spec in docs/schema.md ("Recurring tasks — specification").
--
-- Template (is_recurrence_template) lives in Library only; generated tasks (is_generated)
-- live on Home only and are fully independent copies of the template made at the start
-- of each day in the user's timezone. A generated task left open past its day is marked
-- 'missed'. Every rule carries at most one optional time.

-- ============================================================
-- Columns / constraints
-- ============================================================
alter table entries add column is_generated boolean not null default false;

update entries set is_generated = true
where habit_id is not null and is_recurrence_template = false;

alter table entries drop constraint if exists entries_task_status_check;
alter table entries add constraint entries_task_status_check
  check (task_status in ('open', 'done', 'missed'));

-- Templates are configs, never tickable.
update entries set task_status = 'open', completed_at = null
where is_recurrence_template = true and task_status is distinct from 'open';
alter table entries add constraint entries_template_not_completed
  check (not is_recurrence_template or task_status = 'open');

-- ============================================================
-- One optional time per rule: custom {"times": [...]} -> {"time": first}
-- ============================================================
update habits
set recurrence_rule = case
  when jsonb_array_length(coalesce(recurrence_rule -> 'times', '[]'::jsonb)) > 0
    then (recurrence_rule - 'times') || jsonb_build_object('time', recurrence_rule -> 'times' ->> 0)
  else recurrence_rule - 'times'
end
where recurrence_rule ->> 'freq' = 'custom' and recurrence_rule ? 'times';

-- ============================================================
-- Generator
-- ============================================================
drop function if exists generate_habit_entries();
drop function if exists insert_habit_entry_if_missing(uuid, text, uuid, date, time);

-- Called by pg_cron (no auth.uid(): every user) and by the app (auth.uid() set: only that user).
create or replace function generate_habit_entries(p_user_id uuid default null)
returns void as $$
declare
  scope_user uuid := coalesce(auth.uid(), p_user_id);
  t record;
  local_date date;
  rule jsonb;
  matches boolean;
  new_id uuid;
begin
  -- Serialize runs so a cron tick and an app-load call can't both insert today's task.
  perform pg_advisory_xact_lock(hashtext('generate_habit_entries'));

  -- 1. Generated tasks left open past their day are missed.
  update entries e
  set task_status = 'missed'
  from profiles p
  where e.user_id = p.id
    and (scope_user is null or e.user_id = scope_user)
    and e.is_generated
    and e.task_status = 'open'
    and e.due_date < (now() at time zone p.timezone)::date;

  -- 2. Today's task for every active, unarchived template whose rule matches today.
  for t in
    select tpl.id as template_id, tpl.user_id, tpl.content, tpl.notes, h.id as habit_id, h.recurrence_rule, p.timezone
    from entries tpl
    join habits h on h.id = tpl.habit_id
    join routine_habits rh on rh.habit_id = h.id
    join profiles p on p.id = tpl.user_id
    where tpl.is_recurrence_template
      and tpl.archived_at is null
      and (scope_user is null or tpl.user_id = scope_user)
  loop
    local_date := (now() at time zone t.timezone)::date;
    rule := t.recurrence_rule;

    matches := case rule ->> 'freq'
      when 'daily' then true
      when 'weekly' then extract(dow from local_date)::int = (rule ->> 'weekday')::int
      when 'monthly' then extract(day from local_date)::int = (rule ->> 'day_of_month')::int
      when 'custom' then (rule -> 'weekdays') @> to_jsonb(extract(dow from local_date)::int)
      else false
    end;

    if matches and not exists (
      select 1 from entries where habit_id = t.habit_id and is_generated and due_date = local_date
    ) then
      insert into entries (user_id, type, content, notes, due_date, due_time, habit_id, is_generated, task_status)
      values (t.user_id, 'task', t.content, t.notes, local_date, (rule ->> 'time')::time, t.habit_id, true, 'open')
      returning id into new_id;

      insert into entry_categories (entry_id, category_id)
      select new_id, category_id from entry_categories where entry_id = t.template_id;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- Signed-in users can only ever run it for themselves (auth.uid() wins over p_user_id).
revoke execute on function generate_habit_entries(uuid) from public, anon;
grant execute on function generate_habit_entries(uuid) to authenticated;

-- Re-point the existing schedule at the new signature.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'generate-habit-entries') then
    perform cron.unschedule('generate-habit-entries');
  end if;
end $$;

select cron.schedule('generate-habit-entries', '*/15 * * * *', $$select generate_habit_entries()$$);
