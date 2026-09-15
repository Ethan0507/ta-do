-- Free-text notes field on entries, separate from the short "content" line.
alter table entries add column notes text;
