-- Account settings: timezone is either taken from the device on every app load
-- (timezone_auto = true, the default — matches behaviour since 0012) or picked
-- manually and left alone. The timezone itself stays on profiles.timezone, which
-- is what generate_habit_entries() reads.
alter table user_settings add column timezone_auto boolean not null default true;
