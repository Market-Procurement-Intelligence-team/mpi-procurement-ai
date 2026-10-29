-- ============================================================================
-- MPI · Migration 20261028150000 · Price guide for suppliers
--
-- Client request (28 Oct): while a supplier fills in a quote, show them the
-- usual price range for each item and 3 suggested prices with their chance
-- of winning. The startup's budget is never used.
--
--   1. sample_past_prices: sample prices for the demo, so the demo shows a
--      range built from past quotes. They are used ONLY on demo requests
--      (requests from demo accounts); real requests never see them.
--   2. price_guide(request_line_id): for one line of a request, the range of
--      past prices for the same catalogue item and unit:
--        low = 25th percentile, typical = middle, high = 75th percentile,
--      per unit, after the supplier's discount, before GST.
--      Rules:
--        - only quotes on OTHER requests ("past quotes"); the other live
--          quotes on the same request are never used;
--        - never the budget;
--        - real requests use real quotes only; demo requests use demo quotes
--          and the sample prices;
--        - at least 5 prices, otherwise source = 'too_few' and the app asks
--          the AI for a market estimate instead (netlify/functions/price-estimate.ts);
--        - win_pct_*: the real share of quotes at or below that price that
--          won. Empty until the item has 20 decided quotes (won or lost);
--          until then the app shows High / Medium / Low from the position in
--          the range (rivanah, 28 Oct).
--      Only the invited suppliers of that request and the admin can ask.
--
-- Run after 20261028140000_hide_budget_from_suppliers.sql. Safe to run again.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Sample prices for the demo
-- ----------------------------------------------------------------------------
create table if not exists public.sample_past_prices (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.catalogue_items (id) on delete cascade,
  unit       text not null,
  unit_price numeric(14,2) not null check (unit_price > 0),   -- per unit, before GST
  quantity   numeric(14,3) check (quantity is null or quantity > 0),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists sample_past_prices_item_idx on public.sample_past_prices (item_id);

comment on table public.sample_past_prices is
  'Sample past prices, used only for demo requests. Real requests never use them.';

-- Nobody reads this table directly; price_guide() reads it for demo requests.
alter table public.sample_past_prices enable row level security;
revoke all on public.sample_past_prices from public, anon, authenticated;

-- The samples are reloaded each time this file runs. Rapid prototyping has
-- none on purpose, so the demo also shows the AI estimate.
delete from public.sample_past_prices;
insert into public.sample_past_prices (item_id, unit, unit_price, quantity, note)
select i.id, v.unit, v.unit_price, v.quantity, 'Demo sample'
  from (values
    -- 3-ply printed corrugated boxes / mailers
    ('Corrugated boxes', 'pcs', 17.50, 3000), ('Corrugated boxes', 'pcs', 18.00, 5000),
    ('Corrugated boxes', 'pcs', 18.50, 2000), ('Corrugated boxes', 'pcs', 19.00, 2500),
    ('Corrugated boxes', 'pcs', 19.50, 1500), ('Corrugated boxes', 'pcs', 20.00, 2000),
    ('Corrugated boxes', 'pcs', 20.00, 1000), ('Corrugated boxes', 'pcs', 21.00, 1000),
    ('Corrugated boxes', 'pcs', 21.50, 1200), ('Corrugated boxes', 'pcs', 22.00, 800),
    ('Corrugated boxes', 'pcs', 23.00, 600),  ('Corrugated boxes', 'pcs', 24.50, 500),
    -- printed product labels on rolls
    ('Product labels', 'pcs', 0.75, 25000), ('Product labels', 'pcs', 0.80, 20000),
    ('Product labels', 'pcs', 0.85, 15000), ('Product labels', 'pcs', 0.90, 10000),
    ('Product labels', 'pcs', 0.95, 10000), ('Product labels', 'pcs', 1.00, 8000),
    ('Product labels', 'pcs', 1.00, 5000),  ('Product labels', 'pcs', 1.05, 5000),
    ('Product labels', 'pcs', 1.10, 4000),  ('Product labels', 'pcs', 1.20, 3000),
    ('Product labels', 'pcs', 1.30, 2000),
    -- printed stand-up pouches
    ('Pouches and sachets', 'pcs', 6.00, 10000), ('Pouches and sachets', 'pcs', 6.50, 8000),
    ('Pouches and sachets', 'pcs', 7.00, 5000),  ('Pouches and sachets', 'pcs', 7.20, 5000),
    ('Pouches and sachets', 'pcs', 7.50, 4000),  ('Pouches and sachets', 'pcs', 8.00, 3000),
    ('Pouches and sachets', 'pcs', 8.20, 3000),  ('Pouches and sachets', 'pcs', 8.50, 2000),
    ('Pouches and sachets', 'pcs', 9.00, 1500),  ('Pouches and sachets', 'pcs', 9.50, 1000),
    -- tamper-evident seals
    ('Tamper-evident seals', 'pcs', 0.45, 20000), ('Tamper-evident seals', 'pcs', 0.50, 15000),
    ('Tamper-evident seals', 'pcs', 0.55, 10000), ('Tamper-evident seals', 'pcs', 0.60, 10000),
    ('Tamper-evident seals', 'pcs', 0.60, 8000),  ('Tamper-evident seals', 'pcs', 0.65, 5000),
    ('Tamper-evident seals', 'pcs', 0.70, 5000),  ('Tamper-evident seals', 'pcs', 0.75, 3000),
    ('Tamper-evident seals', 'pcs', 0.80, 2000),  ('Tamper-evident seals', 'pcs', 0.90, 1000),
    -- small business websites (about 5 pages)
    ('Website development', 'project', 28000, 1), ('Website development', 'project', 32000, 1),
    ('Website development', 'project', 35000, 1), ('Website development', 'project', 38000, 1),
    ('Website development', 'project', 40000, 1), ('Website development', 'project', 42000, 1),
    ('Website development', 'project', 45000, 1), ('Website development', 'project', 48000, 1),
    ('Website development', 'project', 55000, 1), ('Website development', 'project', 65000, 1),
    ('Website development', 'project', 75000, 1)
  ) as v (item_name, unit, unit_price, quantity)
  join public.catalogue_items i on i.name = v.item_name;


-- ----------------------------------------------------------------------------
-- 2. Helpers
-- ----------------------------------------------------------------------------

-- "pcs", "Pieces", "nos" and "units" all mean pieces.
create or replace function app.norm_unit(p_unit text) returns text
language sql immutable set search_path = '' as $$
  select case when lower(trim(coalesce(p_unit, ''))) in ('', 'pc', 'pcs', 'piece', 'pieces', 'no', 'nos', 'unit', 'units')
              then 'pcs'
              else lower(trim(p_unit)) end;
$$;

-- Past unit prices for one catalogue item and unit, after discount, before GST.
-- outcome is 'accepted' or 'rejected' once the startup decided, else null.
create or replace function app.past_unit_prices(p_item_id uuid, p_unit text, p_demo boolean, p_exclude_request uuid)
returns table (unit_price numeric, outcome text)
language sql stable security definer set search_path = '' as $$
  select round(ql.unit_price * (1 - q.discount_pct / 100), 2),
         case when q.status in ('accepted', 'rejected') then q.status::text end
    from public.quote_lines ql
    join public.quotes q         on q.id = ql.quote_id
    join public.request_lines rl on rl.id = ql.request_line_id
    join public.requests r       on r.id = q.request_id
    join public.organisations o  on o.id = r.org_id
   where rl.item_id = p_item_id
     and ql.line_type = 'item'
     and q.status in ('submitted', 'accepted', 'rejected')    -- current versions only
     and q.request_id is distinct from p_exclude_request      -- never the same request
     and o.is_demo = p_demo                                   -- demo and real data never mix
     and app.norm_unit(rl.unit) = app.norm_unit(p_unit)
  union all
  select s.unit_price, null
    from public.sample_past_prices s
   where p_demo
     and s.item_id = p_item_id
     and app.norm_unit(s.unit) = app.norm_unit(p_unit);
$$;

revoke execute on function app.past_unit_prices(uuid, text, boolean, uuid) from public;


-- ----------------------------------------------------------------------------
-- 3. The price guide for one request line
-- ----------------------------------------------------------------------------
create or replace function public.price_guide(p_request_line_id uuid)
returns table (
  request_line_id uuid,
  item_id         uuid,
  item_name       text,
  description     text,
  quantity        numeric,
  unit            text,
  category_name   text,
  delivery_city   text,
  delivery_state  text,
  source          text,      -- 'past_quotes', or 'too_few' (ask the AI)
  price_count     integer,   -- how many past prices the range is based on
  low             numeric,   -- per unit, before GST
  typical         numeric,
  high            numeric,
  decided_count   integer,   -- past quotes the startup accepted or rejected
  win_pct_low     integer,   -- empty until decided_count reaches 20
  win_pct_typical integer,
  win_pct_high    integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  c_min_prices  constant integer := 5;
  c_min_decided constant integer := 20;
  v_line  public.request_lines%rowtype;
  v_req   public.requests%rowtype;
  v_demo  boolean;
  v_count integer;
  v_dec   integer;
  v_low   numeric;  v_mid numeric;  v_high numeric;
begin
  select * into v_line from public.request_lines rl where rl.id = p_request_line_id;
  if v_line.id is null then
    raise exception 'Request item not found';
  end if;
  select * into v_req from public.requests r where r.id = v_line.request_id;

  if not (app.is_admin() or (app.my_role() = 'vendor' and app.is_invited_to(v_req.id))) then
    raise exception 'Not allowed';
  end if;

  select o.is_demo into v_demo from public.organisations o where o.id = v_req.org_id;

  if v_line.item_id is not null then
    select count(*)::integer,
           count(*) filter (where p.outcome is not null)::integer,
           round(percentile_cont(0.25) within group (order by p.unit_price)::numeric, 2),
           round(percentile_cont(0.50) within group (order by p.unit_price)::numeric, 2),
           round(percentile_cont(0.75) within group (order by p.unit_price)::numeric, 2)
      into v_count, v_dec, v_low, v_mid, v_high
      from app.past_unit_prices(v_line.item_id, v_line.unit, v_demo, v_req.id) p;
  end if;

  request_line_id := v_line.id;
  item_id         := v_line.item_id;
  description     := v_line.description;
  quantity        := v_line.quantity;
  unit            := v_line.unit;
  delivery_city   := v_req.delivery_city;
  delivery_state  := v_req.delivery_state;
  select i.name into item_name from public.catalogue_items i where i.id = v_line.item_id;
  select c.name into category_name from public.catalogue_categories c where c.id = v_req.category_id;
  price_count   := coalesce(v_count, 0);
  decided_count := coalesce(v_dec, 0);

  if price_count < c_min_prices then
    source := 'too_few';
    return next;
    return;
  end if;

  source  := 'past_quotes';
  low     := v_low;
  typical := v_mid;
  high    := v_high;

  if decided_count >= c_min_decided then
    select round(100.0 * count(*) filter (where p.outcome = 'accepted' and p.unit_price <= v_low)
                 / nullif(count(*) filter (where p.outcome is not null and p.unit_price <= v_low), 0)),
           round(100.0 * count(*) filter (where p.outcome = 'accepted' and p.unit_price <= v_mid)
                 / nullif(count(*) filter (where p.outcome is not null and p.unit_price <= v_mid), 0)),
           round(100.0 * count(*) filter (where p.outcome = 'accepted' and p.unit_price <= v_high)
                 / nullif(count(*) filter (where p.outcome is not null and p.unit_price <= v_high), 0))
      into win_pct_low, win_pct_typical, win_pct_high
      from app.past_unit_prices(v_line.item_id, v_line.unit, v_demo, v_req.id) p;
  end if;

  return next;
end;
$$;

revoke execute on function public.price_guide(uuid) from public, anon;
grant  execute on function public.price_guide(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- Check: sample prices loaded per item (expect 5 items, rapid prototyping not among them).
-- ----------------------------------------------------------------------------
select i.name as item, count(*) as sample_prices, min(s.unit_price) as lowest, max(s.unit_price) as highest
  from public.sample_past_prices s
  join public.catalogue_items i on i.id = s.item_id
 group by i.name
 order by i.name;

-- ============================================================================
-- End of migration
-- ============================================================================
