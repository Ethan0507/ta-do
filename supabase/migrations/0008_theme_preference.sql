-- User's explicit theme choice: 'light' / 'dark' force a theme, 'auto' follows
-- the device's system setting. Lives on user_settings alongside other
-- per-user app preferences (default_altitude).
alter table user_settings add column theme_preference text not null default 'auto'
  check (theme_preference in ('light', 'dark', 'auto'));
