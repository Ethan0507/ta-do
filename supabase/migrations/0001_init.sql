-- Ta-do initial schema, per docs/schema.md v0.2
-- Note: schema.md lists a single "status" field per type (Task: open/done, Goal: ongoing/achieved).
-- Since Entry is one physical table, these are realized as two distinct columns here:
-- task_status and goal_status.

create extension if not exists pgcrypto;

-- ============================================================
-- profiles (extends auth.users with app-specific fields)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now()
);

create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  default_altitude text not null default 'day' check (default_altitude in ('day', 'week', 'month', 'year'))
);

-- Auto-create profile + settings row on signup
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- categories
-- ============================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = global/base category
  name text not null,
  created_at timestamptz not null default now()
);

insert into categories (name, user_id)
select name, null from (values ('Spiritual'), ('Physical'), ('Psychological'), ('Career')) as base(name)
where not exists (select 1 from categories where categories.name = base.name and categories.user_id is null);

-- ============================================================
-- habits (created before entries so entries.habit_id can reference it)
-- ============================================================
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  recurrence_rule jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- entries (core object: thought / goal / task)
-- ============================================================
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'thought' check (type in ('thought', 'goal', 'task')),
  content text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  habit_id uuid references habits(id) on delete set null,

  -- Task-specific
  due_date date,
  priority integer,
  task_status text check (task_status in ('open', 'done')),
  completed_at timestamptz,

  -- Goal-specific
  period_scope text check (period_scope in ('week', 'month', 'year')),
  period_identifier text,
  target_metric text,
  goal_status text check (goal_status in ('ongoing', 'achieved')),
  achieved_at timestamptz
);

create index entries_user_id_idx on entries(user_id);
create index entries_habit_id_idx on entries(habit_id);

-- ============================================================
-- entry_categories (join table)
-- ============================================================
create table entry_categories (
  entry_id uuid not null references entries(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (entry_id, category_id)
);

-- ============================================================
-- routines / routine_habits (draft model, see docs/schema.md)
-- ============================================================
create table routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table routine_habits (
  routine_id uuid not null references routines(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  primary key (routine_id, habit_id)
);

-- ============================================================
-- goal_habits (join table: a Goal can have multiple Habits, and vice versa)
-- ============================================================
create table goal_habits (
  goal_entry_id uuid not null references entries(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  primary key (goal_entry_id, habit_id)
);

-- ============================================================
-- period_targets
-- ============================================================
create table period_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month', 'year')),
  period_identifier text not null,
  category_id uuid references categories(id) on delete cascade,
  description text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- reviews (post-MVP)
-- ============================================================
create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  period_identifier text not null,
  reflection_content text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table user_settings enable row level security;
alter table categories enable row level security;
alter table habits enable row level security;
alter table entries enable row level security;
alter table entry_categories enable row level security;
alter table routines enable row level security;
alter table routine_habits enable row level security;
alter table goal_habits enable row level security;
alter table period_targets enable row level security;
alter table reviews enable row level security;

create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own settings" on user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read global or own categories" on categories
  for select using (user_id is null or user_id = auth.uid());
create policy "write own categories" on categories
  for insert with check (user_id = auth.uid());
create policy "update own categories" on categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own categories" on categories
  for delete using (user_id = auth.uid());

create policy "own habits" on habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own entries" on entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own entry_categories" on entry_categories
  for all using (
    exists (select 1 from entries where entries.id = entry_categories.entry_id and entries.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries where entries.id = entry_categories.entry_id and entries.user_id = auth.uid())
    and exists (select 1 from categories where categories.id = entry_categories.category_id and (categories.user_id is null or categories.user_id = auth.uid()))
  );

create policy "own routines" on routines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own routine_habits" on routine_habits
  for all using (
    exists (select 1 from routines where routines.id = routine_habits.routine_id and routines.user_id = auth.uid())
  ) with check (
    exists (select 1 from routines where routines.id = routine_habits.routine_id and routines.user_id = auth.uid())
    and exists (select 1 from habits where habits.id = routine_habits.habit_id and habits.user_id = auth.uid())
  );

create policy "own goal_habits" on goal_habits
  for all using (
    exists (select 1 from entries where entries.id = goal_habits.goal_entry_id and entries.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries where entries.id = goal_habits.goal_entry_id and entries.user_id = auth.uid())
    and exists (select 1 from habits where habits.id = goal_habits.habit_id and habits.user_id = auth.uid())
  );

create policy "own period_targets" on period_targets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own reviews" on reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
