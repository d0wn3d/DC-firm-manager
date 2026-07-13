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
--   alter table firms add column if not exists is_operator boolean not null default false;
--   alter table firms add column if not exists deposit_account_id bigint;
--   (then re-run this whole file once for the item_valuations / ledger_accounts /
--   deposit_requests tables — all CREATE TABLE IF NOT EXISTS, safe alongside your data)
--
-- AFTER migrating: exactly one firm needs is_operator = true (MorattiSolutions,
-- since it's the one actually holding pooled deposits) and deposit_account_id
-- set to whichever of its real Treasury accounts should receive them:
--
--   update firms set is_operator = true, deposit_account_id = <real accountId>
--   where dc_firm_name = 'MorattiSolutions';
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
  is_operator boolean not null default false, -- true only for the custodian firm (MorattiSolutions)
  deposit_account_id bigint,                 -- operator's real Treasury account that receives deposits
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

-- Platform ledger: what each firm is owed from the pooled real money sitting
-- in the operator firm's actual Treasury account. Every credit here MUST be
-- backed by a verified, uniquely-claimed real transaction — see
-- deposit_requests below and lib/ledger.ts. This is the one table in this
-- schema where a bug has real financial consequences for someone besides
-- you; treat changes to it accordingly.
create table if not exists ledger_accounts (
  firm_id uuid not null references firms (id) on delete cascade,
  account_type text not null check (account_type in ('operating', 'savings')),
  balance numeric not null default 0,
  locked_balance numeric not null default 0,  -- reserved for a future savings-lock mechanic
  updated_at timestamptz not null default now(),
  primary key (firm_id, account_type)
);

create table if not exists deposit_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  whole_dollar_amount integer not null check (whole_dollar_amount > 0),
  cents_code integer not null check (cents_code between 0 and 99),
  status text not null default 'pending' check (status in ('pending', 'matched', 'expired', 'cancelled')),
  matched_posting_id bigint,                  -- Treasury's postingId, once matched
  credited_amount numeric,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  matched_at timestamptz
);

-- No two people can be waiting on the same cents code at once.
create unique index if not exists deposit_requests_pending_cents_idx
  on deposit_requests (cents_code) where status = 'pending';

-- The same real transaction can never be credited to two different requests.
create unique index if not exists deposit_requests_matched_posting_idx
  on deposit_requests (matched_posting_id) where matched_posting_id is not null;

alter table firms enable row level security;
alter table firm_members enable row level security;
alter table shops enable row level security;
alter table poll_log enable row level security;
alter table item_valuations enable row level security;
alter table ledger_accounts enable row level security;
alter table deposit_requests enable row level security;

-- No policies added on purpose — see the note at the top of this file.
