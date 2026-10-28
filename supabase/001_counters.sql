-- PS5 Jailbreak Tracker: counters (reactions, page views) and live presence.
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Only the server touches these (secret key → service_role). RLS is on with no policies, and
-- anon/authenticated have no grants, so the public publishable key cannot read or write them.

create table if not exists public.counters (
  key text primary key,            -- "pageviews" or "reactions:<repo>:<reaction>"
  value bigint not null default 0 check (value >= 0)
);

create table if not exists public.presence (
  id uuid primary key,             -- random per-tab id; no IP, UA or other visitor data
  seen_at timestamptz not null
);
create index if not exists presence_seen_at_idx on public.presence (seen_at);

alter table public.counters enable row level security;
alter table public.presence enable row level security;

-- Adds each delta atomically ({"reactions:pasta:heart": 1, ...}) and returns the new values.
create or replace function public.incr_counters(deltas jsonb)
returns table (key text, value bigint)
language sql
security invoker
set search_path = public
as $$
  insert into public.counters as c (key, value)
  select d.key, d.value::bigint from jsonb_each_text(deltas) as d(key, value)
  where d.value::bigint > 0
  on conflict (key) do update set value = c.value + excluded.value
  returning c.key, c.value;
$$;

-- One call per server flush: upsert heartbeats ({"<uuid>": <epoch ms>}), drop tabs that left and
-- tabs not seen within ttl_seconds, add page views; returns online count and page-view total.
create or replace function public.presence_flush(beats jsonb, gone uuid[], ttl_seconds int, views bigint)
returns table (online bigint, pageviews bigint)
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.presence (id, seen_at)
  select b.key::uuid, to_timestamp(b.value::double precision / 1000)
  from jsonb_each_text(beats) as b(key, value)
  on conflict (id) do update set seen_at = greatest(public.presence.seen_at, excluded.seen_at);

  if coalesce(array_length(gone, 1), 0) > 0 then
    delete from public.presence where id = any(gone);
  end if;
  delete from public.presence where seen_at < now() - make_interval(secs => ttl_seconds);

  if views > 0 then
    insert into public.counters as c (key, value) values ('pageviews', views)
    on conflict (key) do update set value = c.value + excluded.value;
  end if;

  return query
    select (select count(*) from public.presence),
           coalesce((select c.value from public.counters c where c.key = 'pageviews'), 0);
end;
$$;

revoke all on table public.counters, public.presence from anon, authenticated;
revoke execute on function public.incr_counters(jsonb) from public, anon, authenticated;
revoke execute on function public.presence_flush(jsonb, uuid[], int, bigint) from public, anon, authenticated;
grant select, insert, update, delete on table public.counters, public.presence to service_role;
grant execute on function public.incr_counters(jsonb) to service_role;
grant execute on function public.presence_flush(jsonb, uuid[], int, bigint) to service_role;
