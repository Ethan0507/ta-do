-- Backfill profiles/user_settings for any auth.users created before the
-- handle_new_user trigger existed (e.g. the first user, created manually
-- via the dashboard prior to this migration).
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.user_settings (user_id)
select u.id from auth.users u
where not exists (select 1 from public.user_settings s where s.user_id = u.id);
