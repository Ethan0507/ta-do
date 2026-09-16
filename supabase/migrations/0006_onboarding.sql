-- Tracks whether a user has been shown the first-run Shortcuts setup walkthrough.
alter table profiles add column onboarded_at timestamptz;
