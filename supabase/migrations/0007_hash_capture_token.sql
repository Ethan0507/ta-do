-- Store only a SHA-256 hash of each capture token, matching how passwords
-- and API keys are normally protected — a leaked profiles table no longer
-- hands out usable tokens directly. Existing plaintext tokens are hashed
-- in place first so already-configured Shortcuts keep working; the raw
-- value can no longer be read back afterward (the app shows it once, at
-- generation time, and never again).
alter table profiles add column capture_token_hash text unique;
update profiles set capture_token_hash = encode(digest(capture_token, 'sha256'), 'hex') where capture_token is not null;
alter table profiles drop column capture_token;
