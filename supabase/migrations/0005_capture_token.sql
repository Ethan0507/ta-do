-- Per-user capture token: identifies which user a Shortcuts capture request
-- belongs to, so the same capture-entry function can serve every user
-- (instead of being hard-wired to one SHORTCUT_USER_ID).
alter table profiles add column capture_token text unique not null default encode(gen_random_bytes(24), 'hex');
