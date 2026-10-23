-- ============================================================================
-- MPI · Migration 20261023120000 · Supplier matching + price negotiation
--
-- From the advisor meeting (22 Oct):
--   1. When a startup sends a request, the platform suggests matching
--      suppliers (score, reasons, delivery estimate). The admin approves or
--      rejects each suggestion. Approving one invites that supplier to quote.
--      Suppliers can only be invited through an approved match.
--   2. The startup can ask for a lower price on a quote. The supplier accepts,
--      declines or counters, with at most 3 offers per quote. Only the price
--      is negotiated (the startup sets the delivery date in its request).
--      An accepted price becomes a new quote version.
--   2b. Payment terms are set by the admin: full advance, or 30% before
--      work starts and 70% on delivery (default). There is one platform-wide
--      rule, and the admin can override it for a category. Every quote uses
--      the rule for its request's category automatically; suppliers cannot
--      change it.
--   3. Suppliers record their annual turnover band.
--   4. A supplier can only be verified once it has a GSTIN and Udyam number.
--   5. The demo workspace gains matches, a negotiation and a request waiting
--      for the admin to review its matches.
--
-- The matching score is a simple rule-based score for now (category,
-- certifications, delivery date, location, spare capacity). An AI model can
-- replace app.suggest_matches_for() later without changing the tables.
--
-- Run after 20261022130000_demo_workspace.sql. Safe to run once.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. New value lists
-- ----------------------------------------------------------------------------
create type public.match_status       as enum ('suggested', 'approved', 'rejected');
create type public.negotiation_status as enum ('open', 'accepted', 'declined', 'countered', 'withdrawn');
create type public.negotiation_side   as enum ('buyer', 'vendor');


-- ----------------------------------------------------------------------------
-- 2. Supplier details: turnover band, Udyam number format
-- ----------------------------------------------------------------------------
alter table public.vendor_details
  add column turnover_band text
  check (turnover_band in ('under_1_cr', '1_to_5_cr', '5_to_25_cr', '25_to_50_cr', '50_to_250_cr'));

grant update (turnover_band) on public.vendor_details to authenticated;

-- A negotiated price is stored as a discount, so the discount needs more
-- decimal places to land on the agreed rupee amount.
alter table public.quotes alter column discount_pct type numeric(8,5);

alter table public.organisations
  add constraint organisations_udyam_format
  check (udyam_number is null or udyam_number ~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$');


-- ----------------------------------------------------------------------------
-- 3. Tables
-- ----------------------------------------------------------------------------

-- Platform-wide settings, one row. For the MVP this holds the payment terms
-- that apply to every quote.
create table public.platform_settings (
  id            boolean primary key default true check (id),
  payment_terms text not null default '30_70' check (payment_terms in ('full_advance', '30_70')),
  updated_by    uuid references public.profiles (id),
  updated_at    timestamptz not null default now()
);
insert into public.platform_settings default values;

-- Optional per-category payment terms. Empty means the platform rule applies.
alter table public.catalogue_categories
  add column payment_terms text check (payment_terms in ('full_advance', '30_70'));

-- Suppliers suggested for a request, waiting for (or after) the admin's review.
create table public.request_matches (
  id                      uuid primary key default gen_random_uuid(),
  request_id              uuid not null references public.requests (id) on delete cascade,
  vendor_org_id           uuid not null references public.organisations (id) on delete cascade,
  status                  public.match_status not null default 'suggested',
  score                   integer not null default 0 check (score between 0 and 100),
  reasons                 text[] not null default '{}',     -- plain-language reasons for the score
  estimated_delivery_days integer check (estimated_delivery_days is null or estimated_delivery_days >= 0),
  estimated_delivery_date date,
  suggested_by            text not null default 'ai' check (suggested_by in ('ai', 'admin')),
  review_note             text,
  reviewed_by             uuid references public.profiles (id),
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now(),
  unique (request_id, vendor_org_id)
);
create index request_matches_status_idx on public.request_matches (status, created_at);

-- Price negotiation on a quote. One open offer per quote at a time.
create table public.quote_negotiations (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references public.quotes (id) on delete cascade,
  request_id       uuid not null references public.requests (id) on delete cascade,
  buyer_org_id     uuid not null references public.organisations (id) on delete cascade,
  vendor_org_id    uuid not null references public.organisations (id) on delete cascade,
  proposed_by      public.negotiation_side not null,
  proposed_total   numeric(14,2) not null check (proposed_total > 0),   -- including GST
  message          text,
  status           public.negotiation_status not null default 'open',
  response_message text,
  responded_at     timestamptz,
  revised_quote_id uuid references public.quotes (id) on delete set null,  -- the new version, once accepted
  created_by       uuid default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index quote_negotiations_quote_idx on public.quote_negotiations (quote_id);
create unique index quote_negotiations_one_open on public.quote_negotiations (quote_id) where status = 'open';


-- ----------------------------------------------------------------------------
-- 4. Helpers
-- ----------------------------------------------------------------------------

-- Send a notification to every admin.
create function app.notify_admins(p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link from public.profiles p where p.role = 'admin';
$$;

-- Score verified suppliers for a request and store the best 5 as suggestions.
-- Reviewed matches are kept; only unreviewed suggestions are recalculated.
create function app.suggest_matches_for(p_request_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_req      public.requests%rowtype;
  v_demo     boolean;
  v_cat_name text;
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
  select name into v_cat_name from public.catalogue_categories where id = v_req.category_id;

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

    -- Category
    if v_req.category_id is not null then
      v_score := v_score + 40;
      v_reasons := v_reasons || ('Supplies ' || v_cat_name);
    else
      v_score := v_score + 20;
    end if;

    -- Certifications the startup asked for
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

    -- Delivery estimate: the supplier's lead time, plus extra when the
    -- factory is busy, plus transit (1 day same state, 3 days otherwise).
    v_days := coalesce(v_c.lead_time_days, 14)
            + case when coalesce(v_c.capacity_utilisation_pct, 0) >= 80
                   then ceil(coalesce(v_c.lead_time_days, 14) * 0.3)::integer else 0 end
            + case when v_c.state is not distinct from v_req.delivery_state then 1 else 3 end;

    if v_req.needed_by is null then
      v_score := v_score + 15;
      v_reasons := v_reasons || ('Can deliver in about ' || v_days || ' days');
    elsif current_date + v_days <= v_req.needed_by then
      v_score := v_score + 20;
      v_reasons := v_reasons || ('Can deliver in about ' || v_days || ' days, before your date');
    else
      v_reasons := v_reasons || ('May be ' || (current_date + v_days - v_req.needed_by) || ' days late');
    end if;

    -- Location
    if v_req.delivery_city is not null and v_c.city = v_req.delivery_city then
      v_score := v_score + 15;
      v_reasons := v_reasons || ('Based in ' || v_c.city);
    elsif v_req.delivery_state is not null and v_c.state = v_req.delivery_state then
      v_score := v_score + 10;
      v_reasons := v_reasons || ('Based in ' || v_c.state);
    elsif v_c.pan_india_dispatch then
      v_score := v_score + 5;
      v_reasons := v_reasons || 'Ships across India'::text;
    end if;

    -- Spare capacity
    if v_c.capacity_utilisation_pct is null then
      v_score := v_score + 5;
    elsif v_c.capacity_utilisation_pct < 80 then
      v_score := v_score + 10;
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

-- Turn a quote into a new version priced at p_total (including GST).
-- The price change is stored as a discount on the original lines.
create function app.revise_quote_to_total(p_quote_id uuid, p_total numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old   public.quotes%rowtype;
  v_new   uuid;
  v_gross numeric;
  v_pct   numeric;
begin
  select * into v_old from public.quotes where id = p_quote_id;

  select coalesce(sum(line_amount + line_tax), 0) into v_gross
    from public.quote_lines where quote_id = p_quote_id;
  if v_gross <= 0 or p_total > v_gross then
    raise exception 'The new price must be below the original price';
  end if;
  v_pct := round(100 * (1 - p_total / v_gross), 5);

  insert into public.quotes (invitation_id, request_id, vendor_org_id, version, status, currency,
                             lead_time_days, payment_terms, valid_until, notes, created_by)
  select v_old.invitation_id, v_old.request_id, v_old.vendor_org_id,
         (select max(version) + 1 from public.quotes where invitation_id = v_old.invitation_id),
         'draft', v_old.currency, v_old.lead_time_days, v_old.payment_terms, v_old.valid_until,
         'Revised price agreed in negotiation', v_old.created_by
  returning id into v_new;

  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, tax_rate, sort_order)
  select v_new, request_line_id, line_type, description, quantity, unit_price, tax_rate, sort_order
    from public.quote_lines where quote_id = p_quote_id;

  update public.quotes set discount_pct = v_pct, status = 'submitted' where id = v_new;
  return v_new;
end;
$$;

-- Payment terms in words for a category (its own rule, else the platform's),
-- as shown on quotes and orders.
create function app.payment_terms_label(p_category_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case coalesce((select c.payment_terms from public.catalogue_categories c where c.id = p_category_id),
                       s.payment_terms)
           when 'full_advance' then '100% advance before work starts'
           else '30% before work starts, 70% on delivery'
         end
    from public.platform_settings s;
$$;

revoke execute on function app.notify_admins(text, text, text, text) from public;
revoke execute on function app.payment_terms_label(uuid) from public;
revoke execute on function app.suggest_matches_for(uuid) from public;
revoke execute on function app.revise_quote_to_total(uuid, numeric) from public;


-- ----------------------------------------------------------------------------
-- 5. Automatic behaviour
-- ----------------------------------------------------------------------------

-- 5a. When a request is sent (draft -> open, or created open), suggest
--     suppliers and tell the admin there are matches to review.
create function app.after_request_opened() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status = 'draft') then
    v_n := app.suggest_matches_for(new.id);
    perform app.notify_admins('matches_to_review',
      case when v_n > 0 then v_n || ' supplier match(es) to review' else 'No matching suppliers found' end,
      new.title, '/admin/matches/' || new.id);
    perform app.audit('request.matched', 'request', new.id, jsonb_build_object('suggested', v_n));
  end if;
  return new;
end;
$$;

create trigger after_request_opened
  after insert or update of status on public.requests
  for each row execute function app.after_request_opened();

-- 5a2. Every quote carries the payment terms for its request's category.
create function app.set_quote_payment_terms() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.payment_terms := app.payment_terms_label(
    (select r.category_id from public.requests r where r.id = new.request_id));
  return new;
end;
$$;

create trigger set_quote_payment_terms
  before insert on public.quotes
  for each row execute function app.set_quote_payment_terms();

-- Suppliers can no longer edit payment terms on a quote.
revoke update (payment_terms) on public.quotes from authenticated;

-- 5b. Invitations now also need an approved match (replaces the version in
--     the core schema; the earlier rules stay the same).
create or replace function app.check_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_buyer_demo  boolean;
  v_vendor      public.organisations%rowtype;
begin
  select o.is_demo into v_buyer_demo
  from public.requests r join public.organisations o on o.id = r.org_id
  where r.id = new.request_id;

  select * into v_vendor from public.organisations where id = new.vendor_org_id;

  if v_vendor.type <> 'vendor' or v_vendor.verification_status <> 'verified' then
    raise exception 'Only verified suppliers can be invited';
  end if;

  if v_vendor.is_demo <> v_buyer_demo then
    raise exception 'Demo and real organisations cannot be mixed';
  end if;

  if not exists (select 1 from public.request_matches m
                  where m.request_id = new.request_id
                    and m.vendor_org_id = new.vendor_org_id
                    and m.status = 'approved') then
    raise exception 'This supplier has not been approved for this request';
  end if;

  if (select count(*) from public.rfq_invitations where request_id = new.request_id) >= 3 then
    raise exception 'A request can invite at most 3 suppliers';
  end if;

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. Actions the app calls
-- ----------------------------------------------------------------------------

-- 6a. Admin: recalculate suggestions for a request.
create function public.suggest_matches(p_request_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  return app.suggest_matches_for(p_request_id);
end;
$$;

-- 6b. Admin: approve or reject a suggested supplier. Approving invites the
--     supplier to quote (max 3 per request).
create function public.review_match(p_match_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_m     public.request_matches%rowtype;
  v_req   public.requests%rowtype;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;

  select * into v_m from public.request_matches where id = p_match_id for update;
  if v_m.id is null then
    raise exception 'Match not found';
  end if;
  if v_m.status <> 'suggested' then
    raise exception 'This match was already reviewed';
  end if;
  select * into v_req from public.requests where id = v_m.request_id;
  if v_req.status not in ('open', 'comparing') then
    raise exception 'This request is not open';
  end if;

  update public.request_matches
     set status      = case when p_approve then 'approved' else 'rejected' end::public.match_status,
         review_note = p_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = v_m.id;

  if p_approve then
    insert into public.rfq_invitations (request_id, vendor_org_id) values (v_m.request_id, v_m.vendor_org_id);
    perform app.notify_org(v_req.org_id, 'supplier_matched', 'A verified supplier was matched',
                           v_req.title, '/app/requests/' || v_req.id);
  end if;

  perform app.audit(case when p_approve then 'match.approved' else 'match.rejected' end,
                    'request', v_m.request_id,
                    jsonb_build_object('vendor_org_id', v_m.vendor_org_id, 'score', v_m.score, 'note', p_note));
end;
$$;

-- 6c. Startup: ask for a lower price on a quote (total including GST).
create function public.propose_price(p_quote_id uuid, p_total numeric, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_q   public.quotes%rowtype;
  v_req public.requests%rowtype;
  v_id  uuid;
begin
  select * into v_q from public.quotes where id = p_quote_id for update;
  if v_q.id is null then
    raise exception 'Quote not found';
  end if;
  select * into v_req from public.requests where id = v_q.request_id;

  if app.my_role() is distinct from 'startup' or v_req.org_id is distinct from app.my_org_id() then
    raise exception 'Not allowed';
  end if;
  if v_q.status <> 'submitted' or v_req.status not in ('open', 'comparing') then
    raise exception 'This quote can no longer be negotiated';
  end if;
  if p_total is null or p_total <= 0 or p_total >= v_q.total then
    raise exception 'Your price must be below the quoted total';
  end if;
  if exists (select 1 from public.quote_negotiations where quote_id = v_q.id and status = 'open') then
    raise exception 'There is already an open offer on this quote';
  end if;
  if (select count(*) from public.quote_negotiations where quote_id = v_q.id) >= 3 then
    raise exception 'No offers left (3 per quote). Accept or decline the last offer';
  end if;

  insert into public.quote_negotiations (quote_id, request_id, buyer_org_id, vendor_org_id, proposed_by, proposed_total, message)
  values (v_q.id, v_req.id, v_req.org_id, v_q.vendor_org_id, 'buyer', round(p_total, 2), p_message)
  returning id into v_id;

  perform app.notify_org(v_q.vendor_org_id, 'price_proposed', 'The buyer asked for a better price',
                         v_req.title, '/vendor/quotes');
  perform app.audit('negotiation.proposed', 'quote', v_q.id, jsonb_build_object('total', p_total));
  return v_id;
end;
$$;

-- 6d. Reply to an open offer. The other side can accept, decline or counter
--     (p_counter_total). Whoever made the offer can withdraw it.
--     Accepting creates a new quote version at the agreed price.
create function public.respond_to_price(p_negotiation_id uuid, p_response text,
                                        p_counter_total numeric default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_n       public.quote_negotiations%rowtype;
  v_q       public.quotes%rowtype;
  v_req     public.requests%rowtype;
  v_my_side public.negotiation_side;
  v_new     uuid;
  v_other   uuid;
begin
  select * into v_n from public.quote_negotiations where id = p_negotiation_id for update;
  if v_n.id is null then
    raise exception 'Offer not found';
  end if;
  select * into v_q   from public.quotes   where id = v_n.quote_id;
  select * into v_req from public.requests where id = v_n.request_id;

  v_my_side := case
    when app.my_org_id() = v_n.buyer_org_id  and app.my_role() = 'startup' then 'buyer'
    when app.my_org_id() = v_n.vendor_org_id and app.my_role() = 'vendor'  then 'vendor'
  end::public.negotiation_side;

  if v_my_side is null then
    raise exception 'Not allowed';
  end if;
  if v_n.status <> 'open' then
    raise exception 'This offer is closed';
  end if;
  if v_q.status <> 'submitted' or v_req.status not in ('open', 'comparing') then
    raise exception 'This quote can no longer be negotiated';
  end if;

  if p_response = 'withdraw' then
    if v_my_side <> v_n.proposed_by then
      raise exception 'Only the side that made the offer can withdraw it';
    end if;
  elsif p_response in ('accept', 'decline', 'counter') then
    if v_my_side = v_n.proposed_by then
      raise exception 'Wait for the other side to reply';
    end if;
  else
    raise exception 'Response must be accept, decline, counter or withdraw';
  end if;

  v_other := case when v_my_side = 'buyer' then v_n.vendor_org_id else v_n.buyer_org_id end;

  if p_response = 'accept' then
    v_new := app.revise_quote_to_total(v_q.id, v_n.proposed_total);
    update public.quote_negotiations
       set status = 'accepted', response_message = p_message, responded_at = now(), revised_quote_id = v_new
     where id = v_n.id;
    perform app.notify_org(v_other, 'price_accepted', 'Price agreed: ₹' || v_n.proposed_total, v_req.title,
                           case when v_my_side = 'buyer' then '/vendor/quotes' else '/app/requests/' || v_req.id end);

  elsif p_response = 'decline' or p_response = 'withdraw' then
    update public.quote_negotiations
       set status = case when p_response = 'decline' then 'declined' else 'withdrawn' end::public.negotiation_status,
           response_message = p_message, responded_at = now()
     where id = v_n.id;
    perform app.notify_org(v_other, case when p_response = 'decline' then 'price_declined' else 'price_withdrawn' end,
                           case when p_response = 'decline' then 'Price offer declined' else 'Price offer withdrawn' end,
                           v_req.title,
                           case when v_my_side = 'buyer' then '/vendor/quotes' else '/app/requests/' || v_req.id end);

  else  -- counter
    if p_counter_total is null or p_counter_total <= 0 or p_counter_total >= v_q.total
       or p_counter_total = v_n.proposed_total then
      raise exception 'The counter-offer must be below the quoted total and different from the last offer';
    end if;
    if (select count(*) from public.quote_negotiations where quote_id = v_q.id) >= 3 then
      raise exception 'No offers left (3 per quote). Accept or decline the last offer';
    end if;
    update public.quote_negotiations
       set status = 'countered', response_message = p_message, responded_at = now()
     where id = v_n.id;
    insert into public.quote_negotiations (quote_id, request_id, buyer_org_id, vendor_org_id, proposed_by, proposed_total, message)
    values (v_q.id, v_req.id, v_n.buyer_org_id, v_n.vendor_org_id, v_my_side, round(p_counter_total, 2), p_message)
    returning id into v_new;
    perform app.notify_org(v_other, 'price_countered', 'Counter-offer: ₹' || round(p_counter_total, 2), v_req.title,
                           case when v_my_side = 'buyer' then '/vendor/quotes' else '/app/requests/' || v_req.id end);
  end if;

  perform app.audit('negotiation.' || p_response, 'quote', v_q.id,
                    jsonb_build_object('negotiation_id', v_n.id, 'total', coalesce(p_counter_total, v_n.proposed_total)));
  return v_new;  -- new quote id (accept), new offer id (counter), otherwise null
end;
$$;

-- 6e. Verification now needs GSTIN and Udyam number (replaces the core version).
create or replace function public.set_vendor_verification(p_org_id uuid, p_status public.verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_status = 'not_required' then
    raise exception 'Invalid status for a supplier';
  end if;
  if p_status = 'verified' and exists (
       select 1 from public.organisations
        where id = p_org_id and (gstin is null or udyam_number is null)) then
    raise exception 'Add the GSTIN and Udyam number before verifying this supplier';
  end if;

  update public.organisations
     set verification_status = p_status,
         verification_note   = p_note,
         verified_at         = case when p_status = 'verified' then now() else verified_at end,
         verified_by         = case when p_status = 'verified' then auth.uid() else verified_by end
   where id = p_org_id and type = 'vendor';
  if not found then
    raise exception 'Supplier not found';
  end if;

  perform app.notify_org(p_org_id, 'verification_' || p_status::text,
                         'Verification status: ' || replace(p_status::text, '_', ' '), p_note, '/vendor/profile');
  perform app.audit('vendor.verification', 'organisation', p_org_id,
                    jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

-- 6f. Admin: choose payment terms ('full_advance' or '30_70').
--     Without a category: the platform rule. With a category: that
--     category's rule, and p_terms null clears it back to the platform rule.
--     Applies to quotes sent from now on.
create function public.set_payment_terms(p_terms text, p_category_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_terms is not null and p_terms not in ('full_advance', '30_70') then
    raise exception 'Payment terms must be full_advance or 30_70';
  end if;

  if p_category_id is null then
    if p_terms is null then
      raise exception 'Choose payment terms for the platform';
    end if;
    update public.platform_settings set payment_terms = p_terms, updated_by = auth.uid(), updated_at = now();
  else
    update public.catalogue_categories set payment_terms = p_terms where id = p_category_id;
    if not found then
      raise exception 'Category not found';
    end if;
  end if;

  perform app.audit('settings.payment_terms', 'catalogue_category', p_category_id,
                    jsonb_build_object('payment_terms', p_terms, 'category_id', p_category_id));
end;
$$;

revoke execute on function public.set_payment_terms(text, uuid) from public, anon;
grant  execute on function public.set_payment_terms(text, uuid) to authenticated;
revoke execute on function public.suggest_matches(uuid) from public, anon;
revoke execute on function public.review_match(uuid, boolean, text) from public, anon;
revoke execute on function public.propose_price(uuid, numeric, text) from public, anon;
revoke execute on function public.respond_to_price(uuid, text, numeric, text) from public, anon;
grant  execute on function public.suggest_matches(uuid) to authenticated;
grant  execute on function public.review_match(uuid, boolean, text) to authenticated;
grant  execute on function public.propose_price(uuid, numeric, text) to authenticated;
grant  execute on function public.respond_to_price(uuid, text, numeric, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Access
-- ----------------------------------------------------------------------------
grant select on public.request_matches, public.quote_negotiations, public.platform_settings to authenticated;
grant insert (request_id, vendor_org_id, score, reasons, estimated_delivery_days, estimated_delivery_date, suggested_by)
  on public.request_matches to authenticated;

alter table public.request_matches    enable row level security;
alter table public.quote_negotiations enable row level security;
alter table public.platform_settings  enable row level security;

-- Settings: every signed-in user can read them; only set_payment_terms() changes them.
create policy ps_select on public.platform_settings for select to authenticated using (true);

-- Matches: admin sees all and can add one by hand; the startup sees only the
-- approved ones on its own requests. Suppliers never see matches.
create policy rm_select on public.request_matches for select to authenticated using (
  (select app.is_admin())
  or (status = 'approved' and app.owns_request(request_id))
);
create policy rm_admin_insert on public.request_matches for insert to authenticated
  with check ((select app.is_admin()) and suggested_by = 'admin');

-- Negotiations: the two sides and admin. Changed only through the functions above.
create policy qn_select on public.quote_negotiations for select to authenticated using (
  buyer_org_id = (select app.my_org_id())
  or vendor_org_id = (select app.my_org_id())
  or (select app.is_admin())
);

-- Supplier directory gains the turnover band (added at the end of the view).
create or replace view public.supplier_directory with (security_barrier) as
select o.id,
       o.display_name,
       o.city,
       o.state,
       o.verified_at,
       vd.enterprise_type,
       vd.certifications,
       vd.machinery,
       vd.monthly_capacity,
       vd.moq,
       vd.lead_time_days,
       vd.quality_testing_facilities,
       vd.pan_india_dispatch,
       coalesce(array(select vc.category_id from public.vendor_categories vc
                       where vc.vendor_org_id = o.id), '{}') as category_ids,
       vd.turnover_band
  from public.organisations o
  left join public.vendor_details vd on vd.org_id = o.id
 where o.type = 'vendor'
   and o.verification_status = 'verified'
   and auth.uid() is not null
   and app.my_role() in ('startup', 'admin')
   and (o.is_demo = coalesce(app.my_org_is_demo(), false) or app.is_admin());


-- ----------------------------------------------------------------------------
-- 8. Demo workspace, updated for matching and negotiation
-- ----------------------------------------------------------------------------
create or replace function public.reset_demo_workspace() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_emails  constant text[] := array[
    'mpi-demostartup@example.com',
    'mpi-demosupplier1@example.com',
    'mpi-demosupplier2@example.com',
    'mpi-demosupplier3@example.com'
  ];
  v_missing text[];
  v_buyer   uuid;  v_buyer_user uuid;
  v_s1      uuid;  v_s2 uuid;  v_s3 uuid;
  v_s1_user uuid;  v_s3_user uuid;
  v_pack    uuid;  v_proto uuid;
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_r5 uuid;
  v_inv uuid; v_q uuid; v_q1 uuid; v_q3 uuid; v_q_win uuid; v_q_lose uuid;
  v_line uuid;
  v_new uuid;
  v_demo_orgs uuid[];
begin
  -- Through the app (API connections log in as 'authenticator') only the
  -- admin may reset. Running it in the Supabase SQL Editor is also allowed.
  if session_user = 'authenticator' and not app.is_admin() then
    raise exception 'Not allowed';
  end if;

  select array_agg(e) into v_missing
    from unnest(v_emails) e
   where not exists (select 1 from public.profiles p where p.email = e);
  if v_missing is not null then
    raise exception 'Create these users first (Authentication -> Users -> Add user): %',
      array_to_string(v_missing, ', ');
  end if;

  select array_agg(org_id) into v_demo_orgs
    from public.profiles where email = any (v_emails);

  -- 1. Clear the old demo data. Orders first, because they protect their
  --    request and quote from deletion.
  delete from public.notifications
   where type = 'matches_to_review'
     and link in (select '/admin/matches/' || r.id from public.requests r where r.org_id = any (v_demo_orgs));
  delete from public.purchase_orders
   where buyer_org_id = any (v_demo_orgs) or vendor_org_id = any (v_demo_orgs);
  delete from public.requests where org_id = any (v_demo_orgs);   -- lines, matches, invitations, quotes, offers go with it
  delete from public.notifications
   where user_id in (select id from public.profiles where org_id = any (v_demo_orgs));
  delete from public.vendor_categories where vendor_org_id = any (v_demo_orgs);

  -- 2. The demo startup.
  select id, org_id into v_buyer_user, v_buyer from public.profiles where email = v_emails[1];
  update public.profiles set role = 'startup', full_name = 'Riya Menon (demo)' where id = v_buyer_user;
  update public.organisations
     set name = 'Demo · Kettle & Crumb Foods', type = 'startup', is_demo = true,
         city = 'Bengaluru', state = 'Karnataka', verification_status = 'not_required',
         display_name = case when display_name like 'MPI Verified Buyer #%' then display_name
                             else 'MPI Verified Buyer #' || lpad(nextval('public.buyer_code_seq')::text, 3, '0') end
   where id = v_buyer;
  delete from public.vendor_details where org_id = v_buyer;
  insert into public.startup_details (org_id) values (v_buyer) on conflict (org_id) do nothing;
  update public.startup_details
     set stage = 'early_revenue', industry = 'D2C packaged snacks', products_sold = 'Baked millet snacks',
         team_size = '11-25', funding_stage = 'seed', has_dpiit = true, dpiit_number = 'DIPP000000',
         annual_procurement_budget = 1800000, turnaround_priority = 'standard',
         interest_category_ids = array(select id from public.catalogue_categories
                                        where slug in ('packaging-and-printing', 'prototyping-and-product-development')),
         procurement_description = 'Retail and e-commerce packaging, labels, and a countertop dispenser prototype.'
   where org_id = v_buyer;

  -- 3. The three demo suppliers (accounts made in the dashboard start as
  --    startups, so they are converted here). GSTIN and Udyam numbers are
  --    sample values in the right format.
  select id, org_id into v_s1_user, v_s1 from public.profiles where email = v_emails[2];
  select org_id into v_s2 from public.profiles where email = v_emails[3];
  select id, org_id into v_s3_user, v_s3 from public.profiles where email = v_emails[4];

  update public.profiles set role = 'vendor' where org_id in (v_s1, v_s2, v_s3);
  update public.profiles set full_name = 'Suresh Rao (demo)'   where email = v_emails[2];
  update public.profiles set full_name = 'Neha Kulkarni (demo)' where email = v_emails[3];
  update public.profiles set full_name = 'Imran Shaikh (demo)'  where email = v_emails[4];

  update public.organisations o
     set type = 'vendor', is_demo = true, verification_status = 'verified',
         verified_at = coalesce(o.verified_at, now()), verification_note = null,
         display_name = case when o.display_name like 'MPI Verified Supplier #%' then o.display_name
                             else 'MPI Verified Supplier #' || lpad(nextval('public.supplier_code_seq')::text, 3, '0') end,
         name = v.name, city = v.city, state = v.state, gstin = v.gstin, udyam_number = v.udyam
    from (values
      (v_s1, 'Demo · Shree Balaji Packaging', 'Bengaluru', 'Karnataka',   '29DEMO0000001Z1', 'UDYAM-KA-00-0000001'),
      (v_s2, 'Demo · Deccan Proto Works',     'Pune',      'Maharashtra', '27DEMO0000002Z2', 'UDYAM-MH-00-0000002'),
      (v_s3, 'Demo · Sabarmati Print & Pack', 'Ahmedabad', 'Gujarat',     '24DEMO0000003Z3', 'UDYAM-GJ-00-0000003')
    ) as v (org_id, name, city, state, gstin, udyam)
   where o.id = v.org_id;

  delete from public.startup_details where org_id in (v_s1, v_s2, v_s3);
  insert into public.vendor_details (org_id) values (v_s1), (v_s2), (v_s3) on conflict (org_id) do nothing;
  update public.vendor_details d
     set enterprise_type = v.size::public.enterprise_size, machinery = v.machinery,
         monthly_capacity = v.capacity, capacity_utilisation_pct = v.util,
         certifications = v.certs, moq = v.moq, payment_terms = v.terms,
         quality_testing_facilities = v.qa, lead_time_days = v.lead, pan_india_dispatch = v.pan_india,
         turnover_band = v.turnover
    from (values
      (v_s1, 'small', array['3-ply corrugator', 'Flexo printer', 'Die-cutter'], '4 lakh boxes', 70,
             array['ISO 9001'], 1000::numeric, '30% before work starts, 70% on delivery', array['Burst strength tester'], 12, true, '5_to_25_cr'),
      (v_s2, 'micro', array['FDM 3D printers (x4)', 'SLA printer', 'CNC router'], '300 prototype parts', 55,
             array[]::text[], 1::numeric, '30% before work starts, 70% on delivery', array['Vernier and gauge set'], 7, true, '1_to_5_cr'),
      (v_s3, 'small', array['Offset press', 'Label rewinder', 'Lamination line'], '15 lakh labels', 65,
             array['ISO 9001', 'ZED Bronze'], 5000::numeric, '30% before work starts, 70% on delivery', array['Colour matching booth'], 10, false, '5_to_25_cr')
    ) as v (org_id, size, machinery, capacity, util, certs, moq, terms, qa, lead, pan_india, turnover)
   where d.org_id = v.org_id;

  select id into v_pack  from public.catalogue_categories where slug = 'packaging-and-printing';
  select id into v_proto from public.catalogue_categories where slug = 'prototyping-and-product-development';
  insert into public.vendor_categories (vendor_org_id, category_id) values
    (v_s1, v_pack), (v_s2, v_proto), (v_s3, v_pack);

  -- Each request below is created "open", so suppliers are suggested for it
  -- automatically. The demo approves the ones it invites, as the admin would.

  -- 4. Request 1: mailer boxes, two quotes in, startup is comparing and
  --    negotiating. Supplier #1 agreed a lower price (quote version 2),
  --    supplier #3 has an offer waiting for an answer.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, delivery_city, delivery_state, budget_max, requirement_text, input_language)
  values (v_buyer, v_buyer_user, 'Printed mailer boxes, 2,000 pcs',
          '3-ply kraft mailer, 2-colour print outside, size 250 x 180 x 80 mm.',
          v_pack, 'ai_assisted', 'open', current_date + 21, 'Bengaluru', 'Karnataka', 48000,
          'Humein 2000 printed mailer boxes chahiye, kraft, 2 colour, Bengaluru delivery in 3 weeks', 'hi')
  returning id into v_r1;
  insert into public.request_lines (request_id, item_id, description, quantity, unit, specs)
  values (v_r1, (select id from public.catalogue_items where name = 'Corrugated boxes'),
          'Kraft mailer box, 3-ply, 2-colour print', 2000, 'pcs',
          '{"size_mm": "250 x 180 x 80", "board": "3-ply kraft", "print": "2 colour"}')
  returning id into v_line;
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_r1 and vendor_org_id in (v_s1, v_s3);

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r1, v_s1) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until, discount_pct)
  values (v_inv, v_r1, v_s1, 'draft', 12, '30% before work starts, 70% on delivery', current_date + 15, 2.5) returning id into v_q1;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order) values
    (v_q1, v_line, 'item',  'Kraft mailer box, 3-ply, 2-colour print', 2000, 19.50, 1),
    (v_q1, null,   'setup', 'Printing plates and die', 1, 4500, 2);
  update public.quotes set status = 'submitted' where id = v_q1;

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r1, v_s3) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
  values (v_inv, v_r1, v_s3, 'draft', 10, '30% before work starts, 70% on delivery', current_date + 10) returning id into v_q3;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order) values
    (v_q3, v_line, 'item',      'Kraft mailer box, 3-ply, 2-colour print', 2000, 21.00, 1),
    (v_q3, null,   'logistics', 'Delivery to Bengaluru', 1, 2200, 2);
  update public.quotes set status = 'submitted' where id = v_q3;
  update public.requests set status = 'comparing' where id = v_r1;

  -- Negotiation with supplier #1: startup asked for ₹46,000, supplier
  -- countered ₹47,500, startup accepted.
  insert into public.quote_negotiations (quote_id, request_id, buyer_org_id, vendor_org_id, proposed_by,
                                         proposed_total, message, status, response_message, responded_at, created_by)
  values (v_q1, v_r1, v_buyer, v_s1, 'buyer', 46000, 'Our budget is ₹48,000 including GST. Can you do ₹46,000?',
          'countered', 'Board prices are up this month. Best we can do is ₹47,500.', now(), v_buyer_user);
  v_new := app.revise_quote_to_total(v_q1, 47500);
  insert into public.quote_negotiations (quote_id, request_id, buyer_org_id, vendor_org_id, proposed_by,
                                         proposed_total, message, status, response_message, responded_at,
                                         revised_quote_id, created_by)
  values (v_q1, v_r1, v_buyer, v_s1, 'vendor', 47500, 'Best we can do is ₹47,500.',
          'accepted', 'Agreed.', now(), v_new, v_s1_user);

  -- Negotiation with supplier #3: offer waiting for the supplier.
  insert into public.quote_negotiations (quote_id, request_id, buyer_org_id, vendor_org_id, proposed_by,
                                         proposed_total, message, created_by)
  values (v_q3, v_r1, v_buyer, v_s3, 'buyer', 48000, 'Our budget is ₹48,000 including GST. Can you match it?', v_buyer_user);
  perform app.notify_org(v_s3, 'price_proposed', 'The buyer asked for a better price', 'Printed mailer boxes, 2,000 pcs', '/vendor/quotes');

  -- 5. Request 2: product labels, approved, order in production.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, delivery_city, delivery_state, budget_max)
  values (v_buyer, v_buyer_user, 'Product labels, 10,000 pcs',
          'Matte BOPP labels, 60 x 40 mm, 4-colour, on rolls.',
          v_pack, 'catalogue', 'open', current_date + 14, 'Bengaluru', 'Karnataka', 12000)
  returning id into v_r2;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r2, (select id from public.catalogue_items where name = 'Product labels'),
          'Matte BOPP label, 60 x 40 mm, 4-colour', 10000, 'pcs')
  returning id into v_line;
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_r2 and vendor_org_id in (v_s1, v_s3);

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r2, v_s3) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
  values (v_inv, v_r2, v_s3, 'draft', 8, '30% before work starts, 70% on delivery', current_date + 10) returning id into v_q_win;
  insert into public.quote_lines (quote_id, request_line_id, description, quantity, unit_price)
  values (v_q_win, v_line, 'Matte BOPP label, 60 x 40 mm, 4-colour', 10000, 0.95);
  update public.quotes set status = 'submitted' where id = v_q_win;

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r2, v_s1) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
  values (v_inv, v_r2, v_s1, 'draft', 12, '30% before work starts, 70% on delivery', current_date + 15) returning id into v_q_lose;
  insert into public.quote_lines (quote_id, request_line_id, description, quantity, unit_price)
  values (v_q_lose, v_line, 'Matte BOPP label, 60 x 40 mm, 4-colour', 10000, 1.10);
  update public.quotes set status = 'submitted' where id = v_q_lose;

  -- Approval, done here directly because approve_quote() needs a signed-in startup.
  update public.quotes set status = 'accepted' where id = v_q_win;
  update public.quotes set status = 'rejected' where id = v_q_lose;
  update public.requests set status = 'ordered' where id = v_r2;
  insert into public.purchase_orders (request_id, quote_id, buyer_org_id, vendor_org_id, total_amount,
                                      approved_by, status, expected_delivery)
  select v_r2, q.id, v_buyer, v_s3, q.total, v_buyer_user, 'in_production', current_date + 8
    from public.quotes q where q.id = v_q_win;
  perform app.notify_org(v_s3, 'quote_accepted', 'Your quote was accepted', 'Product labels, 10,000 pcs', '/vendor/quotes');
  perform app.notify_org(v_s1, 'quote_not_selected', 'Quote not selected', 'Product labels, 10,000 pcs', '/vendor/quotes');

  -- 6. Request 3: dispenser prototype, supplier has opened it, no quote yet.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, delivery_city, delivery_state, budget_max)
  values (v_buyer, v_buyer_user, 'Countertop snack dispenser prototype, 5 units',
          '3D-printed PETG body, 1.5 L hopper, gravity feed. Fit-and-finish prototype for retail trials.',
          v_proto, 'catalogue', 'open', current_date + 30, 'Bengaluru', 'Karnataka', 25000)
  returning id into v_r3;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r3, (select id from public.catalogue_items where name = 'Rapid prototyping'),
          'Snack dispenser prototype, PETG', 5, 'units');
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_r3 and vendor_org_id = v_s2;
  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r3, v_s2) returning id into v_inv;
  update public.rfq_invitations set status = 'viewed', responded_at = now() where id = v_inv;

  -- The admin already handled requests 1 to 3, so clear their review alerts.
  delete from public.notifications
   where type = 'matches_to_review'
     and link in ('/admin/matches/' || v_r1, '/admin/matches/' || v_r2, '/admin/matches/' || v_r3);

  -- 7. Request 4: a draft the startup has not sent yet.
  insert into public.requests (org_id, created_by, title, category_id, source, status, delivery_city, delivery_state)
  values (v_buyer, v_buyer_user, 'Tamper-evident seals, 5,000 pcs', v_pack, 'catalogue', 'draft', 'Bengaluru', 'Karnataka')
  returning id into v_r4;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r4, (select id from public.catalogue_items where name = 'Tamper-evident seals'),
          'Void tamper-evident seal, 25 mm round', 5000, 'pcs');

  -- 8. Request 5: just sent. Suppliers are suggested and wait for the admin.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, delivery_city, delivery_state, budget_max, required_certifications)
  values (v_buyer, v_buyer_user, 'Stand-up zip pouches, 3,000 pcs',
          'Food-grade stand-up pouch with zip lock, 150 x 220 mm, matte finish, 4-colour print.',
          v_pack, 'catalogue', 'open', current_date + 25, 'Bengaluru', 'Karnataka', 30000, array['ISO 9001'])
  returning id into v_r5;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r5, (select id from public.catalogue_items where name = 'Pouches and sachets'),
          'Stand-up zip pouch, food grade, 150 x 220 mm', 3000, 'pcs');

  perform app.audit('demo.reset', 'organisation', v_buyer, jsonb_build_object('orgs', v_demo_orgs));
  return 'Demo workspace ready: 1 startup, 3 suppliers, 5 requests, 5 quotes (one revised after negotiation), '
      || '1 open price offer, 1 order, 1 request waiting for match review.';
end;
$$;

revoke execute on function public.reset_demo_workspace() from public, anon;
grant  execute on function public.reset_demo_workspace() to authenticated;

-- Reload the demo now.
select public.reset_demo_workspace();

-- Check: matches per demo request.
select r.title, r.status,
       count(m.*) filter (where m.status = 'suggested') as waiting_for_admin,
       count(m.*) filter (where m.status = 'approved')  as approved,
       (select count(*) from public.quote_negotiations n where n.request_id = r.id) as price_offers
  from public.requests r
  join public.organisations o on o.id = r.org_id and o.is_demo
  left join public.request_matches m on m.request_id = r.id
 group by r.id, r.title, r.status, r.created_at
 order by r.title;

-- ============================================================================
-- End of migration
-- ============================================================================
