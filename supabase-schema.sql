-- Navlog admin schema (run in Supabase SQL editor)

create extension if not exists pgcrypto;

create table if not exists public.route_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  departure text not null,
  destination text not null,
  legs_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists route_presets_dep_dest_idx
  on public.route_presets (departure, destination);

create table if not exists public.waypoints (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  coord text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.rpc_registry (
  id uuid primary key default gen_random_uuid(),
  registration text not null unique,
  aircraft_type text not null default '',
  cas_climb text not null default '',
  cas_cruise text not null default '',
  gph text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.airports (
  code text primary key,
  id text not null,
  cpt_atis text not null default '',
  dep_aap text not null default '',
  twr text not null default '',
  gnd text not null default '',
  fss text not null default '',
  remarks text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.content_pages (
  key text primary key,
  body_html text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists route_presets_touch_updated_at on public.route_presets;
create trigger route_presets_touch_updated_at
before update on public.route_presets
for each row execute function public.touch_updated_at();

drop trigger if exists airports_touch_updated_at on public.airports;
create trigger airports_touch_updated_at
before update on public.airports
for each row execute function public.touch_updated_at();

drop trigger if exists waypoints_touch_updated_at on public.waypoints;
create trigger waypoints_touch_updated_at
before update on public.waypoints
for each row execute function public.touch_updated_at();

drop trigger if exists rpc_registry_touch_updated_at on public.rpc_registry;
create trigger rpc_registry_touch_updated_at
before update on public.rpc_registry
for each row execute function public.touch_updated_at();

drop trigger if exists content_pages_touch_updated_at on public.content_pages;
create trigger content_pages_touch_updated_at
before update on public.content_pages
for each row execute function public.touch_updated_at();

alter table public.route_presets enable row level security;
alter table public.airports enable row level security;
alter table public.waypoints enable row level security;
alter table public.rpc_registry enable row level security;
alter table public.content_pages enable row level security;

drop policy if exists route_presets_public_read on public.route_presets;
create policy route_presets_public_read
on public.route_presets
for select
to anon, authenticated
using (true);

drop policy if exists airports_public_read on public.airports;
create policy airports_public_read
on public.airports
for select
to anon, authenticated
using (true);

drop policy if exists waypoints_public_read on public.waypoints;
create policy waypoints_public_read
on public.waypoints
for select
to anon, authenticated
using (true);

drop policy if exists rpc_registry_public_read on public.rpc_registry;
create policy rpc_registry_public_read
on public.rpc_registry
for select
to anon, authenticated
using (true);

drop policy if exists content_pages_public_read on public.content_pages;
create policy content_pages_public_read
on public.content_pages
for select
to anon, authenticated
using (true);

-- Quick-start admin write policy:
-- authenticated users can modify admin content.
-- Keep only trusted admin users in your Supabase Auth project.
drop policy if exists route_presets_admin_write on public.route_presets;
create policy route_presets_admin_write
on public.route_presets
for all
to authenticated
using (true)
with check (true);

drop policy if exists airports_admin_write on public.airports;
create policy airports_admin_write
on public.airports
for all
to authenticated
using (true)
with check (true);

drop policy if exists waypoints_admin_write on public.waypoints;
create policy waypoints_admin_write
on public.waypoints
for all
to authenticated
using (true)
with check (true);

drop policy if exists rpc_registry_admin_write on public.rpc_registry;
create policy rpc_registry_admin_write
on public.rpc_registry
for all
to authenticated
using (true)
with check (true);

drop policy if exists content_pages_admin_write on public.content_pages;
create policy content_pages_admin_write
on public.content_pages
for all
to authenticated
using (true)
with check (true);

