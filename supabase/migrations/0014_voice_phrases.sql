-- Voice command phrases a user has customised (docs/checklist.md Phase 2.6).
-- Default phrases live in the app (CommandParser.defaultPhrases); this table only holds
-- the user's changes: their own extra phrases ('custom') and defaults they've switched
-- off ('disabled_default'). Effective phrases = defaults − disabled + custom.
create table voice_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('task', 'thought', 'goal', 'label', 'repeating', 'due', 'note', 'next')),
  phrase text not null check (length(btrim(phrase)) between 1 and 40),
  kind text not null default 'custom' check (kind in ('custom', 'disabled_default')),
  created_at timestamptz not null default now()
);

-- A phrase means one thing per user, whichever action it belongs to.
create unique index voice_phrases_user_phrase_idx on voice_phrases (user_id, lower(btrim(phrase)), kind);

alter table voice_phrases enable row level security;

create policy "own voice_phrases" on voice_phrases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
