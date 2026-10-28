-- PS5 Jailbreak Tracker: durable store for AI summaries (one per commit SHA).
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Every page and server instance reads the same stored summary, so the progress bar is identical
-- in every language and survives redeploys. Server-only, like 001_counters.sql.

create table if not exists public.kv (
  key text primary key,            -- e.g. "sum:v4:zig:<sha>" or "sum:v4:overall:<shas>"
  value jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.kv enable row level security;

revoke all on table public.kv from anon, authenticated;
grant select, insert, update, delete on table public.kv to service_role;
