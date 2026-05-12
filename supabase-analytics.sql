-- Native analytics storage for Vercel Drain events
-- Run this in Supabase SQL editor

create table if not exists public.analytics_events (
  id bigserial primary key,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  path text not null default '/',
  route text not null default '',
  referrer text not null default '',
  country text not null default '',
  device_id text not null default '',
  client_name text not null default '',
  device_type text not null default '',
  vercel_environment text not null default '',
  raw_event jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);

create index if not exists analytics_events_event_type_idx
  on public.analytics_events (event_type);

create index if not exists analytics_events_path_idx
  on public.analytics_events (path);

