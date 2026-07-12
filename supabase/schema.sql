-- Stockbook schema
-- Run this once in the Supabase SQL editor for a fresh project.
--
-- ALREADY RAN THIS BEFORE? You only need these lines, not the whole file
-- (the CREATE TABLEs below are IF NOT EXISTS and won't touch your existing
-- data, but they also won't add columns to tables that already exist):
--
--   alter table firms add column if not exists treasury_jwt_expires_at timestamptz;
--   alter table shops alter column buy_price type text;
--   alter table shops alter column sell_price type text;
--   alter table shops add column if not exists manual_stock integer;
--   alter table shops add column if not exists manual_stock_at timestamptz;
--   (then re-run this whole file once — the item_valuations CREATE TABLE
--   below is new and IF NOT EXISTS will just add it alongside your data)
--
-- Security model: every table below has RLS enabled with NO policies for
-- the anon/authenticated roles. That's deliberate, not an oversight — the
-- app never lets the browser query Supabase directly for firm or shop data.
-- Every read and write goes through a Next.js Route Handler / Server Action
-- running on the server, which uses the service-role key (full access,
-- bypasses RLS) and explicitly scopes every query to a firm the logged-in
-- user has been verified to belong to. See src/lib/supabase/service.ts.

create table if not exists firms (
  id uuid primary key default gen_random_uuid(),
  dc_firm_id integer not null unique,        -- firmId from the Treasury API
  dc_firm_name text not null,                -- display-name at connect time
  treasury_jwt text not null,                -- from /treasuryapi business issue
  treasury_jwt_expires_at timestamptz,        -- decoded from the JWT's exp claim
  jwt_invalid boolean not null default false, -- set true on a 401 from the API
  discord_webhook_url text,                  -- where low-stock alerts post to
  created_at timestamptz not null default now()
);

create table if not exists firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create table if not exists shops (
  shop_id bigint primary key,                -- shopId from the Treasury API
  firm_id uuid not null references firms (id) on delete cascade,
  world text not null,
  x integer not null,
  y integer not null,
  z integer not null,
  admin_shop boolean not null default false,
  account_type text,
  owner_uuid text,
  owner_name text,
  material text,
  item_key text not null,
  item_name text,
  item_custom boolean not null default false,
  buy_price text,                            -- decimal string, as DC sends it — never cast to a JS number
  sell_price text,
  batch_qty integer,
  current_stock integer,
  stock_at timestamptz,
  last_seen timestamptz,
  manual_stock integer,                      -- hand-entered override
  manual_stock_at timestamptz,                -- when it was set — whichever of
                                               -- (this) or (stock_at) is newer wins,
                                               -- see effectiveStock() in lib/stock.ts
  low_stock_threshold integer,               -- null = no alert configured
  notes text,
  last_alert_state text not null default 'ok' check (last_alert_state in ('ok', 'low', 'empty')),
  updated_at timestamptz not null default now()
);

create index if not exists shops_firm_id_idx on shops (firm_id);

create table if not exists item_valuations (
  firm_id uuid not null references firms (id) on delete cascade,
  item_key text not null,
  item_name text,
  unit_value numeric,                        -- null if genuinely unpriceable
  value_source text not null default 'unavailable'
    check (value_source in ('market_24h', 'own_shops_fallback', 'unavailable')),
  total_quantity integer not null default 0,
  total_value numeric not null default 0,
  computed_at timestamptz not null default now(),
  primary key (firm_id, item_key)
);

create table if not exists poll_log (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  polled_at timestamptz not null default now(),
  success boolean not null,
  shops_synced integer not null default 0,
  error text
);

create index if not exists poll_log_firm_id_idx on poll_log (firm_id, polled_at desc);

alter table firms enable row level security;
alter table firm_members enable row level security;
alter table shops enable row level security;
alter table poll_log enable row level security;
alter table item_valuations enable row level security;

-- No policies added on purpose — see the note at the top of this file.
