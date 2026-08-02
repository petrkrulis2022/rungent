-- RUNDOWN demo schema.
-- Target: the DEDICATED Supabase project odnxttczxgvejbcwextz.
--
-- Safe to re-run during development: this project holds nothing but RUNDOWN,
-- so the drops below can only ever destroy RUNDOWN's own demo data. Do NOT
-- run this against any project that also hosts Goal.live or anything else —
-- the table names here (legs, events, items, hunters) are generic and will
-- collide.
--
-- SECURITY MODEL (read before changing anything):
-- This demo is a public shareable link, so the anon key ships in the bundle
-- and every visitor has it. RLS is therefore the ONLY thing preventing a
-- hunter from reading the Rungent's true position and trivially winning.
-- `rungent_state` is readable by NOBODY through the anon key. Hunters obtain
-- position exclusively via `get_rungent_for_hunter()`, a SECURITY DEFINER
-- function that range-gates the response against the server's own truth.

create extension if not exists postgis;

drop function if exists get_rungent_for_hunter(uuid, double precision, double precision);
drop table if exists events cascade;
drop table if exists catches cascade;
drop table if exists items cascade;
drop table if exists hunters cascade;
drop table if exists rungent_state cascade;
drop table if exists legs cascade;

-- ---------------------------------------------------------------- legs
create table legs (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  story                 text not null default '',
  deployer_wallet       text not null,
  start_lat             double precision not null,
  start_lng             double precision not null,
  start_alt             double precision not null default 0,
  end_lat               double precision not null,
  end_lng               double precision not null,
  end_alt               double precision not null default 0,
  skills                jsonb not null default '{}'::jsonb,
  -- Committed route polyline: snapped + elevation-sampled ONCE at plan time,
  -- never per tick. The simulator interpolates along this locally.
  route_polyline        jsonb not null default '[]'::jsonb,
  route_length_m        double precision not null default 0,
  rules_hash            text,
  prize_escrow_addr     text,
  operating_wallet_addr text,
  prize_amount          numeric not null default 0,
  onchain_commit_tx     text,
  status                text not null default 'draft'
                        check (status in ('draft','committed','active','settled')),
  created_at            timestamptz not null default now()
);

-- ------------------------------------------------------- rungent_state
-- NEVER exposed to clients. No anon SELECT policy exists for this table.
create table rungent_state (
  leg_id            uuid primary key references legs(id) on delete cascade,
  true_lat          double precision not null,
  true_lng          double precision not null,
  true_alt          double precision not null default 0,
  -- Distance travelled along the committed polyline, in meters. This is the
  -- Rungent's ONLY degree of freedom, which makes teleporting and leaving
  -- route bounds structurally impossible rather than merely validated.
  route_progress_m  double precision not null default 0,
  mode              text not null default 'walk' check (mode in ('idle','walk','run')),
  speed_kmh         double precision not null default 6,
  heading_deg       double precision not null default 0,
  status            text not null default 'alive' check (status in ('alive','down')),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------- hunters
create table hunters (
  leg_id        uuid not null references legs(id) on delete cascade,
  wallet_addr   text not null,
  display_name  text not null default 'Hunter',
  avatar_glb    text,
  last_lat      double precision,
  last_lng      double precision,
  last_alt      double precision,
  has_gun       boolean not null default false,
  last_seen_at  timestamptz not null default now(),
  primary key (leg_id, wallet_addr)
);

-- --------------------------------------------------------------- items
create table items (
  id            uuid primary key default gen_random_uuid(),
  leg_id        uuid not null references legs(id) on delete cascade,
  kind          text not null default 'gun' check (kind in ('gun')),
  lat           double precision not null,
  lng           double precision not null,
  alt           double precision not null default 0,
  status        text not null default 'available'
                check (status in ('available','held','consumed')),
  owner_wallet  text
);

-- ------------------------------------------------------------- catches
create table catches (
  id            uuid primary key default gen_random_uuid(),
  leg_id        uuid not null references legs(id) on delete cascade,
  hunter_wallet text not null,
  method        text not null check (method in ('shoot','catch')),
  claimed_lat   double precision not null,
  claimed_lng   double precision not null,
  ts            timestamptz not null default now(),
  verify_status text not null default 'pending'
                check (verify_status in ('pending','verified','rejected')),
  reject_reason text,
  settled_tx    text
);

-- Exactly one verified catch per leg, enforced in the DB rather than only in
-- app code, so a race between two simultaneous FIRE requests cannot double-pay.
create unique index catches_one_verified_per_leg
  on catches (leg_id) where verify_status = 'verified';

-- -------------------------------------------------------------- events
create table events (
  id      bigserial primary key,
  leg_id  uuid not null references legs(id) on delete cascade,
  type    text not null,
  payload jsonb not null default '{}'::jsonb,
  ts      timestamptz not null default now()
);

-- ================================================================ RLS
alter table legs          enable row level security;
alter table rungent_state enable row level security;
alter table hunters       enable row level security;
alter table items         enable row level security;
alter table catches       enable row level security;
alter table events        enable row level security;

-- legs: public metadata readable — required for the shareable join link.
-- Start/end points are committed on-chain and public by design. Current
-- position is NOT in this table.
create policy legs_public_read on legs
  for select to anon, authenticated using (true);

-- Permissionless deploy, mirroring LegCommit.sol having no admin.
create policy legs_public_insert on legs
  for insert to anon, authenticated with check (true);

-- rungent_state: NO policy of any kind, deliberately. RLS enabled with zero
-- policies denies all client access by default. Only service_role (the
-- simulator and oracle) can touch it. DO NOT add a select policy here.

-- hunters: mutually visible so avatars render in AR; each can upsert itself.
create policy hunters_public_read on hunters
  for select to anon, authenticated using (true);
create policy hunters_public_write on hunters
  for insert to anon, authenticated with check (true);
create policy hunters_public_update on hunters
  for update to anon, authenticated using (true) with check (true);

create policy items_public_read on items
  for select to anon, authenticated using (true);

-- catches: readable so the UI can show the result, but clients may NEVER
-- insert. A takedown is a REQUEST to an Edge Function which validates against
-- server truth and writes with service_role. Client insert here would let a
-- hunter simply declare victory.
create policy catches_public_read on catches
  for select to anon, authenticated using (true);

create policy events_public_read on events
  for select to anon, authenticated using (true);

-- ====================================================== range-gated access
-- The ONLY path by which a client learns where the Rungent is.
create or replace function get_rungent_for_hunter(
  p_leg_id uuid,
  p_hunter_lat double precision,
  p_hunter_lng double precision
)
returns table (
  lat double precision,
  lng double precision,
  alt double precision,
  mode text,
  heading_deg double precision,
  status text,
  distance_m double precision,
  in_range boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s rungent_state%rowtype;
  d double precision;
  engagement_range_m constant double precision := 75;
begin
  select * into s from rungent_state where leg_id = p_leg_id;
  if not found then
    return;
  end if;

  -- Distance is computed from the SERVER's truth against the client's claimed
  -- position. A client lying about where it stands only moves the range gate;
  -- it never reveals a position it should not see.
  d := ST_DistanceSphere(
         ST_MakePoint(s.true_lng, s.true_lat),
         ST_MakePoint(p_hunter_lng, p_hunter_lat)
       );

  if d > engagement_range_m then
    -- Out of range: reveal nothing but the fact of being out of range. No
    -- bearing, no coarse position — those would let a hunter triangulate.
    return query select
      null::double precision, null::double precision, null::double precision,
      null::text, null::double precision, s.status,
      null::double precision, false;
  else
    return query select
      s.true_lat, s.true_lng, s.true_alt,
      s.mode, s.heading_deg, s.status,
      d, true;
  end if;
end;
$$;

revoke all on function get_rungent_for_hunter from public;
grant execute on function get_rungent_for_hunter to anon, authenticated;

-- Realtime: hunters, events and catches are broadcast. rungent_state is NOT —
-- adding it here would bypass the range gate entirely.
alter publication supabase_realtime add table hunters;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table catches;
