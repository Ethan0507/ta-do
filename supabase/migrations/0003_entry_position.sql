-- Manual ordering for the Home "today" list, via fractional indexing
-- (new position = midpoint of neighbors' positions on reorder; see src/lib/entries.ts).

alter table entries add column position float8;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc) as rn
  from entries
)
update entries
set position = ranked.rn * 1024
from ranked
where entries.id = ranked.id;

create index entries_user_position_idx on entries(user_id, position);
