-- ============================================================================
-- MPI · Money engine: offer -> order -> invoices -> payment -> payout
--
-- Follows the client's "Products & Services Master MVP Specification v2"
-- (31 Oct 2026). Every rate below is the spec's SAMPLE figure, agreed by
-- rivanah on 2 Nov 2026 for the MVP. None of it is final commercial, tax or
-- legal advice: the admin changes them in fee rules and rate cards.
--
-- What this adds
--   1. Match score out of 100 (35 category, 25 certifications, 20 delivery,
--      12 location, 8 spare capacity). It could reach 110 before.
--   2. Fee rules per category, versioned: buyer fee (2% sample), supplier
--      commission (5% sample), GST on MPI's own invoices (18% sample).
--      Legal and CA work: commission locked off (professional rules, spec
--      A3.1), sample fixed MPI fee, buyer pays the professional directly.
--   3. Supplier rate cards: MPI brings a supplier many independent clients,
--      so the supplier gives MPI clients a volume rate. Sample tiers 0/5/10/15%
--      at 1-4/5-9/10-19/20+ clients last month. The rate is locked on each
--      quote when it is sent. Orders are never pooled or repriced.
--   4. One calculation for every amount (app.money_calc), used by quotes,
--      previews, comparison and orders, so the numbers always agree.
--   5. On every new order: a frozen calculation snapshot and 3 invoices
--      (supplier -> buyer, MPI fee -> buyer, MPI commission -> supplier),
--      each with its payment schedule (advance / balance).
--   6. Simulated payments (clearly labelled, no money moves), supplier
--      payouts, returns with credit notes, refunds, and a ledger whose
--      entries always add up to zero per order.
--   7. Offer comparison for the buyer, scored out of 100 (sample weights:
--      price 35, quality 35, delivery 20, location 10) on the full cost to
--      the buyer, MPI fee included.
--
-- What waits (spec items not in the 8 Nov MVP): retrospective rebates,
-- change orders, disputes, timesheets and SOW records, TDS/TCS, a real
-- payment provider, subscriptions.
--
-- Run with: npm run db:push   (then npm run db:reset-demo, npm run db:check)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Match score out of 100
-- ----------------------------------------------------------------------------
create or replace function app.suggest_matches_for(p_request_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_req      public.requests%rowtype;
  v_demo     boolean;
  v_cat_name text;
  v_tangible boolean;
  v_remote   boolean;
  v_c        record;
  v_score    integer;
  v_reasons  text[];
  v_days     integer;
  v_have     integer;
  v_count    integer;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Request not found';
  end if;
  select is_demo into v_demo from public.organisations where id = v_req.org_id;
  select name, is_tangible into v_cat_name, v_tangible from public.catalogue_categories where id = v_req.category_id;
  v_remote := coalesce(v_tangible, false) = false
              and v_req.delivery_city is null and v_req.delivery_state is null;

  delete from public.request_matches where request_id = p_request_id and status = 'suggested';

  for v_c in
    select o.id, o.city, o.state, vd.certifications, vd.lead_time_days,
           vd.capacity_utilisation_pct, vd.pan_india_dispatch
      from public.organisations o
      join public.vendor_details vd on vd.org_id = o.id
     where o.type = 'vendor'
       and o.verification_status = 'verified'
       and o.is_demo = v_demo
       and (v_req.category_id is null
            or exists (select 1 from public.vendor_categories vc
                        where vc.vendor_org_id = o.id and vc.category_id = v_req.category_id))
       and not exists (select 1 from public.request_matches m
                        where m.request_id = p_request_id and m.vendor_org_id = o.id)
  loop
    v_score   := 0;
    v_reasons := '{}';

    -- Category: 35
    if v_req.category_id is not null then
      v_score := v_score + 35;
      v_reasons := v_reasons || ('Supplies ' || v_cat_name);
    else
      v_score := v_score + 18;
    end if;

    -- Certifications the startup asked for: 25
    if cardinality(v_req.required_certifications) = 0 then
      v_score := v_score + 15;
    else
      select count(*) into v_have
        from unnest(v_req.required_certifications) r where r = any (v_c.certifications);
      v_score := v_score + round(25.0 * v_have / cardinality(v_req.required_certifications))::integer;
      if v_have = cardinality(v_req.required_certifications) then
        v_reasons := v_reasons || ('Has ' || array_to_string(v_req.required_certifications, ', '));
      elsif v_have > 0 then
        v_reasons := v_reasons || ('Has ' || v_have || ' of ' || cardinality(v_req.required_certifications) || ' certifications asked for');
      else
        v_reasons := v_reasons || 'Missing the certifications asked for'::text;
      end if;
    end if;

    -- Delivery: 20. Estimate = lead time, plus extra when busy, plus transit
    -- (none for remote work, 1 day same state, else 3).
    v_days := coalesce(v_c.lead_time_days, 14)
            + case when coalesce(v_c.capacity_utilisation_pct, 0) >= 80
                   then ceil(coalesce(v_c.lead_time_days, 14) * 0.3)::integer else 0 end
            + case when v_remote then 0
                   when v_c.state is not distinct from v_req.delivery_state then 1 else 3 end;

    if v_req.needed_by is null then
      v_score := v_score + 15;
      v_reasons := v_reasons || ('Can deliver in about ' || v_days || ' days');
    elsif current_date + v_days <= v_req.needed_by then
      v_score := v_score + 20;
      v_reasons := v_reasons || ('Can deliver in about ' || v_days || ' days, before your date');
    else
      v_reasons := v_reasons || ('May be ' || (current_date + v_days - v_req.needed_by) || ' days late');
    end if;

    -- Location: 12
    if v_remote then
      if v_c.pan_india_dispatch then
        v_score := v_score + 12;
        v_reasons := v_reasons || 'Works remotely, anywhere in India'::text;
      else
        v_score := v_score + 4;
        v_reasons := v_reasons || ('Works mainly in ' || coalesce(v_c.city, v_c.state, 'its own city'));
      end if;
    elsif v_req.delivery_city is not null and v_c.city = v_req.delivery_city then
      v_score := v_score + 12;
      v_reasons := v_reasons || ('Based in ' || v_c.city);
    elsif v_req.delivery_state is not null and v_c.state = v_req.delivery_state then
      v_score := v_score + 8;
      v_reasons := v_reasons || ('Based in ' || v_c.state);
    elsif v_c.pan_india_dispatch then
      v_score := v_score + 4;
      v_reasons := v_reasons || 'Ships across India'::text;
    end if;

    -- Spare capacity: 8
    if v_c.capacity_utilisation_pct is null then
      v_score := v_score + 4;
    elsif v_c.capacity_utilisation_pct < 80 then
      v_score := v_score + 8;
      v_reasons := v_reasons || ('Has spare capacity (' || v_c.capacity_utilisation_pct || '% busy)');
    else
      v_reasons := v_reasons || ('Busy right now (' || v_c.capacity_utilisation_pct || '% booked)');
    end if;

    insert into public.request_matches
      (request_id, vendor_org_id, score, reasons, estimated_delivery_days, estimated_delivery_date)
    values
      (p_request_id, v_c.id, least(v_score, 100), v_reasons, v_days, current_date + v_days);
  end loop;

  -- Keep the 5 best suggestions.
  delete from public.request_matches m
   using (select id, row_number() over (order by score desc, estimated_delivery_days, created_at) as rn
            from public.request_matches
           where request_id = p_request_id and status = 'suggested') ranked
   where m.id = ranked.id and ranked.rn > 5;

  select count(*) into v_count
    from public.request_matches where request_id = p_request_id and status = 'suggested';
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- Sample weights for comparing offers, out of 100. Admin can change them.
alter table public.platform_settings
  add column if not exists offer_score_weights jsonb not null
  default '{"price": 35, "quality": 35, "delivery": 20, "location": 10}'::jsonb;

-- Fee rules. Never edited: a change is a new version, so every order keeps
-- the version it was priced with. category_id empty = the platform default.
create table public.fee_rules (
  id                          uuid primary key default gen_random_uuid(),
  category_id                 uuid references public.catalogue_categories (id) on delete cascade,
  version                     integer not null check (version >= 1),
  buyer_fee_type              text not null check (buyer_fee_type in ('percent', 'fixed', 'none')),
  buyer_fee_value             numeric(12,4) not null default 0 check (buyer_fee_value >= 0),
  buyer_fee_min               numeric(14,2) check (buyer_fee_min is null or buyer_fee_min >= 0),
  buyer_fee_max               numeric(14,2) check (buyer_fee_max is null or buyer_fee_max >= 0),
  supplier_commission_enabled boolean not null default false,
  supplier_commission_pct     numeric(6,3) not null default 0 check (supplier_commission_pct between 0 and 50),
  mpi_tax_pct                 numeric(5,2) not null default 18 check (mpi_tax_pct between 0 and 100),
  supplier_tax_mode           text not null default 'forward' check (supplier_tax_mode in ('forward', 'reverse')),
  payment_route               text not null default 'mpi_collects' check (payment_route in ('mpi_collects', 'direct')),
  professional_gate           boolean not null default false,   -- legal / CA: commission must stay off
  needs_review                boolean not null default true,    -- sample figure, not yet approved
  note                        text,
  effective_from              timestamptz not null default now(),
  created_by                  uuid references public.profiles (id),
  created_at                  timestamptz not null default now(),
  check (not (professional_gate and supplier_commission_enabled)),
  check (buyer_fee_type <> 'percent' or buyer_fee_value <= 50),
  check (buyer_fee_min is null or buyer_fee_max is null or buyer_fee_min <= buyer_fee_max)
);
create unique index fee_rules_version_idx
  on public.fee_rules (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), version);

-- A supplier's MPI rate card for one category. tiers: [{"min": 1, "pct": 0}, ...]
-- "min" = clients (or orders) last month needed for that discount.
create table public.supplier_rate_cards (
  id            uuid primary key default gen_random_uuid(),
  vendor_org_id uuid not null references public.organisations (id) on delete cascade,
  category_id   uuid not null references public.catalogue_categories (id) on delete cascade,
  version       integer not null default 1,
  metric        text not null default 'unique_clients' check (metric in ('unique_clients', 'orders')),
  tiers         jsonb not null,
  valid_from    date not null default current_date,
  valid_to      date,
  is_active     boolean not null default true,
  beneficiary   text not null default 'buyer' check (beneficiary = 'buyer'),        -- the discount goes to the buyer
  rate_lock     text not null default 'prospective' check (rate_lock = 'prospective'), -- locked per order, never repriced
  note          text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  check (jsonb_typeof(tiers) = 'array' and jsonb_array_length(tiers) between 1 and 10),
  check (valid_to is null or valid_to >= valid_from)
);
create unique index supplier_rate_cards_active_idx
  on public.supplier_rate_cards (vendor_org_id, category_id) where is_active;

-- Each independent order counts once towards the supplier's volume.
-- client_key de-duplicates clients (a repeat order from the same buyer is
-- one client). Sample rows (is_sample) exist only for demo suppliers.
create table public.volume_events (
  id             uuid primary key default gen_random_uuid(),
  vendor_org_id  uuid not null references public.organisations (id) on delete cascade,
  category_id    uuid not null references public.catalogue_categories (id) on delete cascade,
  client_key     text not null,
  buyer_org_id   uuid references public.organisations (id) on delete set null,
  po_id          uuid unique references public.purchase_orders (id) on delete cascade,
  eligible_value numeric(14,2) not null default 0,
  qualified_at   timestamptz not null default now(),
  reversed_at    timestamptz,
  is_sample      boolean not null default false
);
create index volume_events_lookup_idx on public.volume_events (vendor_org_id, category_id, qualified_at);

-- Quotes: the volume rate and tax mode are locked when the quote is sent.
alter table public.quotes
  add column volume_discount_pct    numeric(8,5)  not null default 0 check (volume_discount_pct >= 0 and volume_discount_pct < 100),
  add column volume_discount_amount numeric(14,2) not null default 0,
  add column volume_rate_card_id    uuid references public.supplier_rate_cards (id) on delete set null,
  add column volume_clients         integer,
  add column supplier_tax_mode      text not null default 'forward' check (supplier_tax_mode in ('forward', 'reverse')),
  add column pass_through_amount    numeric(14,2) not null default 0,
  add column rcm_tax_amount         numeric(14,2) not null default 0,
  add column price_terms_locked     boolean not null default false;

-- Quotes already in the database keep their prices exactly as they are.
update public.quotes set price_terms_locked = true;

comment on column public.quotes.discount_amount is
  'All discounts before GST: the MPI volume benefit (volume_discount_amount) plus any price agreed in negotiation.';

-- Pass-through lines (ad budget, government fees, stamp duty): paid by the
-- buyer directly, shown in the total cost, never discounted, never on the
-- supplier's invoice, never charged a fee or commission.
alter table public.quote_lines add column pass_through boolean not null default false;

-- Frozen record of how an order was priced. Never changed.
create table public.order_price_snapshots (
  id               uuid primary key default gen_random_uuid(),
  po_id            uuid not null unique references public.purchase_orders (id) on delete cascade,
  quote_id         uuid not null references public.quotes (id) on delete cascade,
  fee_rule_id      uuid references public.fee_rules (id) on delete set null,
  fee_rule_version integer,
  rate_card_id     uuid references public.supplier_rate_cards (id) on delete set null,
  payment_route    text not null,
  formula_version  text not null,
  inputs           jsonb not null,
  outputs          jsonb not null,
  created_at       timestamptz not null default now()
);

create sequence public.money_doc_seq;

-- Invoices. kind:
--   supplier_to_buyer           the supplier's invoice for the goods or service
--   mpi_fee_to_buyer            MPI's fee to the buyer
--   mpi_commission_to_supplier  MPI's commission to the supplier
create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  po_id            uuid not null references public.purchase_orders (id) on delete cascade,
  kind             text not null check (kind in ('supplier_to_buyer', 'mpi_fee_to_buyer', 'mpi_commission_to_supplier')),
  issuer_org_id    uuid not null references public.organisations (id),
  recipient_org_id uuid not null references public.organisations (id),
  currency         char(3) not null default 'INR',
  taxable_amount   numeric(14,2) not null,
  tax_amount       numeric(14,2) not null default 0,
  rcm_tax_amount   numeric(14,2) not null default 0,   -- reverse charge: the buyer pays this GST to the government itself
  total            numeric(14,2) not null,
  tax_mode         text not null default 'forward' check (tax_mode in ('forward', 'reverse')),
  lines            jsonb not null default '[]'::jsonb,
  status           text not null default 'issued' check (status in ('issued', 'part_paid', 'paid', 'cancelled')),
  amount_paid      numeric(14,2) not null default 0,
  amount_credited  numeric(14,2) not null default 0,
  issued_at        timestamptz not null default now(),
  unique (po_id, kind),
  check (total = taxable_amount + tax_amount)
);
create index invoices_issuer_idx on public.invoices (issuer_org_id);
create index invoices_recipient_idx on public.invoices (recipient_org_id);

-- Payment schedule of each invoice.
create table public.invoice_installments (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  seq        integer not null,
  label      text not null,
  pct        numeric(6,3),
  amount     numeric(14,2) not null check (amount >= 0),
  due_event  text not null check (due_event in ('on_order', 'on_delivery', 'on_settlement')),
  status     text not null default 'due' check (status in ('due', 'paid', 'waived')),
  paid_at    timestamptz,
  unique (invoice_id, seq)
);

-- Payments. MVP: simulated only, and always labelled so.
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  po_id           uuid not null references public.purchase_orders (id) on delete cascade,
  payer_org_id    uuid not null references public.organisations (id),
  payee           text not null check (payee in ('mpi', 'supplier')),
  payee_org_id    uuid not null references public.organisations (id),
  amount          numeric(14,2) not null check (amount > 0),
  method          text not null default 'simulated' check (method = 'simulated'),
  is_simulated    boolean not null default true check (is_simulated),
  idempotency_key text not null unique,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);

create table public.payment_allocations (
  payment_id     uuid not null references public.payments (id) on delete cascade,
  installment_id uuid not null references public.invoice_installments (id) on delete cascade,
  amount         numeric(14,2) not null check (amount > 0),
  primary key (payment_id, installment_id)
);

-- Money MPI passes on to the supplier, after deducting its commission.
create table public.settlements (
  id                  uuid primary key default gen_random_uuid(),
  po_id               uuid not null references public.purchase_orders (id) on delete cascade,
  vendor_org_id       uuid not null references public.organisations (id),
  gross_amount        numeric(14,2) not null,
  commission_deducted numeric(14,2) not null default 0,
  net_amount          numeric(14,2) not null,
  kind                text not null default 'payout' check (kind in ('payout', 'commission_paid_by_supplier')),
  is_simulated        boolean not null default true check (is_simulated),
  idempotency_key     text not null unique,
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now()
);

-- Credit notes (returns). Issued history is never edited; credits are added.
create table public.credit_notes (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique,
  invoice_id      uuid not null references public.invoices (id) on delete cascade,
  po_id           uuid not null references public.purchase_orders (id) on delete cascade,
  kind            text not null check (kind in ('supplier_credit', 'buyer_fee_reversal', 'commission_reversal')),
  taxable_amount  numeric(14,2) not null,
  tax_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) not null,
  quote_line_id   uuid references public.quote_lines (id) on delete set null,
  units           numeric(14,3),
  reason          text,
  idempotency_key text not null,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (idempotency_key, kind)
);

create table public.refunds (
  id              uuid primary key default gen_random_uuid(),
  po_id           uuid not null references public.purchase_orders (id) on delete cascade,
  buyer_org_id    uuid not null references public.organisations (id),
  amount          numeric(14,2) not null check (amount > 0),
  is_simulated    boolean not null default true check (is_simulated),
  idempotency_key text not null unique,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);

-- MPI's books for each order. Each event's entries add up to zero.
-- Accounts (positive = owed to MPI / held by MPI):
--   mpi_cash          money MPI holds
--   buyer_receivable  what the buyer still owes MPI (negative: MPI owes a refund)
--   supplier_payable  negative: MPI owes the supplier; positive: the supplier owes MPI
--   mpi_revenue       MPI's fees and commission, before GST (negative = earned)
--   gst_payable       GST on MPI's invoices, owed to the government (negative = owed)
create table public.ledger_entries (
  id           bigint generated always as identity primary key,
  po_id        uuid not null references public.purchase_orders (id) on delete cascade,
  event        text not null,
  account      text not null check (account in ('mpi_cash', 'buyer_receivable', 'supplier_payable', 'mpi_revenue', 'gst_payable')),
  amount       numeric(14,2) not null,
  source_type  text not null,
  source_id    uuid,
  is_simulated boolean not null default true,
  created_at   timestamptz not null default now()
);
create index ledger_entries_po_idx on public.ledger_entries (po_id);


-- ----------------------------------------------------------------------------
-- 3. The calculation (spec A4, B1.2, C3). Pure: same input, same output.
--
-- Input (jsonb):
--   lines:          [{amount, tax_rate, kind}]   kind = eligible | extra | pass_through
--                   eligible = the goods or the main service fee (volume rate applies)
--                   extra    = tooling, setup, freight, testing, materials (no volume rate)
--   volume_pct:     the supplier's MPI volume rate, %
--   negotiated_pct: further discount agreed in negotiation, %, on all supplier lines
--   tax_mode:       forward | reverse (reverse charge: the buyer pays the GST itself)
--   buyer_fee:      {type: percent|fixed|none, value, min, max}
--   commission:     {enabled, pct}
--   mpi_tax_pct:    GST on MPI's invoices, %
--   schedule:       supplier invoice split in %, e.g. [30, 70]
--
-- Discounts apply one after the other (10% then 5% = 14.5%). The buyer fee
-- and commission are worked out on the discounted eligible value only.
-- Amounts are rounded to paise; split amounts always add up to the whole.
-- ----------------------------------------------------------------------------
create or replace function app.money_calc(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  dv        numeric := coalesce((p->>'volume_pct')::numeric, 0);
  dn        numeric := coalesce((p->>'negotiated_pct')::numeric, 0);
  v_mode    text    := coalesce(p->>'tax_mode', 'forward');
  fee_type  text    := coalesce(p->'buyer_fee'->>'type', 'none');
  fee_val   numeric := coalesce((p->'buyer_fee'->>'value')::numeric, 0);
  fee_min   numeric := (p->'buyer_fee'->>'min')::numeric;
  fee_max   numeric := (p->'buyer_fee'->>'max')::numeric;
  com_on    boolean := coalesce((p->'commission'->>'enabled')::boolean, false);
  com_pct   numeric := coalesce((p->'commission'->>'pct')::numeric, 0);
  mpi_tax   numeric := coalesce((p->>'mpi_tax_pct')::numeric, 18);
  v_sched   jsonb   := coalesce(p->'schedule', '[100]'::jsonb);
  l         jsonb;
  v_kind    text;
  v_amt     numeric;
  v_rate    numeric;
  v_net     numeric;
  elig_ref  numeric := 0;
  extra_ref numeric := 0;
  pass      numeric := 0;
  elig_u    numeric := 0;
  extra_u   numeric := 0;
  tax_u     numeric := 0;
  elig_net  numeric;
  extra_net numeric;
  vol_amt   numeric;
  neg_amt   numeric;
  taxable   numeric;
  tax_calc  numeric;
  s_tax     numeric;
  rcm       numeric;
  s_inv     numeric;
  fee       numeric;
  fee_tax   numeric;
  com       numeric;
  com_tax   numeric;
  baseline  numeric;
  actual    numeric;
  v_pct     numeric;
  v_sum     numeric := 0;
  v_part    numeric;
  v_n       integer;
  i         integer := 0;
  s_rows    jsonb := '[]'::jsonb;
  b_rows    jsonb := '[]'::jsonb;
begin
  if dv < 0 or dv >= 100 or dn < 0 or dn >= 100 then
    raise exception 'Discounts must be at least 0%% and below 100%%';
  end if;
  if v_mode not in ('forward', 'reverse') then
    raise exception 'Tax mode must be forward or reverse';
  end if;

  for l in select value from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    v_kind := coalesce(l->>'kind', 'eligible');
    v_amt  := (l->>'amount')::numeric;
    v_rate := coalesce((l->>'tax_rate')::numeric, 0);
    if v_amt is null or v_amt < 0 then
      raise exception 'Line amounts must be 0 or more';
    end if;
    if v_kind = 'pass_through' then
      pass := pass + v_amt;
      continue;
    elsif v_kind = 'eligible' then
      elig_ref := elig_ref + v_amt;
      v_net    := v_amt * (1 - dv / 100) * (1 - dn / 100);
      elig_u   := elig_u + v_net;
    elsif v_kind = 'extra' then
      extra_ref := extra_ref + v_amt;
      v_net     := v_amt * (1 - dn / 100);
      extra_u   := extra_u + v_net;
    else
      raise exception 'Unknown line kind: %', v_kind;
    end if;
    tax_u := tax_u + v_net * v_rate / 100;
  end loop;

  -- Supplier side
  vol_amt   := round(elig_ref * dv / 100, 2);
  elig_net  := round(elig_u, 2);
  extra_net := round(extra_u, 2);
  taxable   := elig_net + extra_net;
  neg_amt   := (elig_ref - vol_amt + extra_ref) - taxable;
  tax_calc  := round(tax_u, 2);
  if v_mode = 'reverse' then
    s_tax := 0;
    rcm   := tax_calc;
  else
    s_tax := tax_calc;
    rcm   := 0;
  end if;
  s_inv := taxable + s_tax;

  -- MPI's fee to the buyer
  fee := case fee_type
           when 'percent' then round(elig_net * fee_val / 100, 2)
           when 'fixed'   then round(fee_val, 2)
           else 0
         end;
  if fee_type <> 'none' then
    if fee_min is not null then fee := greatest(fee, fee_min); end if;
    if fee_max is not null then fee := least(fee, fee_max); end if;
  end if;
  fee_tax := round(fee * mpi_tax / 100, 2);

  -- MPI's commission from the supplier (off for legal and CA work)
  com     := case when com_on then round(elig_net * com_pct / 100, 2) else 0 end;
  com_tax := round(com * mpi_tax / 100, 2);

  -- Payment schedule of the supplier invoice; the MPI fee is paid in full
  -- with the first payment (spec C4.1).
  v_n := jsonb_array_length(v_sched);
  select coalesce(sum(value::numeric), 0) into v_sum from jsonb_array_elements_text(v_sched);
  if v_n = 0 or v_sum <> 100 then
    raise exception 'Payment split must add up to 100%%';
  end if;
  v_sum := 0;
  for v_pct in select value::numeric from jsonb_array_elements_text(v_sched) loop
    i := i + 1;
    if i < v_n then
      v_part := round(s_inv * v_pct / 100, 2);
      v_sum  := v_sum + v_part;
    else
      v_part := s_inv - v_sum;   -- the last part takes the rounding
    end if;
    s_rows := s_rows || jsonb_build_object('seq', i, 'pct', v_pct, 'amount', v_part);
    b_rows := b_rows || jsonb_build_object('seq', i, 'pct', v_pct, 'supplier_part', v_part,
                                           'mpi_fee_part', case when i = 1 then fee + fee_tax else 0 end,
                                           'amount', v_part + case when i = 1 then fee + fee_tax else 0 end);
  end loop;

  -- Savings: like-for-like cost without MPI vs with MPI, before GST (spec A4)
  baseline := elig_ref + extra_ref + pass;
  actual   := taxable + fee + pass;

  return jsonb_build_object(
    'formula_version', 'mpi-money-v1',
    'supplier', jsonb_build_object(
      'eligible_reference', elig_ref,
      'extras',             extra_ref,
      'reference_value',    elig_ref + extra_ref,
      'volume_pct',         dv,
      'volume_discount',    vol_amt,
      'negotiated_pct',     dn,
      'negotiated_discount', neg_amt,
      'taxable',            taxable,
      'tax_mode',           v_mode,
      'gst',                s_tax,
      'invoice_total',      s_inv,
      'commission',         com,
      'commission_gst',     com_tax,
      'commission_invoice', com + com_tax,
      'payout',             s_inv - (com + com_tax),
      'schedule',           s_rows),
    'buyer', jsonb_build_object(
      'supplier_invoice',   s_inv,
      'volume_benefit',     vol_amt,
      'negotiated_discount', neg_amt,
      'mpi_fee',            fee,
      'mpi_fee_gst',        fee_tax,
      'mpi_fee_invoice',    fee + fee_tax,
      'checkout_total',     s_inv + fee + fee_tax,
      'pass_through',       pass,
      'rcm_tax',            rcm,
      'cash_paid',          s_inv + fee + fee_tax + pass,
      'total_cost',         s_inv + fee + fee_tax + pass + rcm,
      'schedule',           b_rows),
    'mpi', jsonb_build_object(
      'fee_base',           elig_net,
      'buyer_fee',          fee,
      'supplier_commission', com,
      'revenue',            fee + com,
      'gst_on_invoices',    fee_tax + com_tax,
      'invoices_total',     fee + fee_tax + com + com_tax),
    'savings', jsonb_build_object(
      'baseline',           baseline,
      'with_mpi',           actual,
      'net',                baseline - actual,
      'pct',                case when baseline > 0 then round((baseline - actual) * 100 / baseline, 2) else 0 end),
    'cash_reconciles', (s_inv + fee + fee_tax) = (s_inv - com - com_tax) + (fee + fee_tax + com + com_tax)
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Helpers
-- ----------------------------------------------------------------------------

-- The fee rule in force for a category: its own latest version, else the
-- platform default.
create or replace function app.fee_rule_for(p_category_id uuid) returns public.fee_rules
language sql stable security definer set search_path = '' as $$
  select f.*
    from public.fee_rules f
   where (f.category_id = p_category_id or f.category_id is null)
     and f.effective_from <= now()
   order by (f.category_id is null), f.version desc
   limit 1;
$$;

create or replace function app.fee_rule_json(r public.fee_rules) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'buyer_fee',   jsonb_build_object('type', r.buyer_fee_type, 'value', r.buyer_fee_value,
                                      'min', r.buyer_fee_min, 'max', r.buyer_fee_max),
    'commission',  jsonb_build_object('enabled', r.supplier_commission_enabled, 'pct', r.supplier_commission_pct),
    'mpi_tax_pct', r.mpi_tax_pct);
$$;

-- The payment split for the payment terms shown on a quote.
create or replace function app.terms_schedule(p_terms text) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p_terms like '100%%' then '[100]'::jsonb else '[30, 70]'::jsonb end;
$$;

-- The supplier's MPI volume rate at a moment: clients (or orders) in the
-- previous calendar month, India time, against its active rate card.
create or replace function app.volume_tier(p_vendor_org_id uuid, p_category_id uuid, p_at timestamptz default now())
returns table (rate_card_id uuid, clients integer, pct numeric, next_min integer, next_pct numeric,
               clients_this_month integer)
language sql stable security definer set search_path = '' as $$
  with rc as (
    select c.*
      from public.supplier_rate_cards c
     where c.vendor_org_id = p_vendor_org_id and c.category_id = p_category_id and c.is_active
       and c.valid_from <= (p_at at time zone 'Asia/Kolkata')::date
       and (c.valid_to is null or c.valid_to >= (p_at at time zone 'Asia/Kolkata')::date)
     order by c.version desc
     limit 1
  ), months as (
    select date_trunc('month', p_at at time zone 'Asia/Kolkata') as this_start
  ), counts as (
    select
      count(distinct case when rc.metric = 'unique_clients' then e.client_key else e.id::text end)
        filter (where (e.qualified_at at time zone 'Asia/Kolkata') >= m.this_start - interval '1 month'
                  and (e.qualified_at at time zone 'Asia/Kolkata') <  m.this_start)::integer as last_month,
      count(distinct case when rc.metric = 'unique_clients' then e.client_key else e.id::text end)
        filter (where (e.qualified_at at time zone 'Asia/Kolkata') >= m.this_start)::integer as this_month
      from rc cross join months m
      left join public.volume_events e
        on e.vendor_org_id = rc.vendor_org_id and e.category_id = rc.category_id and e.reversed_at is null
  )
  select rc.id,
         n.last_month,
         coalesce((select (t->>'pct')::numeric from jsonb_array_elements(rc.tiers) t
                    where (t->>'min')::integer <= n.last_month order by (t->>'min')::integer desc limit 1), 0),
         (select (t->>'min')::integer from jsonb_array_elements(rc.tiers) t
           where (t->>'min')::integer > n.last_month order by (t->>'min')::integer limit 1),
         (select (t->>'pct')::numeric from jsonb_array_elements(rc.tiers) t
           where (t->>'min')::integer > n.last_month order by (t->>'min')::integer limit 1),
         n.this_month
    from rc cross join counts n;
$$;

-- A quote's lines in the form money_calc reads.
create or replace function app.quote_lines_json(p_quote_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'amount',   ql.line_amount,
           'tax_rate', ql.tax_rate,
           'kind',     case when ql.pass_through then 'pass_through'
                            when ql.line_type = 'item' then 'eligible' else 'extra' end)
           order by ql.sort_order, ql.id), '[]'::jsonb)
    from public.quote_lines ql where ql.quote_id = p_quote_id;
$$;

-- Full calculation for a quote with a given fee rule (default: in force now).
create or replace function app.quote_calc(p_quote_id uuid, p_fee_rule_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q    public.quotes%rowtype;
  v_cat  uuid;
  v_rule public.fee_rules%rowtype;
begin
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then
    raise exception 'Quote not found';
  end if;
  if p_fee_rule_id is not null then
    select * into v_rule from public.fee_rules where id = p_fee_rule_id;
  else
    select category_id into v_cat from public.requests where id = v_q.request_id;
    v_rule := app.fee_rule_for(v_cat);
  end if;
  return app.money_calc(
    jsonb_build_object('lines', app.quote_lines_json(v_q.id),
                       'volume_pct', v_q.volume_discount_pct,
                       'negotiated_pct', v_q.discount_pct,
                       'tax_mode', v_q.supplier_tax_mode,
                       'schedule', app.terms_schedule(v_q.payment_terms))
    || app.fee_rule_json(v_rule));
end;
$$;

create or replace function app.next_doc_number(p_prefix text) returns text
language sql volatile security definer set search_path = '' as $$
  select 'MPI-' || p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.money_doc_seq')::text, 5, '0');
$$;

create or replace function app.ledger(p_po_id uuid, p_event text, p_source_type text, p_source_id uuid, p_entries jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sum numeric;
begin
  select coalesce(sum((e->>'amount')::numeric), 0) into v_sum from jsonb_array_elements(p_entries) e;
  if v_sum <> 0 then
    raise exception 'Ledger entries for % do not balance (off by %)', p_event, v_sum;
  end if;
  insert into public.ledger_entries (po_id, event, account, amount, source_type, source_id)
  select p_po_id, p_event, e->>'account', (e->>'amount')::numeric, p_source_type, p_source_id
    from jsonb_array_elements(p_entries) e
   where (e->>'amount')::numeric <> 0;
end;
$$;

create or replace function app.ledger_balance(p_po_id uuid, p_account text) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0) from public.ledger_entries where po_id = p_po_id and account = p_account;
$$;

-- Keep an invoice's paid / credited totals and status up to date.
create or replace function app.refresh_invoice(p_invoice_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric;
  v_due  integer;
begin
  select coalesce(sum(pa.amount), 0) into v_paid
    from public.payment_allocations pa
    join public.invoice_installments ii on ii.id = pa.installment_id
   where ii.invoice_id = p_invoice_id;
  -- commission deducted from payouts counts as paid
  select v_paid + coalesce(sum(case when ii.status = 'paid'
                                     and not exists (select 1 from public.payment_allocations pa where pa.installment_id = ii.id)
                                    then ii.amount else 0 end), 0)
    into v_paid
    from public.invoice_installments ii where ii.invoice_id = p_invoice_id;
  select count(*) into v_due from public.invoice_installments where invoice_id = p_invoice_id and status = 'due';
  update public.invoices i
     set amount_paid     = v_paid,
         amount_credited = coalesce((select sum(c.total) from public.credit_notes c where c.invoice_id = i.id), 0),
         status = case when i.status = 'cancelled' then 'cancelled'
                       when v_due = 0 then 'paid'
                       when v_paid > 0 then 'part_paid'
                       else 'issued' end
   where i.id = p_invoice_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. Quote totals now include the MPI volume rate (replaces the core version)
-- ----------------------------------------------------------------------------
create or replace function app.fill_quote_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cat  uuid;
  v_rule public.fee_rules%rowtype;
  v_t    record;
  v_calc jsonb;
begin
  -- Only MPI's own copies (a revised version after negotiation) may bring
  -- their volume rate with them. Anything else is worked out here.
  if tg_op = 'INSERT' and coalesce(current_setting('mpi.copy_price_terms', true), '') <> 'on' then
    new.price_terms_locked := false;
  end if;

  if not new.price_terms_locked then
    select category_id into v_cat from public.requests where id = new.request_id;
    v_rule := app.fee_rule_for(v_cat);
    select * into v_t from app.volume_tier(new.vendor_org_id, v_cat, now());
    new.volume_rate_card_id := v_t.rate_card_id;
    new.volume_clients      := v_t.clients;
    new.volume_discount_pct := coalesce(v_t.pct, 0);
    new.supplier_tax_mode   := coalesce(v_rule.supplier_tax_mode, 'forward');
    -- Locked once the quote is sent: the buyer is shown this price.
    if new.status <> 'draft' then
      new.price_terms_locked := true;
    end if;
  end if;

  v_calc := app.money_calc(jsonb_build_object(
              'lines', app.quote_lines_json(new.id),
              'volume_pct', new.volume_discount_pct,
              'negotiated_pct', new.discount_pct,
              'tax_mode', new.supplier_tax_mode));

  new.subtotal               := (v_calc->'supplier'->>'reference_value')::numeric;
  new.volume_discount_amount := (v_calc->'supplier'->>'volume_discount')::numeric;
  new.discount_amount        := new.subtotal - (v_calc->'supplier'->>'taxable')::numeric;
  new.tax_amount             := (v_calc->'supplier'->>'gst')::numeric;
  new.rcm_tax_amount         := (v_calc->'buyer'->>'rcm_tax')::numeric;
  new.pass_through_amount    := (v_calc->'buyer'->>'pass_through')::numeric;
  return new;
end;
$$;

-- Pass-through lines carry no GST on the supplier's invoice.
create or replace function app.check_quote_line() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.pass_through then
    new.tax_rate := 0;
  end if;
  return new;
end;
$$;

create trigger check_quote_line
  before insert or update on public.quote_lines
  for each row execute function app.check_quote_line();

-- A negotiated price: the new version keeps the volume rate it was quoted
-- with, and the agreed total becomes an extra discount on top.
create or replace function app.revise_quote_to_total(p_quote_id uuid, p_total numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old  public.quotes%rowtype;
  v_new  uuid;
  v_base numeric;
  v_calc jsonb;
  v_pct  numeric;
begin
  select * into v_old from public.quotes where id = p_quote_id;

  -- Total at this volume rate with no negotiated discount.
  v_calc := app.money_calc(jsonb_build_object(
              'lines', app.quote_lines_json(p_quote_id),
              'volume_pct', v_old.volume_discount_pct,
              'tax_mode', v_old.supplier_tax_mode));
  v_base := (v_calc->'supplier'->>'invoice_total')::numeric;
  if v_base <= 0 or p_total > v_base then
    raise exception 'The new price must be below the original price';
  end if;
  v_pct := round(100 * (1 - p_total / v_base), 5);

  perform set_config('mpi.copy_price_terms', 'on', true);
  insert into public.quotes (invitation_id, request_id, vendor_org_id, version, status, currency,
                             lead_time_days, payment_terms, valid_until, notes, created_by,
                             volume_discount_pct, volume_rate_card_id, volume_clients, supplier_tax_mode, price_terms_locked)
  select v_old.invitation_id, v_old.request_id, v_old.vendor_org_id,
         (select max(version) + 1 from public.quotes where invitation_id = v_old.invitation_id),
         'draft', v_old.currency, v_old.lead_time_days, v_old.payment_terms, v_old.valid_until,
         'Revised price agreed in negotiation', v_old.created_by,
         v_old.volume_discount_pct, v_old.volume_rate_card_id, v_old.volume_clients, v_old.supplier_tax_mode, true
  returning id into v_new;
  perform set_config('mpi.copy_price_terms', 'off', true);

  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, tax_rate, sort_order, pass_through)
  select v_new, request_line_id, line_type, description, quantity, unit_price, tax_rate, sort_order, pass_through
    from public.quote_lines where quote_id = p_quote_id;

  update public.quotes set discount_pct = v_pct, status = 'submitted' where id = v_new;
  return v_new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. New order -> snapshot, 3 invoices with their schedules, volume count
-- ----------------------------------------------------------------------------
create or replace function app.issue_order_documents(p_po_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_po       public.purchase_orders%rowtype;
  v_q        public.quotes%rowtype;
  v_cat      uuid;
  v_rule     public.fee_rules%rowtype;
  v_calc     jsonb;
  v_platform uuid;
  v_route    text;
  v_inv      uuid;
  v_n        integer;
  r          jsonb;
  v_s        jsonb;
  v_b        jsonb;
  v_m        jsonb;
  v_lines    jsonb;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  if exists (select 1 from public.order_price_snapshots s where s.po_id = p_po_id) then
    return;   -- already done
  end if;
  select * into v_q from public.quotes where id = v_po.quote_id;
  select category_id into v_cat from public.requests where id = v_po.request_id;
  v_rule := app.fee_rule_for(v_cat);
  if v_rule.id is null then
    raise exception 'No fee rule is set up. Run the money engine migration first.';
  end if;
  select id into v_platform from public.organisations where type = 'platform' order by created_at limit 1;
  if v_platform is null then
    raise exception 'The MPI platform organisation is missing';
  end if;

  v_calc  := app.quote_calc(v_q.id, v_rule.id);
  v_s     := v_calc->'supplier';
  v_b     := v_calc->'buyer';
  v_m     := v_calc->'mpi';
  v_route := v_rule.payment_route;

  insert into public.order_price_snapshots (po_id, quote_id, fee_rule_id, fee_rule_version, rate_card_id,
                                            payment_route, formula_version, inputs, outputs)
  values (v_po.id, v_q.id, v_rule.id, v_rule.version, v_q.volume_rate_card_id, v_route, v_calc->>'formula_version',
          jsonb_build_object('lines', app.quote_lines_json(v_q.id),
                             'volume_pct', v_q.volume_discount_pct,
                             'volume_clients', v_q.volume_clients,
                             'negotiated_pct', v_q.discount_pct,
                             'tax_mode', v_q.supplier_tax_mode,
                             'payment_terms', v_q.payment_terms,
                             'schedule', app.terms_schedule(v_q.payment_terms)) || app.fee_rule_json(v_rule),
          v_calc);

  -- 1. The supplier's invoice to the buyer
  select coalesce(jsonb_agg(jsonb_build_object(
           'description', ql.description, 'quantity', ql.quantity, 'unit_price', ql.unit_price,
           'amount', ql.line_amount, 'tax_rate', ql.tax_rate, 'line_type', ql.line_type,
           'volume_rate_applies', ql.line_type = 'item')
           order by ql.sort_order, ql.id), '[]'::jsonb)
    into v_lines
    from public.quote_lines ql where ql.quote_id = v_q.id and not ql.pass_through;

  insert into public.invoices (number, po_id, kind, issuer_org_id, recipient_org_id, taxable_amount, tax_amount,
                               rcm_tax_amount, total, tax_mode, lines)
  values (app.next_doc_number('SI'), v_po.id, 'supplier_to_buyer', v_po.vendor_org_id, v_po.buyer_org_id,
          (v_s->>'taxable')::numeric, (v_s->>'gst')::numeric, (v_b->>'rcm_tax')::numeric,
          (v_s->>'invoice_total')::numeric, v_s->>'tax_mode', v_lines)
  returning id into v_inv;

  v_n := jsonb_array_length(v_s->'schedule');
  for r in select value from jsonb_array_elements(v_s->'schedule') loop
    insert into public.invoice_installments (invoice_id, seq, label, pct, amount, due_event)
    values (v_inv, (r->>'seq')::integer,
            case when v_n = 1 then 'Full payment before work starts'
                 when (r->>'seq')::integer = 1 then 'Advance (' || (r->>'pct') || '%) before work starts'
                 else 'Balance (' || (r->>'pct') || '%) on delivery' end,
            (r->>'pct')::numeric, (r->>'amount')::numeric,
            case when (r->>'seq')::integer = 1 then 'on_order' else 'on_delivery' end);
  end loop;

  if v_route = 'mpi_collects' then
    perform app.ledger(v_po.id, 'supplier_invoice_issued', 'invoice', v_inv, jsonb_build_array(
      jsonb_build_object('account', 'buyer_receivable', 'amount',  (v_s->>'invoice_total')::numeric),
      jsonb_build_object('account', 'supplier_payable', 'amount', -(v_s->>'invoice_total')::numeric)));
  end if;

  -- 2. MPI's fee invoice to the buyer
  if (v_b->>'mpi_fee')::numeric > 0 then
    insert into public.invoices (number, po_id, kind, issuer_org_id, recipient_org_id, taxable_amount, tax_amount, total, lines)
    values (app.next_doc_number('BF'), v_po.id, 'mpi_fee_to_buyer', v_platform, v_po.buyer_org_id,
            (v_b->>'mpi_fee')::numeric, (v_b->>'mpi_fee_gst')::numeric, (v_b->>'mpi_fee_invoice')::numeric,
            jsonb_build_array(jsonb_build_object(
              'description', case v_rule.buyer_fee_type
                               when 'percent' then 'MPI procurement fee (' || trim(trailing '.' from trim(trailing '0' from v_rule.buyer_fee_value::text)) || '% of the discounted order value)'
                               else 'MPI procurement fee (fixed)' end,
              'amount', (v_b->>'mpi_fee')::numeric, 'tax_rate', v_rule.mpi_tax_pct)))
    returning id into v_inv;
    insert into public.invoice_installments (invoice_id, seq, label, pct, amount, due_event)
    values (v_inv, 1, 'MPI fee, paid with the first payment', 100, (v_b->>'mpi_fee_invoice')::numeric, 'on_order');
    perform app.ledger(v_po.id, 'mpi_fee_invoice_issued', 'invoice', v_inv, jsonb_build_array(
      jsonb_build_object('account', 'buyer_receivable', 'amount',  (v_b->>'mpi_fee_invoice')::numeric),
      jsonb_build_object('account', 'mpi_revenue',      'amount', -(v_b->>'mpi_fee')::numeric),
      jsonb_build_object('account', 'gst_payable',      'amount', -(v_b->>'mpi_fee_gst')::numeric)));
  end if;

  -- 3. MPI's commission invoice to the supplier
  if (v_s->>'commission')::numeric > 0 then
    insert into public.invoices (number, po_id, kind, issuer_org_id, recipient_org_id, taxable_amount, tax_amount, total, lines)
    values (app.next_doc_number('SC'), v_po.id, 'mpi_commission_to_supplier', v_platform, v_po.vendor_org_id,
            (v_s->>'commission')::numeric, (v_s->>'commission_gst')::numeric, (v_s->>'commission_invoice')::numeric,
            jsonb_build_array(jsonb_build_object(
              'description', 'MPI commission (' || trim(trailing '.' from trim(trailing '0' from v_rule.supplier_commission_pct::text)) || '% of the discounted order value)',
              'amount', (v_s->>'commission')::numeric, 'tax_rate', v_rule.mpi_tax_pct)))
    returning id into v_inv;
    insert into public.invoice_installments (invoice_id, seq, label, pct, amount, due_event)
    values (v_inv, 1,
            case when v_route = 'mpi_collects' then 'Deducted from your payout' else 'Paid to MPI after the buyer pays you' end,
            100, (v_s->>'commission_invoice')::numeric, 'on_settlement');
    perform app.ledger(v_po.id, 'commission_invoice_issued', 'invoice', v_inv, jsonb_build_array(
      jsonb_build_object('account', 'supplier_payable', 'amount',  (v_s->>'commission_invoice')::numeric),
      jsonb_build_object('account', 'mpi_revenue',      'amount', -(v_s->>'commission')::numeric),
      jsonb_build_object('account', 'gst_payable',      'amount', -(v_s->>'commission_gst')::numeric)));
  end if;

  -- 4. This order counts towards the supplier's MPI volume (one client, once).
  if v_cat is not null then
    insert into public.volume_events (vendor_org_id, category_id, client_key, buyer_org_id, po_id, eligible_value, qualified_at)
    values (v_po.vendor_org_id, v_cat, v_po.buyer_org_id::text, v_po.buyer_org_id, v_po.id, (v_m->>'fee_base')::numeric, v_po.approved_at)
    on conflict (po_id) do nothing;
  end if;
end;
$$;

create or replace function app.after_order_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.issue_order_documents(new.id);
  return null;
end;
$$;

create trigger after_order_created
  after insert on public.purchase_orders
  for each row execute function app.after_order_created();

-- A cancelled order no longer counts towards volume, and invoices nobody
-- has paid yet are cancelled. Paid money is handled by returns and refunds.
create or replace function app.after_order_cancelled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.volume_events set reversed_at = now() where po_id = new.id and reversed_at is null;
    update public.invoices i set status = 'cancelled'
     where i.po_id = new.id and i.amount_paid = 0 and i.status = 'issued';
  end if;
  return null;
end;
$$;

create trigger after_order_cancelled
  after update of status on public.purchase_orders
  for each row execute function app.after_order_cancelled();



-- ----------------------------------------------------------------------------
-- 7. Approving a quote: refuse an expired quote, or a price that changed
--    since the buyer saw it (spec D5 "Approve order").
-- ----------------------------------------------------------------------------
drop function if exists public.approve_quote(uuid);

create function public.approve_quote(p_quote_id uuid, p_expected_checkout numeric default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_quote public.quotes%rowtype;
  v_req   public.requests%rowtype;
  v_po    uuid;
  v_now   numeric;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.id is null then
    raise exception 'Quote not found';
  end if;

  select * into v_req from public.requests where id = v_quote.request_id for update;

  if app.my_role() is distinct from 'startup' or v_req.org_id is distinct from app.my_org_id() then
    raise exception 'Not allowed';
  end if;
  if v_quote.status <> 'submitted' then
    raise exception 'Only a submitted quote can be approved';
  end if;
  if v_req.status not in ('open', 'comparing') then
    raise exception 'This request is already closed';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'This quote expired on %. Ask the supplier to send it again.', to_char(v_quote.valid_until, 'DD Mon YYYY');
  end if;
  if p_expected_checkout is not null then
    v_now := (app.quote_calc(v_quote.id)->'buyer'->>'checkout_total')::numeric;
    if v_now <> round(p_expected_checkout, 2) then
      raise exception 'The price changed since you saw it (now ₹%). Please check it again.', v_now;
    end if;
  end if;

  update public.quotes set status = 'accepted' where id = v_quote.id;
  update public.quotes set status = 'rejected'
   where request_id = v_req.id and id <> v_quote.id and status = 'submitted';
  update public.requests set status = 'ordered' where id = v_req.id;

  insert into public.purchase_orders
    (request_id, quote_id, buyer_org_id, vendor_org_id, total_amount, currency, approved_by)
  values
    (v_req.id, v_quote.id, v_req.org_id, v_quote.vendor_org_id, v_quote.total, v_quote.currency, auth.uid())
  returning id into v_po;

  perform app.notify_org(v_quote.vendor_org_id, 'quote_accepted', 'Your quote was accepted',
                         v_req.title, '/vendor/quotes');
  perform app.notify_org(q.vendor_org_id, 'quote_not_selected', 'Quote not selected', v_req.title, '/vendor/quotes')
     from public.quotes q
    where q.request_id = v_req.id and q.status = 'rejected';
  perform app.audit('quote.approved', 'purchase_order', v_po,
                    jsonb_build_object('request_id', v_req.id, 'quote_id', v_quote.id, 'total', v_quote.total));
  return v_po;
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. Payments (simulated), payouts, returns and refunds
-- ----------------------------------------------------------------------------

-- Pays everything due now on the buyer's side: the advance and MPI fee at
-- order time, the balance once the order is delivered. Simulated only.
create or replace function app.pay_due(p_po_id uuid, p_key text, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_po      public.purchase_orders%rowtype;
  v_route   text;
  v_mpi     uuid;
  v_pay_mpi uuid;
  v_pay_sup uuid;
  v_to_mpi  numeric := 0;
  v_to_sup  numeric := 0;
  v_fee     numeric := 0;
  v_fee_tax numeric := 0;
  v_sup     numeric := 0;
  r         record;
  v_ids     uuid[] := '{}';
begin
  if p_key is null or length(p_key) < 8 then
    raise exception 'A payment needs a unique key (8 characters or more)';
  end if;
  -- Same key again: nothing new happens.
  if exists (select 1 from public.payments where idempotency_key in (p_key, p_key || ':supplier')) then
    return jsonb_build_object('already_recorded', true, 'simulated', true,
      'paid', (select sum(amount) from public.payments where idempotency_key in (p_key, p_key || ':supplier')));
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if v_po.id is null then
    raise exception 'Order not found';
  end if;
  if v_po.status = 'cancelled' then
    raise exception 'This order is cancelled';
  end if;
  select payment_route into v_route from public.order_price_snapshots where po_id = v_po.id;
  select id into v_mpi from public.organisations where type = 'platform' order by created_at limit 1;

  for r in
    select ii.*, i.kind, i.id as inv_id, i.total as inv_total, i.tax_amount as inv_tax
      from public.invoice_installments ii
      join public.invoices i on i.id = ii.invoice_id
     where i.po_id = v_po.id and i.status <> 'cancelled' and ii.status = 'due' and ii.amount > 0
       and i.kind in ('supplier_to_buyer', 'mpi_fee_to_buyer')
       and (ii.due_event = 'on_order'
            or (ii.due_event = 'on_delivery' and v_po.status in ('delivered', 'completed')))
     order by i.kind, ii.seq
  loop
    v_ids := v_ids || r.id;
    if r.kind = 'mpi_fee_to_buyer' then
      v_to_mpi  := v_to_mpi + r.amount;
      v_fee_tax := v_fee_tax + round(r.amount * r.inv_tax / nullif(r.inv_total, 0), 2);
      v_fee     := v_fee + r.amount;
    elsif v_route = 'mpi_collects' then
      v_to_mpi := v_to_mpi + r.amount;
      v_sup    := v_sup + r.amount;
    else
      v_to_sup := v_to_sup + r.amount;
    end if;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception 'Nothing is due right now. The balance is due once the order is delivered.';
  end if;

  if v_to_mpi > 0 then
    insert into public.payments (po_id, payer_org_id, payee, payee_org_id, amount, idempotency_key, created_by)
    values (v_po.id, v_po.buyer_org_id, 'mpi', v_mpi, v_to_mpi, p_key, p_actor)
    returning id into v_pay_mpi;
  end if;
  if v_to_sup > 0 then
    insert into public.payments (po_id, payer_org_id, payee, payee_org_id, amount, idempotency_key, created_by)
    values (v_po.id, v_po.buyer_org_id, 'supplier', v_po.vendor_org_id, v_to_sup,
            case when v_pay_mpi is null then p_key else p_key || ':supplier' end, p_actor)
    returning id into v_pay_sup;
  end if;

  insert into public.payment_allocations (payment_id, installment_id, amount)
  select case when i.kind = 'mpi_fee_to_buyer' or v_route = 'mpi_collects' then v_pay_mpi else v_pay_sup end,
         ii.id, ii.amount
    from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
   where ii.id = any (v_ids);
  update public.invoice_installments set status = 'paid', paid_at = now() where id = any (v_ids);
  perform app.refresh_invoice(i.id) from public.invoices i where i.po_id = v_po.id;

  if v_to_mpi > 0 then
    perform app.ledger(v_po.id, 'buyer_payment', 'payment', v_pay_mpi, jsonb_build_array(
      jsonb_build_object('account', 'mpi_cash',         'amount',  v_to_mpi),
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_to_mpi)));
  end if;

  perform app.notify_org(v_po.vendor_org_id, 'payment_received',
    'Payment received for order ' || v_po.po_number || ' (simulated)',
    'Buyer paid ₹' || (v_to_mpi - v_fee + v_to_sup) || ' towards your invoice. Simulated payment: no real money moved.',
    '/vendor/orders');
  perform app.audit('payment.simulated', 'purchase_order', v_po.id,
    jsonb_build_object('to_mpi', v_to_mpi, 'to_supplier', v_to_sup, 'key', p_key));

  return jsonb_build_object(
    'simulated', true,
    'note', 'Simulated payment: no real money moved.',
    'paid', v_to_mpi + v_to_sup,
    'to_mpi', v_to_mpi,
    'to_supplier_directly', v_to_sup,
    'mpi_fee', v_fee,
    'supplier_part', v_sup + v_to_sup);
end;
$$;

-- Pays the supplier what MPI has collected for it, minus MPI's commission
-- (net settlement, spec B2). For a direct-payment order it records the
-- supplier paying MPI's commission instead. Simulated only.
create or replace function app.settle(p_po_id uuid, p_key text, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_po        public.purchase_orders%rowtype;
  v_route     text;
  v_owed      numeric;
  v_unpaid    numeric;
  v_available numeric;
  v_com_inv   public.invoices%rowtype;
  v_com_out   numeric := 0;
  v_deduct    numeric := 0;
  v_ded_tax   numeric := 0;
  v_net       numeric;
  v_id        uuid;
begin
  if p_key is null or length(p_key) < 8 then
    raise exception 'A payout needs a unique key (8 characters or more)';
  end if;
  if exists (select 1 from public.settlements where idempotency_key = p_key) then
    return (select jsonb_build_object('already_recorded', true, 'simulated', true, 'net_paid', net_amount,
                                      'commission_deducted', commission_deducted)
              from public.settlements where idempotency_key = p_key);
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if v_po.id is null then
    raise exception 'Order not found';
  end if;
  select payment_route into v_route from public.order_price_snapshots where po_id = v_po.id;
  select * into v_com_inv from public.invoices where po_id = v_po.id and kind = 'mpi_commission_to_supplier';
  select coalesce(sum(ii.amount), 0) into v_com_out
    from public.invoice_installments ii where ii.invoice_id = v_com_inv.id and ii.status = 'due';

  if v_route = 'direct' then
    -- The buyer paid the supplier directly; the supplier now pays MPI's commission.
    if v_com_out <= 0 then
      raise exception 'Nothing to settle: the buyer pays this supplier directly and no commission is due';
    end if;
    insert into public.settlements (po_id, vendor_org_id, gross_amount, commission_deducted, net_amount, kind, idempotency_key, created_by)
    values (v_po.id, v_po.vendor_org_id, 0, v_com_out, 0, 'commission_paid_by_supplier', p_key, p_actor)
    returning id into v_id;
    update public.invoice_installments set status = 'paid', paid_at = now()
     where invoice_id = v_com_inv.id and status = 'due';
    perform app.refresh_invoice(v_com_inv.id);
    perform app.ledger(v_po.id, 'commission_paid', 'settlement', v_id, jsonb_build_array(
      jsonb_build_object('account', 'mpi_cash',         'amount',  v_com_out),
      jsonb_build_object('account', 'supplier_payable', 'amount', -v_com_out)));
    return jsonb_build_object('simulated', true, 'commission_paid', v_com_out, 'net_paid', 0);
  end if;

  -- What MPI owes the supplier, less the part of its invoice the buyer has
  -- not paid yet.
  v_owed := -app.ledger_balance(v_po.id, 'supplier_payable');
  select coalesce(sum(ii.amount), 0) into v_unpaid
    from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
   where i.po_id = v_po.id and i.kind = 'supplier_to_buyer' and ii.status = 'due';
  v_available := v_owed + v_com_out - v_unpaid;   -- before taking the commission
  if v_available <= 0 then
    raise exception 'Nothing to pay out yet: the buyer has not paid this part';
  end if;

  v_deduct := least(v_com_out, v_available);
  v_net    := v_available - v_deduct;
  if v_deduct > 0 then
    v_ded_tax := round(v_deduct * v_com_inv.tax_amount / nullif(v_com_inv.total, 0), 2);
  end if;

  insert into public.settlements (po_id, vendor_org_id, gross_amount, commission_deducted, net_amount, idempotency_key, created_by)
  values (v_po.id, v_po.vendor_org_id, v_available, v_deduct, v_net, p_key, p_actor)
  returning id into v_id;

  if v_deduct > 0 then
    if v_deduct >= v_com_out then
      update public.invoice_installments set status = 'paid', paid_at = now()
       where invoice_id = v_com_inv.id and status = 'due';
    else
      -- part of the commission taken now; the rest stays due
      update public.invoice_installments set amount = amount - v_deduct
       where invoice_id = v_com_inv.id and status = 'due' and seq = (select max(seq) from public.invoice_installments
                                                                     where invoice_id = v_com_inv.id and status = 'due');
      insert into public.invoice_installments (invoice_id, seq, label, amount, due_event, status, paid_at)
      values (v_com_inv.id, (select max(seq) + 1 from public.invoice_installments where invoice_id = v_com_inv.id),
              'Deducted from your payout', v_deduct, 'on_settlement', 'paid', now());
    end if;
    perform app.refresh_invoice(v_com_inv.id);
  end if;

  -- Commission is already in supplier_payable (booked when invoiced), so
  -- the payout just moves the net amount out of MPI's cash.
  perform app.ledger(v_po.id, 'supplier_payout', 'settlement', v_id, jsonb_build_array(
    jsonb_build_object('account', 'supplier_payable', 'amount',  v_net),
    jsonb_build_object('account', 'mpi_cash',         'amount', -v_net)));

  perform app.notify_org(v_po.vendor_org_id, 'payout_sent',
    'Payout for order ' || v_po.po_number || ' (simulated)',
    '₹' || v_net || ' paid to you after MPI''s commission of ₹' || v_deduct || '. Simulated: no real money moved.',
    '/vendor/orders');
  perform app.audit('payout.simulated', 'purchase_order', v_po.id,
    jsonb_build_object('gross', v_available, 'commission', v_deduct, 'net', v_net, 'key', p_key));

  return jsonb_build_object('simulated', true, 'note', 'Simulated payout: no real money moved.',
                            'gross', v_available, 'commission_deducted', v_deduct, 'commission_gst_part', v_ded_tax,
                            'net_paid', v_net);
end;
$$;

-- Units returned (or credited) on one item line: the supplier's credit
-- note, plus proportional reversal of MPI's % fee and commission (spec B2.1).
-- The credit first reduces what the buyer still owes; any rest is a refund.
create or replace function app.record_return(p_po_id uuid, p_quote_line_id uuid, p_units numeric, p_reason text,
                                             p_key text, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_po      public.purchase_orders%rowtype;
  v_snap    public.order_price_snapshots%rowtype;
  v_line    public.quote_lines%rowtype;
  v_done    numeric;
  v_taxable numeric;
  v_tax     numeric;
  v_sc      numeric;
  v_fee_b   numeric;
  v_fr      numeric := 0;
  v_fr_tax  numeric := 0;
  v_cr      numeric := 0;
  v_cr_tax  numeric := 0;
  v_mpi_tax numeric;
  v_inv_s   uuid;
  v_inv_f   uuid;
  v_inv_c   uuid;
  v_cn      uuid;
  v_credit  numeric;
  v_left    numeric;
  r         record;
  v_cut     numeric;
  v_refund  numeric;
begin
  if p_key is null or length(p_key) < 8 then
    raise exception 'A return needs a unique key (8 characters or more)';
  end if;
  if exists (select 1 from public.credit_notes where idempotency_key = p_key) then
    return jsonb_build_object('already_recorded', true);
  end if;
  if p_units is null or p_units <= 0 then
    raise exception 'Enter how many units came back';
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id for update;
  select * into v_snap from public.order_price_snapshots where po_id = p_po_id;
  select * into v_line from public.quote_lines where id = p_quote_line_id and quote_id = v_po.quote_id;
  if v_line.id is null or v_line.line_type <> 'item' or v_line.pass_through then
    raise exception 'Returns can only be recorded on the order''s item lines';
  end if;
  select coalesce(sum(units), 0) into v_done
    from public.credit_notes where quote_line_id = v_line.id and kind = 'supplier_credit';
  if v_done + p_units > v_line.quantity then
    raise exception 'Only % units are left to return on this line', v_line.quantity - v_done;
  end if;

  -- Credit at the locked net rate of this order
  v_taxable := round(p_units * v_line.unit_price
                     * (1 - (v_snap.inputs->>'volume_pct')::numeric / 100)
                     * (1 - (v_snap.inputs->>'negotiated_pct')::numeric / 100), 2);
  v_tax := case when v_snap.inputs->>'tax_mode' = 'reverse' then 0
                else round(v_taxable * v_line.tax_rate / 100, 2) end;
  v_sc := v_taxable + v_tax;
  v_fee_b := (v_snap.outputs->'mpi'->>'fee_base')::numeric;
  v_mpi_tax := (v_snap.inputs->>'mpi_tax_pct')::numeric;

  select id into v_inv_s from public.invoices where po_id = p_po_id and kind = 'supplier_to_buyer';
  select id into v_inv_f from public.invoices where po_id = p_po_id and kind = 'mpi_fee_to_buyer';
  select id into v_inv_c from public.invoices where po_id = p_po_id and kind = 'mpi_commission_to_supplier';

  insert into public.credit_notes (number, invoice_id, po_id, kind, taxable_amount, tax_amount, total, quote_line_id, units, reason, idempotency_key, created_by)
  values (app.next_doc_number('CN'), v_inv_s, p_po_id, 'supplier_credit', v_taxable, v_tax, v_sc, v_line.id, p_units, p_reason, p_key, p_actor)
  returning id into v_cn;

  -- A % fee is refunded in proportion; a fixed fee is not (spec B2.1).
  if v_inv_f is not null and v_snap.inputs->'buyer_fee'->>'type' = 'percent' and v_fee_b > 0 then
    v_fr     := round((v_snap.outputs->'mpi'->>'buyer_fee')::numeric * v_taxable / v_fee_b, 2);
    v_fr_tax := round(v_fr * v_mpi_tax / 100, 2);
    insert into public.credit_notes (number, invoice_id, po_id, kind, taxable_amount, tax_amount, total, reason, idempotency_key, created_by)
    values (app.next_doc_number('CN'), v_inv_f, p_po_id, 'buyer_fee_reversal', v_fr, v_fr_tax, v_fr + v_fr_tax, p_reason, p_key, p_actor);
  end if;
  if v_inv_c is not null and v_fee_b > 0 then
    v_cr     := round((v_snap.outputs->'mpi'->>'supplier_commission')::numeric * v_taxable / v_fee_b, 2);
    v_cr_tax := round(v_cr * v_mpi_tax / 100, 2);
    insert into public.credit_notes (number, invoice_id, po_id, kind, taxable_amount, tax_amount, total, reason, idempotency_key, created_by)
    values (app.next_doc_number('CN'), v_inv_c, p_po_id, 'commission_reversal', v_cr, v_cr_tax, v_cr + v_cr_tax, p_reason, p_key, p_actor);
  end if;

  -- Books
  if v_snap.payment_route = 'mpi_collects' then
    perform app.ledger(p_po_id, 'supplier_credit', 'credit_note', v_cn, jsonb_build_array(
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_sc),
      jsonb_build_object('account', 'supplier_payable', 'amount',  v_sc)));
  end if;
  if v_fr > 0 then
    perform app.ledger(p_po_id, 'buyer_fee_reversal', 'credit_note', v_cn, jsonb_build_array(
      jsonb_build_object('account', 'buyer_receivable', 'amount', -(v_fr + v_fr_tax)),
      jsonb_build_object('account', 'mpi_revenue',      'amount',  v_fr),
      jsonb_build_object('account', 'gst_payable',      'amount',  v_fr_tax)));
  end if;
  if v_cr > 0 then
    perform app.ledger(p_po_id, 'commission_reversal', 'credit_note', v_cn, jsonb_build_array(
      jsonb_build_object('account', 'supplier_payable', 'amount', -(v_cr + v_cr_tax)),
      jsonb_build_object('account', 'mpi_revenue',      'amount',  v_cr),
      jsonb_build_object('account', 'gst_payable',      'amount',  v_cr_tax)));
    -- Commission not yet taken from a payout shrinks first.
    v_left := v_cr + v_cr_tax;
    for r in select * from public.invoice_installments where invoice_id = v_inv_c and status = 'due' order by seq desc loop
      v_cut := least(r.amount, v_left);
      update public.invoice_installments set amount = amount - v_cut,
             status = case when amount - v_cut = 0 then 'waived' else status end
       where id = r.id;
      v_left := v_left - v_cut;
      exit when v_left = 0;
    end loop;
  end if;

  -- What the buyer still owes shrinks first (latest instalment first).
  v_left := v_sc + v_fr + v_fr_tax;
  for r in
    select ii.* from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
     where i.po_id = p_po_id and i.kind in ('supplier_to_buyer', 'mpi_fee_to_buyer') and ii.status = 'due'
     order by (i.kind = 'supplier_to_buyer') desc, ii.seq desc
  loop
    exit when v_left = 0;
    v_cut := least(r.amount, v_left);
    update public.invoice_installments set amount = amount - v_cut,
           status = case when amount - v_cut = 0 then 'waived' else status end
     where id = r.id;
    v_left := v_left - v_cut;
  end loop;
  perform app.refresh_invoice(i.id) from public.invoices i where i.po_id = p_po_id;

  v_refund := greatest(-app.ledger_balance(p_po_id, 'buyer_receivable'), 0);
  if v_snap.payment_route = 'direct' then
    v_refund := v_left;   -- the supplier refunds its part directly
  end if;

  perform app.notify_org(v_po.buyer_org_id, 'return_recorded', 'Return recorded on order ' || v_po.po_number,
    p_units || ' units credited: ₹' || (v_sc + v_fr + v_fr_tax) || '.', '/app/orders');
  perform app.audit('order.return', 'purchase_order', p_po_id,
    jsonb_build_object('units', p_units, 'supplier_credit', v_sc, 'fee_reversal', v_fr + v_fr_tax,
                       'commission_reversal', v_cr + v_cr_tax, 'key', p_key));

  return jsonb_build_object(
    'supplier_credit', v_sc,
    'buyer_fee_reversal', v_fr + v_fr_tax,
    'commission_reversal', v_cr + v_cr_tax,
    'buyer_credit_total', v_sc + v_fr + v_fr_tax,
    'refund_due', v_refund,
    'supplier_owes_mpi', greatest(app.ledger_balance(p_po_id, 'supplier_payable'), 0));
end;
$$;


-- ----------------------------------------------------------------------------
-- 9. What the app calls
-- ----------------------------------------------------------------------------

-- Is this person allowed to see this quote's money, and from which side?
create or replace function app.money_side(p_request_org uuid, p_vendor_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when app.is_admin() then 'admin'
              when app.my_org_id() = p_request_org then 'buyer'
              when app.my_org_id() = p_vendor_org then 'supplier'
              else null end;
$$;

create or replace function app.money_for_side(p_calc jsonb, p_side text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_side
           when 'admin'    then p_calc
           when 'buyer'    then jsonb_build_object('formula_version', p_calc->'formula_version',
                                                   'buyer', p_calc->'buyer', 'savings', p_calc->'savings')
           when 'supplier' then jsonb_build_object('formula_version', p_calc->'formula_version',
                                                   'supplier', p_calc->'supplier')
         end;
$$;

-- Price breakdown of a quote, as of now. Buyers see what they pay; suppliers
-- see their invoice, MPI's commission and their payout; admin sees all.
create or replace function public.price_breakdown(p_quote_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q     public.quotes%rowtype;
  v_buyer uuid;
  v_cat   uuid;
  v_side  text;
  v_rule  public.fee_rules%rowtype;
  v_calc  jsonb;
begin
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then
    raise exception 'Quote not found';
  end if;
  select org_id, category_id into v_buyer, v_cat from public.requests where id = v_q.request_id;
  v_side := app.money_side(v_buyer, v_q.vendor_org_id);
  if v_side is null or (v_side = 'buyer' and v_q.status = 'draft') then
    raise exception 'Not allowed';
  end if;
  v_rule := app.fee_rule_for(v_cat);
  v_calc := app.quote_calc(v_q.id, v_rule.id);
  return app.money_for_side(v_calc, v_side) || jsonb_build_object(
    'quote_id', v_q.id,
    'side', v_side,
    'payment_terms', v_q.payment_terms,
    'payment_route', v_rule.payment_route,
    'volume', jsonb_build_object('pct', v_q.volume_discount_pct, 'clients_last_month', v_q.volume_clients,
                                 'locked', v_q.price_terms_locked),
    'fee_rule', jsonb_build_object('version', v_rule.version, 'needs_review', v_rule.needs_review,
                                   'professional_gate', v_rule.professional_gate, 'note', v_rule.note));
end;
$$;

-- Everything about an order's money, from the asker's side.
create or replace function public.order_money(p_po_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_po   public.purchase_orders%rowtype;
  v_side text;
  v_snap public.order_price_snapshots%rowtype;
  v_org  uuid;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  if v_po.id is null then
    raise exception 'Order not found';
  end if;
  v_side := app.money_side(v_po.buyer_org_id, v_po.vendor_org_id);
  if v_side is null then
    raise exception 'Not allowed';
  end if;
  v_org := app.my_org_id();
  select * into v_snap from public.order_price_snapshots where po_id = p_po_id;

  return jsonb_build_object(
    'po_id', v_po.id,
    'po_number', v_po.po_number,
    'side', v_side,
    'simulated_payments', true,
    'payment_route', v_snap.payment_route,
    'priced_with', jsonb_build_object('fee_rule_version', v_snap.fee_rule_version, 'formula_version', v_snap.formula_version,
                                      'volume_pct', v_snap.inputs->'volume_pct', 'volume_clients', v_snap.inputs->'volume_clients',
                                      'priced_at', v_snap.created_at),
    'amounts', app.money_for_side(v_snap.outputs, v_side),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'number', i.number, 'kind', i.kind, 'taxable', i.taxable_amount, 'gst', i.tax_amount,
               'rcm_gst', i.rcm_tax_amount, 'total', i.total, 'status', i.status, 'paid', i.amount_paid,
               'credited', i.amount_credited, 'issued_at', i.issued_at, 'lines', i.lines,
               'installments', (select jsonb_agg(jsonb_build_object('id', ii.id, 'seq', ii.seq, 'label', ii.label,
                                                                    'amount', ii.amount, 'due', ii.due_event,
                                                                    'status', ii.status, 'paid_at', ii.paid_at)
                                                 order by ii.seq)
                                  from public.invoice_installments ii where ii.invoice_id = i.id))
             order by i.kind desc)
        from public.invoices i
       where i.po_id = p_po_id and (v_side = 'admin' or v_org in (i.issuer_org_id, i.recipient_org_id))), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'payee', p.payee, 'simulated', p.is_simulated,
                                          'paid_at', p.created_at) order by p.created_at)
        from public.payments p
       where p.po_id = p_po_id and (v_side = 'admin' or v_org in (p.payer_org_id, p.payee_org_id))), '[]'::jsonb),
    'payouts', case when v_side in ('admin', 'supplier') then coalesce((
      select jsonb_agg(jsonb_build_object('gross', s.gross_amount, 'commission_deducted', s.commission_deducted,
                                          'net', s.net_amount, 'kind', s.kind, 'simulated', s.is_simulated,
                                          'paid_at', s.created_at) order by s.created_at)
        from public.settlements s where s.po_id = p_po_id), '[]'::jsonb) end,
    'credit_notes', coalesce((
      select jsonb_agg(jsonb_build_object('number', c.number, 'kind', c.kind, 'total', c.total, 'units', c.units,
                                          'reason', c.reason, 'created_at', c.created_at) order by c.created_at)
        from public.credit_notes c join public.invoices i on i.id = c.invoice_id
       where c.po_id = p_po_id and (v_side = 'admin' or v_org in (i.issuer_org_id, i.recipient_org_id))), '[]'::jsonb),
    'refunds', case when v_side in ('admin', 'buyer') then coalesce((
      select jsonb_agg(jsonb_build_object('amount', f.amount, 'simulated', f.is_simulated, 'paid_at', f.created_at))
        from public.refunds f where f.po_id = p_po_id), '[]'::jsonb) end,
    'balances', case
      when v_side = 'admin' then (
        select jsonb_object_agg(a.account, coalesce(b.total, 0))
          from (values ('mpi_cash'), ('buyer_receivable'), ('supplier_payable'), ('mpi_revenue'), ('gst_payable')) a (account)
          left join (select account, sum(amount) as total from public.ledger_entries where po_id = p_po_id group by account) b
            on b.account = a.account)
      when v_side = 'buyer' then jsonb_build_object(
        'still_to_pay', coalesce((select sum(ii.amount) from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
                                   where i.po_id = p_po_id and i.kind in ('supplier_to_buyer', 'mpi_fee_to_buyer')
                                     and i.status <> 'cancelled' and ii.status = 'due'), 0),
        'refund_due', greatest(-app.ledger_balance(p_po_id, 'buyer_receivable'), 0))
      else jsonb_build_object(
        'mpi_owes_you', greatest(-app.ledger_balance(p_po_id, 'supplier_payable'), 0),
        'you_owe_mpi',  greatest(app.ledger_balance(p_po_id, 'supplier_payable'), 0))
      end);
end;
$$;

-- The buyer pays what is due now (simulated). Admin may also record it.
create or replace function public.pay_order(p_po_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_buyer uuid;
begin
  select buyer_org_id into v_buyer from public.purchase_orders where id = p_po_id;
  if v_buyer is null then
    raise exception 'Order not found';
  end if;
  if not (app.is_admin() or (app.my_role() = 'startup' and app.my_org_id() = v_buyer)) then
    raise exception 'Not allowed';
  end if;
  return app.pay_due(p_po_id, p_idempotency_key, auth.uid());
end;
$$;

-- Admin pays the supplier out (simulated).
create or replace function public.settle_supplier(p_po_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  return app.settle(p_po_id, p_idempotency_key, auth.uid());
end;
$$;

-- The supplier (or admin) records units that came back.
create or replace function public.record_return(p_po_id uuid, p_quote_line_id uuid, p_units numeric,
                                                p_reason text, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_vendor uuid;
begin
  select vendor_org_id into v_vendor from public.purchase_orders where id = p_po_id;
  if v_vendor is null then
    raise exception 'Order not found';
  end if;
  if not (app.is_admin() or (app.my_role() = 'vendor' and app.my_org_id() = v_vendor)) then
    raise exception 'Not allowed';
  end if;
  return app.record_return(p_po_id, p_quote_line_id, p_units, p_reason, p_idempotency_key, auth.uid());
end;
$$;

-- Admin pays out a refund the buyer is owed (simulated).
create or replace function public.pay_refund(p_po_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_po  public.purchase_orders%rowtype;
  v_due numeric;
  v_id  uuid;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if exists (select 1 from public.refunds where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('already_recorded', true);
  end if;
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  v_due := greatest(-app.ledger_balance(p_po_id, 'buyer_receivable'), 0);
  if v_due <= 0 then
    raise exception 'No refund is due on this order';
  end if;
  insert into public.refunds (po_id, buyer_org_id, amount, idempotency_key, created_by)
  values (p_po_id, v_po.buyer_org_id, v_due, p_idempotency_key, auth.uid())
  returning id into v_id;
  perform app.ledger(p_po_id, 'refund_paid', 'refund', v_id, jsonb_build_array(
    jsonb_build_object('account', 'buyer_receivable', 'amount',  v_due),
    jsonb_build_object('account', 'mpi_cash',         'amount', -v_due)));
  perform app.notify_org(v_po.buyer_org_id, 'refund_paid', 'Refund for order ' || v_po.po_number || ' (simulated)',
    '₹' || v_due || ' refunded. Simulated: no real money moved.', '/app/orders');
  return jsonb_build_object('simulated', true, 'refunded', v_due);
end;
$$;

-- Compare the offers on a request, scored out of 100 (sample weights:
-- price 35, quality 35, delivery 20, location 10). Price is the full cost
-- to the buyer: supplier invoice, MPI fee, pass-throughs and any reverse
-- charge GST. The AI suggests; the startup decides.
create or replace function public.compare_offers(p_request_id uuid)
returns table (quote_id uuid, supplier_alias text, total_cost numeric, checkout_total numeric, volume_benefit numeric,
               lead_time_days integer, price_points numeric, quality_points numeric, delivery_points numeric,
               location_points numeric, score integer, rank integer, reasons text[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v_req  public.requests%rowtype;
  v_w    jsonb;
  v_remote boolean;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Request not found';
  end if;
  if not (app.is_admin() or app.my_org_id() = v_req.org_id) then
    raise exception 'Not allowed';
  end if;
  select offer_score_weights into v_w from public.platform_settings;
  select coalesce(c.is_tangible, false) = false and v_req.delivery_city is null and v_req.delivery_state is null
    into v_remote from public.catalogue_categories c where c.id = v_req.category_id;
  v_remote := coalesce(v_remote, v_req.delivery_city is null and v_req.delivery_state is null);

  return query
  with q as (
    select qt.id, o.display_name, qt.lead_time_days as lead,
           app.quote_calc(qt.id) as calc,
           vd.certifications, vd.quality_testing_facilities, o.verification_status,
           o.city, o.state, vd.pan_india_dispatch
      from public.quotes qt
      join public.organisations o on o.id = qt.vendor_org_id
      left join public.vendor_details vd on vd.org_id = qt.vendor_org_id
     where qt.request_id = p_request_id and qt.status = 'submitted'
  ), c as (
    select q.*,
           (q.calc->'buyer'->>'total_cost')::numeric as cost,
           (q.calc->'buyer'->>'checkout_total')::numeric as checkout,
           (q.calc->'buyer'->>'volume_benefit')::numeric as vol,
           -- quality: certifications asked for (60%), testing facilities (25%), verified (15%)
           (case when cardinality(v_req.required_certifications) = 0
                 then case when cardinality(coalesce(q.certifications, '{}')) > 0 then 1.0 else 0.5 end
                 else (select count(*) from unnest(v_req.required_certifications) r where r = any (coalesce(q.certifications, '{}')))::numeric
                      / cardinality(v_req.required_certifications) end) * 0.60
           + (case when cardinality(coalesce(q.quality_testing_facilities, '{}')) > 0 then 0.25 else 0 end)
           + (case when q.verification_status = 'verified' then 0.15 else 0 end) as quality_share,
           case when v_remote then case when q.pan_india_dispatch then 1.0 else 0.4 end
                when v_req.delivery_city is not null and q.city = v_req.delivery_city then 1.0
                when v_req.delivery_state is not null and q.state = v_req.delivery_state then 0.7
                when q.pan_india_dispatch then 0.4
                else 0.2 end as location_share
      from q
  ), b as (
    select min(cost) as min_cost, min(coalesce(lead, 9999)) as min_lead from c
  ), s as (
    select c.*,
           round((v_w->>'price')::numeric * b.min_cost / nullif(c.cost, 0), 1) as p_pts,
           round((v_w->>'quality')::numeric * c.quality_share, 1) as q_pts,
           round((v_w->>'delivery')::numeric
                 * case when c.lead is null then 0.5 else b.min_lead::numeric / greatest(c.lead, 1) end
                 * case when v_req.needed_by is not null and c.lead is not null and current_date + c.lead > v_req.needed_by
                        then 0.5 else 1 end, 1) as d_pts,
           round((v_w->>'location')::numeric * c.location_share, 1) as l_pts
      from c cross join b
  )
  select s.id, s.display_name, s.cost, s.checkout, s.vol, s.lead,
         s.p_pts, s.q_pts, s.d_pts, s.l_pts,
         least(round(s.p_pts + s.q_pts + s.d_pts + s.l_pts), 100)::integer,
         (rank() over (order by (s.p_pts + s.q_pts + s.d_pts + s.l_pts) desc, s.cost))::integer,
         array_remove(array[
           case when s.cost = (select min_cost from b) then 'Lowest total cost' end,
           case when s.vol > 0 then 'Includes MPI volume benefit of ₹' || s.vol end,
           case when s.lead is not null then 'Delivers in ' || s.lead || ' days' end,
           case when v_req.needed_by is not null and s.lead is not null and current_date + s.lead > v_req.needed_by
                then 'May miss your date' end,
           case when s.quality_share >= 0.85 then 'Strong quality record' end
         ], null)
    from s
   order by 12;
end;
$$;

-- The supplier's MPI volume: clients last month, its rate now and the next
-- step. Counts only, never which clients.
create or replace function public.volume_status(p_vendor_org_id uuid default null)
returns table (category_id uuid, category_name text, rate_card_id uuid, clients_last_month integer, current_pct numeric,
               next_tier_clients integer, next_tier_pct numeric, clients_this_month integer, tiers jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_vendor uuid := coalesce(p_vendor_org_id, app.my_org_id());
begin
  if not (app.is_admin() or (app.my_role() = 'vendor' and v_vendor = app.my_org_id())) then
    raise exception 'Not allowed';
  end if;
  return query
  select rc.category_id, c.name, t.rate_card_id, t.clients, t.pct, t.next_min, t.next_pct, t.clients_this_month, rc.tiers
    from public.supplier_rate_cards rc
    join public.catalogue_categories c on c.id = rc.category_id
    cross join lateral app.volume_tier(rc.vendor_org_id, rc.category_id, now()) t
   where rc.vendor_org_id = v_vendor and rc.is_active
   order by c.sort_order;
end;
$$;

-- Admin: new version of a fee rule. Applies to orders placed from now on;
-- orders already placed keep the version they were priced with.
create or replace function public.set_fee_rule(
  p_category_id uuid, p_buyer_fee_type text, p_buyer_fee_value numeric,
  p_commission_enabled boolean, p_commission_pct numeric,
  p_supplier_tax_mode text default 'forward', p_payment_route text default 'mpi_collects',
  p_mpi_tax_pct numeric default 18, p_buyer_fee_min numeric default null, p_buyer_fee_max numeric default null,
  p_professional_gate boolean default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_prev public.fee_rules%rowtype;
  v_gate boolean;
  v_id   uuid;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into v_prev from public.fee_rules
   where category_id is not distinct from p_category_id order by version desc limit 1;
  v_gate := coalesce(p_professional_gate, v_prev.professional_gate, false);
  if v_gate and p_commission_enabled then
    raise exception 'Commission must stay off for legal and CA work until a qualified legal review approves another structure';
  end if;
  if coalesce(v_prev.professional_gate, false) and not v_gate and coalesce(trim(p_note), '') = '' then
    raise exception 'Turning off the legal/CA protection needs a note saying who approved it';
  end if;

  insert into public.fee_rules (category_id, version, buyer_fee_type, buyer_fee_value, buyer_fee_min, buyer_fee_max,
                                supplier_commission_enabled, supplier_commission_pct, mpi_tax_pct, supplier_tax_mode,
                                payment_route, professional_gate, needs_review, note, created_by)
  values (p_category_id, coalesce(v_prev.version, 0) + 1, p_buyer_fee_type, coalesce(p_buyer_fee_value, 0),
          p_buyer_fee_min, p_buyer_fee_max, coalesce(p_commission_enabled, false), coalesce(p_commission_pct, 0),
          coalesce(p_mpi_tax_pct, 18), coalesce(p_supplier_tax_mode, 'forward'), coalesce(p_payment_route, 'mpi_collects'),
          v_gate, true, p_note, auth.uid())
  returning id into v_id;

  perform app.audit('settings.fee_rule', 'fee_rule', v_id,
    jsonb_build_object('category_id', p_category_id, 'version', coalesce(v_prev.version, 0) + 1,
                       'buyer_fee', p_buyer_fee_type || ' ' || p_buyer_fee_value,
                       'commission', case when p_commission_enabled then p_commission_pct::text else 'off' end,
                       'professional_gate', v_gate, 'note', p_note));
  return v_id;
end;
$$;

-- Admin: a supplier's MPI rate card for a category (replaces the active one).
-- Tiers like [{"min": 1, "pct": 0}, {"min": 5, "pct": 5}, {"min": 10, "pct": 10}, {"min": 20, "pct": 15}].
create or replace function public.save_rate_card(p_vendor_org_id uuid, p_category_id uuid, p_tiers jsonb,
                                                 p_metric text default 'unique_clients', p_valid_from date default current_date,
                                                 p_valid_to date default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_prev integer;
  v_id   uuid;
  v_bad  integer;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.vendor_categories where vendor_org_id = p_vendor_org_id and category_id = p_category_id) then
    raise exception 'This supplier does not serve that category';
  end if;
  if jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then
    raise exception 'Add at least one tier';
  end if;
  select count(*) into v_bad from jsonb_array_elements(p_tiers) t
   where (t->>'min') is null or (t->>'pct') is null or (t->>'min')::integer < 0
      or (t->>'pct')::numeric < 0 or (t->>'pct')::numeric > 50;
  if v_bad > 0 then
    raise exception 'Each tier needs a client count of 0 or more and a discount between 0%% and 50%%';
  end if;

  select max(version) into v_prev from public.supplier_rate_cards where vendor_org_id = p_vendor_org_id and category_id = p_category_id;
  update public.supplier_rate_cards set is_active = false
   where vendor_org_id = p_vendor_org_id and category_id = p_category_id and is_active;
  insert into public.supplier_rate_cards (vendor_org_id, category_id, version, metric, tiers, valid_from, valid_to, note, created_by)
  values (p_vendor_org_id, p_category_id, coalesce(v_prev, 0) + 1, coalesce(p_metric, 'unique_clients'),
          (select jsonb_agg(t order by (t->>'min')::integer) from jsonb_array_elements(p_tiers) t),
          coalesce(p_valid_from, current_date), p_valid_to, p_note, auth.uid())
  returning id into v_id;
  perform app.audit('settings.rate_card', 'supplier_rate_card', v_id,
    jsonb_build_object('vendor_org_id', p_vendor_org_id, 'category_id', p_category_id, 'tiers', p_tiers));
  return v_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 10. Sample fee rules from the spec (needs_review = true on all)
-- ----------------------------------------------------------------------------
insert into public.fee_rules (category_id, version, buyer_fee_type, buyer_fee_value, supplier_commission_enabled,
                              supplier_commission_pct, mpi_tax_pct, supplier_tax_mode, payment_route,
                              professional_gate, needs_review, note)
values
  (null, 1, 'percent', 2, true, 5, 18, 'forward', 'mpi_collects', false, true,
   'Sample figures from the client''s spec (31 Oct 2026): 2% buyer fee and 5% supplier commission on the discounted order value, 18% GST on MPI''s invoices. Not final terms.');

insert into public.fee_rules (category_id, version, buyer_fee_type, buyer_fee_value, supplier_commission_enabled,
                              supplier_commission_pct, mpi_tax_pct, supplier_tax_mode, payment_route,
                              professional_gate, needs_review, note)
select c.id, 1, 'fixed', v.fee, false, 0, 18, 'forward', 'direct', true, true, v.note
  from public.catalogue_categories c
  join (values
    ('compliance-and-legal-support', 500::numeric,
     'Legal work: no commission (professional rules). The buyer pays the professional directly. The ₹500 MPI fee is the spec''s sample and needs legal review before real use. Reverse-charge GST can be switched on per category once reviewed.'),
    ('business-and-finance-services', 300::numeric,
     'CA and accounting work: no commission (ICAI rules). The buyer pays the professional directly. The ₹300 MPI fee is the spec''s sample and needs review before real use.')
  ) as v (slug, fee, note) on v.slug = c.slug;


-- ----------------------------------------------------------------------------
-- 11. Orders that already exist get their documents (snapshot, invoices)
-- ----------------------------------------------------------------------------
do $$
declare
  v_po record;
begin
  for v_po in select po.id from public.purchase_orders po
               where not exists (select 1 from public.order_price_snapshots s where s.po_id = po.id)
               order by po.created_at loop
    perform app.issue_order_documents(v_po.id);
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- 12. Access
--     Money tables are read-only for everyone: only the functions above
--     write to them. Each side sees only its own documents.
-- ----------------------------------------------------------------------------
revoke execute on all functions in schema app from public;
grant execute on function
  app.my_org_id(), app.my_role(), app.is_admin(), app.my_org_is_demo(),
  app.is_invited_to(uuid), app.owns_request(uuid), app.can_see_request(uuid)
to authenticated;
grant execute on function app.is_admin() to anon;

revoke execute on function public.approve_quote(uuid, numeric) from public, anon;
revoke execute on function public.price_breakdown(uuid) from public, anon;
revoke execute on function public.order_money(uuid) from public, anon;
revoke execute on function public.pay_order(uuid, text) from public, anon;
revoke execute on function public.settle_supplier(uuid, text) from public, anon;
revoke execute on function public.record_return(uuid, uuid, numeric, text, text) from public, anon;
revoke execute on function public.pay_refund(uuid, text) from public, anon;
revoke execute on function public.compare_offers(uuid) from public, anon;
revoke execute on function public.volume_status(uuid) from public, anon;
revoke execute on function public.set_fee_rule(uuid, text, numeric, boolean, numeric, text, text, numeric, numeric, numeric, boolean, text) from public, anon;
revoke execute on function public.save_rate_card(uuid, uuid, jsonb, text, date, date, text) from public, anon;
grant execute on function
  public.approve_quote(uuid, numeric), public.price_breakdown(uuid), public.order_money(uuid),
  public.pay_order(uuid, text), public.settle_supplier(uuid, text),
  public.record_return(uuid, uuid, numeric, text, text), public.pay_refund(uuid, text),
  public.compare_offers(uuid), public.volume_status(uuid),
  public.set_fee_rule(uuid, text, numeric, boolean, numeric, text, text, numeric, numeric, numeric, boolean, text),
  public.save_rate_card(uuid, uuid, jsonb, text, date, date, text)
to authenticated;

grant select on public.fee_rules, public.supplier_rate_cards, public.invoices, public.invoice_installments,
                public.payments, public.settlements, public.credit_notes, public.refunds
  to authenticated;

alter table public.fee_rules             enable row level security;
alter table public.supplier_rate_cards   enable row level security;
alter table public.volume_events         enable row level security;
alter table public.order_price_snapshots enable row level security;
alter table public.invoices              enable row level security;
alter table public.invoice_installments  enable row level security;
alter table public.payments              enable row level security;
alter table public.payment_allocations   enable row level security;
alter table public.settlements           enable row level security;
alter table public.credit_notes          enable row level security;
alter table public.refunds               enable row level security;
alter table public.ledger_entries        enable row level security;

-- Fee rules are platform terms: every signed-in user may read them.
create policy fr_select on public.fee_rules for select to authenticated using (true);
-- A supplier sees its own rate cards; admin sees all.
create policy rc_select on public.supplier_rate_cards for select to authenticated
  using (vendor_org_id = (select app.my_org_id()) or (select app.is_admin()));
-- Invoices: the issuer and the recipient; admin.
create policy invoice_select on public.invoices for select to authenticated
  using ((select app.my_org_id()) in (issuer_org_id, recipient_org_id) or (select app.is_admin()));
create policy installment_select on public.invoice_installments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy payment_select on public.payments for select to authenticated
  using ((select app.my_org_id()) in (payer_org_id, payee_org_id) or (select app.is_admin()));
create policy settlement_select on public.settlements for select to authenticated
  using (vendor_org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy credit_select on public.credit_notes for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy refund_select on public.refunds for select to authenticated
  using (buyer_org_id = (select app.my_org_id()) or (select app.is_admin()));
-- volume_events, order_price_snapshots, payment_allocations, ledger_entries:
-- no grants at all. Read through order_money() and volume_status().


-- ----------------------------------------------------------------------------
-- 13. Demo workspace: rate cards, sample volume, and two orders that follow
--     the spec's worked examples exactly (packaging B2, marketing C4).
--     The earlier reset stays as it is and runs first.
-- ----------------------------------------------------------------------------
alter function public.reset_demo_workspace() set schema app;
alter function app.reset_demo_workspace() rename to reset_demo_workspace_base;
revoke execute on function app.reset_demo_workspace_base() from public, anon, authenticated;

create or replace function public.reset_demo_workspace() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_base      text;
  v_buyer     uuid; v_buyer_user uuid;
  v_s1        uuid; v_s2 uuid; v_s3 uuid; v_sv uuid;
  v_pack      uuid; v_proto uuid; v_it uuid; v_mkt uuid;
  v_tiers     constant jsonb := '[{"min": 1, "pct": 0}, {"min": 5, "pct": 5}, {"min": 10, "pct": 10}, {"min": 20, "pct": 15}]';
  v_last      timestamp;
  v_req       uuid; v_line uuid; v_inv uuid; v_q uuid; v_po uuid;
  v_po_a      uuid; v_po_b uuid;
begin
  if session_user = 'authenticator' and not app.is_admin() then
    raise exception 'Not allowed';
  end if;

  select org_id into v_s1 from public.profiles where email = 'mpi-demosupplier1@example.com';
  select org_id into v_s2 from public.profiles where email = 'mpi-demosupplier2@example.com';
  select org_id into v_s3 from public.profiles where email = 'mpi-demosupplier3@example.com';
  select org_id into v_sv from public.profiles where email = 'mpi-demoservice@example.com';

  -- Clear the demo suppliers' rate cards and sample volume first, so the
  -- base reset's quotes are priced without them (as before).
  delete from public.volume_events where vendor_org_id in (v_s1, v_s2, v_s3, v_sv) and is_sample;
  delete from public.supplier_rate_cards where vendor_org_id in (v_s1, v_s2, v_s3, v_sv);

  v_base := app.reset_demo_workspace_base();

  select id, org_id into v_buyer_user, v_buyer from public.profiles where email = 'mpi-demostartup@example.com';
  select id into v_pack  from public.catalogue_categories where slug = 'packaging-and-printing';
  select id into v_proto from public.catalogue_categories where slug = 'prototyping-and-product-development';
  select id into v_it    from public.catalogue_categories where slug = 'it-and-digital-services';
  select id into v_mkt   from public.catalogue_categories where slug = 'marketing-and-sales-support';

  -- 1. Sample MPI rate cards (spec A2.2 tiers) for every demo supplier.
  insert into public.supplier_rate_cards (vendor_org_id, category_id, tiers, valid_from, note)
  values (v_s1, v_pack,  v_tiers, current_date - 60, 'Sample rate card from the client''s spec'),
         (v_s3, v_pack,  v_tiers, current_date - 60, 'Sample rate card from the client''s spec'),
         (v_s2, v_proto, v_tiers, current_date - 60, 'Sample rate card from the client''s spec'),
         (v_sv, v_it,    v_tiers, current_date - 60, 'Sample rate card from the client''s spec'),
         (v_sv, v_mkt,   v_tiers, current_date - 60, 'Sample rate card from the client''s spec');

  -- 2. Sample clients MPI brought each supplier last month (India time):
  --    supplier 1 packaging 10 (10% rate), supplier 3 packaging 6 (5%),
  --    supplier 2 prototyping 3 (0%), service studio marketing 10 (10%),
  --    service studio IT 5 (5%).
  v_last := date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '1 month';
  insert into public.volume_events (vendor_org_id, category_id, client_key, eligible_value, qualified_at, is_sample)
  select v.vendor, v.cat, 'sample-client-' || lpad(g::text, 2, '0'), 10000,
         (v_last + make_interval(days => g, hours => 11)) at time zone 'Asia/Kolkata', true
    from (values (v_s1, v_pack, 10), (v_s3, v_pack, 6), (v_s2, v_proto, 3), (v_sv, v_mkt, 10), (v_sv, v_it, 5))
         as v (vendor, cat, n)
   cross join lateral generate_series(1, v.n) g;

  -- 3. Order A, the spec's packaging example (B2): 1,000 cartons at ₹10,
  --    ₹1,000 die, ₹500 freight, supplier 1 at its 10% MPI rate.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, delivery_city, delivery_state, budget_max)
  values (v_buyer, v_buyer_user, 'Shipping cartons, 1,000 pcs',
          '5-ply brown shipping carton, 400 x 300 x 300 mm, 1-colour logo print.',
          v_pack, 'catalogue', 'open', current_date + 20, 'Bengaluru', 'Karnataka', 14000)
  returning id into v_req;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_req, (select id from public.catalogue_items where name = 'Corrugated boxes'),
          '5-ply shipping carton, 400 x 300 x 300 mm', 1000, 'pcs')
  returning id into v_line;
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_req and vendor_org_id = v_s1;
  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_req, v_s1) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, valid_until)
  values (v_inv, v_req, v_s1, 'draft', 12, current_date + 15) returning id into v_q;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order) values
    (v_q, v_line, 'item',      '5-ply shipping carton, 400 x 300 x 300 mm', 1000, 10, 1),
    (v_q, null,   'setup',     'Printing die (one-time)', 1, 1000, 2),
    (v_q, null,   'logistics', 'Freight to Bengaluru', 1, 500, 3);
  update public.quotes set status = 'submitted' where id = v_q;
  update public.quotes set status = 'accepted' where id = v_q;
  update public.requests set status = 'ordered' where id = v_req;
  insert into public.purchase_orders (request_id, quote_id, buyer_org_id, vendor_org_id, total_amount, approved_by, expected_delivery)
  select v_req, q.id, v_buyer, v_s1, q.total, v_buyer_user, current_date + 10 from public.quotes q where q.id = v_q
  returning id into v_po_a;
  update public.purchase_orders set status = 'in_production', status_changed_at = now() where id = v_po_a;
  perform app.pay_due(v_po_a, 'demo-' || v_po_a || '-advance', v_buyer_user);
  perform app.settle(v_po_a, 'demo-' || v_po_a || '-payout-1', null);

  -- 4. Order B, the spec's marketing example (C4): ₹20,000 monthly package
  --    at the studio's 10% MPI rate, ₹50,000 ad budget paid directly.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status, needed_by, budget_max)
  values (v_buyer, v_buyer_user, 'Social media management, 1 month',
          '12 posts and 2 ad campaigns for the snack launch, with 2 rounds of changes. Ad budget ₹50,000, paid directly.',
          v_mkt, 'catalogue', 'open', current_date + 30, 75000)
  returning id into v_req;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_req, (select id from public.catalogue_items where name = 'Social media management'),
          'Monthly social media package: 12 posts, 2 ad campaigns', 1, 'month')
  returning id into v_line;
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_req and vendor_org_id = v_sv;
  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_req, v_sv) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, valid_until, notes)
  values (v_inv, v_req, v_sv, 'draft', 30, current_date + 15, 'Includes 2 rounds of changes. Extra rounds ₹1,000 each, only if you approve them first.')
  returning id into v_q;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order, pass_through) values
    (v_q, v_line, 'item',  'Monthly social media package: 12 posts, 2 ad campaigns, 2 rounds of changes', 1, 20000, 1, false),
    (v_q, null,   'other', 'Ad budget, paid by you directly to the ad platforms', 1, 50000, 2, true);
  update public.quotes set status = 'submitted' where id = v_q;
  update public.quotes set status = 'accepted' where id = v_q;
  update public.requests set status = 'ordered' where id = v_req;
  insert into public.purchase_orders (request_id, quote_id, buyer_org_id, vendor_org_id, total_amount, approved_by, expected_delivery)
  select v_req, q.id, v_buyer, v_sv, q.total, v_buyer_user, current_date + 30 from public.quotes q where q.id = v_q
  returning id into v_po_b;
  update public.purchase_orders set status = 'in_production', status_changed_at = now() where id = v_po_b;
  perform app.pay_due(v_po_b, 'demo-' || v_po_b || '-advance', v_buyer_user);

  -- The admin already handled these two requests.
  delete from public.notifications
   where type = 'matches_to_review'
     and link in (select '/admin/matches/' || po.request_id from public.purchase_orders po where po.id in (v_po_a, v_po_b));

  -- The two earlier demo orders have their advance paid too.
  for v_po in select po.id from public.purchase_orders po
               where po.buyer_org_id = v_buyer and po.id not in (v_po_a, v_po_b) loop
    perform app.pay_due(v_po, 'demo-' || v_po || '-advance', v_buyer_user);
  end loop;

  return v_base || ' Money: sample fee rules and rate cards, 2 more orders that follow the spec''s packaging and '
      || 'marketing examples, advances paid (simulated), 1 payout.';
end;
$$;

revoke execute on function public.reset_demo_workspace() from public, anon;
grant  execute on function public.reset_demo_workspace() to authenticated;

-- Reload the demo now.
select public.reset_demo_workspace();

-- Check: the spec's packaging example. Expect 12602.40 | 11859.00 | 630.00
select r.title,
       s.outputs->'buyer'->>'checkout_total' as buyer_pays,
       s.outputs->'supplier'->>'payout'      as supplier_payout,
       s.outputs->'mpi'->>'revenue'          as mpi_revenue
  from public.order_price_snapshots s
  join public.purchase_orders po on po.id = s.po_id
  join public.requests r on r.id = po.request_id
 order by po.created_at;

-- ============================================================================
-- End of migration
-- ============================================================================
