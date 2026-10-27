-- ============================================================================
-- MPI · Migration 20261027120000 · Remote services, demo services, offer expiry
--
--   1. Price offers expire after 24 hours (client decision, 27 Oct). An offer
--      with no reply in time becomes "expired" and both sides are told. An
--      expired offer still counts toward the 3 offers per quote. The quote
--      itself stays as it was, so the startup can still accept it at its
--      current price or make another offer if it has one left.
--      A scheduled job marks expired offers every 15 minutes, and the
--      negotiation actions also check the time, so nobody can answer late.
--   2. Remote requests (services with no delivery city or state, for example
--      a website) no longer lose points for location in matching, and their
--      delivery estimate has no shipping days.
--   3. The demo workspace gains a service supplier (IT and marketing) and two
--      service requests: a website with a quote waiting (ready to negotiate
--      live in the demo) and a logo project already in progress.
--
-- Before running: create one more demo user in Supabase
-- (Authentication -> Users -> Add user, tick "Auto Confirm User"):
--   mpi-demoservice@example.com     demo service supplier
--
-- Run after 20261023120000_matching_negotiation.sql. Safe to run again.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Offers expire after 24 hours
-- ----------------------------------------------------------------------------
alter type public.negotiation_status add value if not exists 'expired';

alter table public.quote_negotiations add column if not exists expires_at timestamptz;
update public.quote_negotiations set expires_at = created_at + interval '24 hours' where expires_at is null;
alter table public.quote_negotiations
  alter column expires_at set default now() + interval '24 hours',
  alter column expires_at set not null;

create index if not exists quote_negotiations_open_expiry
  on public.quote_negotiations (expires_at) where status = 'open';

-- Mark open offers past their time as expired and tell both sides.
-- With a quote id, only that quote's offers; without, all of them.
-- Returns how many offers expired.
create or replace function app.expire_offers(p_quote_id uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n     record;
  v_title text;
  v_count integer := 0;
begin
  for v_n in
    update public.quote_negotiations
       set status = 'expired', responded_at = now(), response_message = 'No reply within 24 hours'
     where status = 'open'
       and expires_at <= now()
       and (p_quote_id is null or quote_id = p_quote_id)
    returning id, quote_id, request_id, buyer_org_id, vendor_org_id, proposed_by, proposed_total
  loop
    v_count := v_count + 1;
    select title into v_title from public.requests where id = v_n.request_id;

    perform app.notify_org(v_n.buyer_org_id, 'price_expired',
      case when v_n.proposed_by = 'buyer'
           then 'Your offer of ₹' || v_n.proposed_total || ' expired with no reply'
           else 'The offer of ₹' || v_n.proposed_total || ' expired before you replied' end,
      v_title, '/app/requests/' || v_n.request_id);
    perform app.notify_org(v_n.vendor_org_id, 'price_expired',
      case when v_n.proposed_by = 'vendor'
           then 'Your offer of ₹' || v_n.proposed_total || ' expired with no reply'
           else 'The offer of ₹' || v_n.proposed_total || ' expired before you replied' end,
      v_title, '/vendor/quotes');
    perform app.audit('negotiation.expired', 'quote', v_n.quote_id,
                      jsonb_build_object('negotiation_id', v_n.id, 'total', v_n.proposed_total));
  end loop;
  return v_count;
end;
$$;

revoke execute on function app.expire_offers(uuid) from public;

-- Startup: ask for a lower price (replaces the earlier version). Expired
-- offers on this quote are closed first, so they don't block a new one.
create or replace function public.propose_price(p_quote_id uuid, p_total numeric, p_message text default null)
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

  perform app.expire_offers(v_q.id);

  if exists (select 1 from public.quote_negotiations where quote_id = v_q.id and status = 'open') then
    raise exception 'There is already an open offer on this quote';
  end if;
  if (select count(*) from public.quote_negotiations where quote_id = v_q.id) >= 3 then
    raise exception 'No offers left (3 per quote). You can still accept the quote at its current price';
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

-- Reply to an open offer (replaces the earlier version). Same rules as
-- before, plus: an offer past its 24 hours can no longer be answered.
create or replace function public.respond_to_price(p_negotiation_id uuid, p_response text,
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
  if v_n.status = 'open' and v_n.expires_at <= now() then
    raise exception 'This offer expired after 24 hours with no reply';
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

-- Check for expired offers every 15 minutes (pg_cron is built into Supabase).
-- Running this file again just updates the same job.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mpi-expire-price-offers', '*/15 * * * *', 'select app.expire_offers()');
  else
    raise notice 'pg_cron is not available here, so offers are only expired when someone negotiates. On Supabase, turn on Cron under Integrations and run this file again.';
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. Matching for remote services (replaces the earlier version)
--    A request is remote when it is for a service (or has no category) and
--    has no delivery city or state. Remote work has no shipping days, and
--    suppliers who work anywhere in India score full location points.
--    (For service suppliers, "ships across India" means "works remotely
--    anywhere in India".)
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

    -- Delivery estimate: the supplier's lead time, plus extra when it is
    -- busy, plus transit (none for remote work, 1 day same state, else 3).
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

    -- Location
    if v_remote then
      if v_c.pan_india_dispatch then
        v_score := v_score + 15;
        v_reasons := v_reasons || 'Works remotely, anywhere in India'::text;
      else
        v_score := v_score + 5;
        v_reasons := v_reasons || ('Works mainly in ' || coalesce(v_c.city, v_c.state, 'its own city'));
      end if;
    elsif v_req.delivery_city is not null and v_c.city = v_req.delivery_city then
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


-- ----------------------------------------------------------------------------
-- 3. Demo workspace with a service supplier (replaces the earlier version)
-- ----------------------------------------------------------------------------
create or replace function public.reset_demo_workspace() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_emails  constant text[] := array[
    'mpi-demostartup@example.com',
    'mpi-demosupplier1@example.com',
    'mpi-demosupplier2@example.com',
    'mpi-demosupplier3@example.com',
    'mpi-demoservice@example.com'
  ];
  v_missing text[];
  v_buyer   uuid;  v_buyer_user uuid;
  v_s1      uuid;  v_s2 uuid;  v_s3 uuid;
  v_s1_user uuid;  v_s3_user uuid;
  v_sv      uuid;  v_sv_user uuid;
  v_pack    uuid;  v_proto uuid;  v_it uuid;  v_mkt uuid;
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_r5 uuid; v_r6 uuid; v_r7 uuid;
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

  -- 3b. The demo service supplier: a small studio that builds websites and
  --     does branding, working remotely. For service suppliers the same
  --     fields mean: machinery = skills and tools, monthly capacity =
  --     projects per month, lead time = usual delivery time, ships across
  --     India = works remotely anywhere in India.
  select id, org_id into v_sv_user, v_sv from public.profiles where email = v_emails[5];
  update public.profiles set role = 'vendor', full_name = 'Ananya Pillai (demo)' where id = v_sv_user;
  update public.organisations o
     set type = 'vendor', is_demo = true, verification_status = 'verified',
         verified_at = coalesce(o.verified_at, now()), verification_note = null,
         display_name = case when o.display_name like 'MPI Verified Supplier #%' then o.display_name
                             else 'MPI Verified Supplier #' || lpad(nextval('public.supplier_code_seq')::text, 3, '0') end,
         name = 'Demo · Backwater Digital Studio', city = 'Kochi', state = 'Kerala',
         gstin = '32DEMO0000005Z5', udyam_number = 'UDYAM-KL-00-0000005'
   where o.id = v_sv;
  delete from public.startup_details where org_id = v_sv;
  insert into public.vendor_details (org_id) values (v_sv) on conflict (org_id) do nothing;
  update public.vendor_details
     set enterprise_type = 'micro',
         machinery = array['Website design and build', 'Shopify stores', 'Logo and brand identity', 'Figma'],
         monthly_capacity = '6 projects', capacity_utilisation_pct = 50,
         certifications = '{}', moq = null, payment_terms = '30% before work starts, 70% on delivery',
         quality_testing_facilities = array['Testing on phones and browsers', '2 rounds of changes'],
         lead_time_days = 14, pan_india_dispatch = true, turnover_band = '1_to_5_cr'
   where org_id = v_sv;

  select id into v_it  from public.catalogue_categories where slug = 'it-and-digital-services';
  select id into v_mkt from public.catalogue_categories where slug = 'marketing-and-sales-support';
  insert into public.vendor_categories (vendor_org_id, category_id) values (v_sv, v_it), (v_sv, v_mkt);
  update public.startup_details
     set interest_category_ids = interest_category_ids || array[v_it, v_mkt]
   where org_id = v_buyer;

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

  -- 9. Request 6: a website, worked on remotely (no delivery city). The
  --    service supplier has quoted; no offers yet, so the price can be
  --    negotiated live in the demo.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, budget_max, requirement_text, input_language)
  values (v_buyer, v_buyer_user, 'Company website, 5 pages',
          'Simple website for Kettle & Crumb: home, products, about, contact and a store locator. Works well on phones.',
          v_it, 'ai_assisted', 'open', current_date + 30, 60000,
          'Humein ek simple company website chahiye, 5 pages, mobile pe achha dikhe, ek mahine mein', 'hi')
  returning id into v_r6;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r6, (select id from public.catalogue_items where name = 'Website development'),
          'Company website, 5 pages, mobile friendly', 1, 'project')
  returning id into v_line;
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_r6 and vendor_org_id = v_sv;

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r6, v_sv) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, valid_until, notes)
  values (v_inv, v_r6, v_sv, 'draft', 21, current_date + 15, 'Includes 2 rounds of changes and 1 month of support.')
  returning id into v_q;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order) values
    (v_q, v_line, 'item',  'Website design and build, 5 pages', 1, 42000, 1),
    (v_q, null,   'other', 'Domain and hosting setup, first year', 1, 6000, 2);
  update public.quotes set status = 'submitted' where id = v_q;
  update public.requests set status = 'comparing' where id = v_r6;

  -- 10. Request 7: logo and brand identity, approved, work started.
  insert into public.requests (org_id, created_by, title, description, category_id, source, status,
                               needed_by, budget_max)
  values (v_buyer, v_buyer_user, 'Logo and brand identity',
          'New logo, colours and fonts for the snack range, with a one-page brand guide.',
          v_mkt, 'catalogue', 'open', current_date + 20, 30000)
  returning id into v_r7;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r7, (select id from public.catalogue_items where name = 'Brand identity design'),
          'Logo, colours, fonts and a one-page brand guide', 1, 'project')
  returning id into v_line;
  update public.request_matches set status = 'approved', reviewed_at = now(), review_note = 'Approved for the demo'
   where request_id = v_r7 and vendor_org_id = v_sv;

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r7, v_sv) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, valid_until)
  values (v_inv, v_r7, v_sv, 'draft', 14, current_date + 15) returning id into v_q_win;
  insert into public.quote_lines (quote_id, request_line_id, description, quantity, unit_price)
  values (v_q_win, v_line, 'Logo, colours, fonts and a one-page brand guide', 1, 22000);
  update public.quotes set status = 'submitted' where id = v_q_win;

  update public.quotes set status = 'accepted' where id = v_q_win;
  update public.requests set status = 'ordered' where id = v_r7;
  insert into public.purchase_orders (request_id, quote_id, buyer_org_id, vendor_org_id, total_amount,
                                      approved_by, status, expected_delivery)
  select v_r7, q.id, v_buyer, v_sv, q.total, v_buyer_user, 'in_production', current_date + 12
    from public.quotes q where q.id = v_q_win;
  perform app.notify_org(v_sv, 'quote_accepted', 'Your quote was accepted', 'Logo and brand identity', '/vendor/quotes');

  -- The admin already handled requests 6 and 7 too.
  delete from public.notifications
   where type = 'matches_to_review'
     and link in ('/admin/matches/' || v_r6, '/admin/matches/' || v_r7);

  perform app.audit('demo.reset', 'organisation', v_buyer, jsonb_build_object('orgs', v_demo_orgs));
  return 'Demo workspace ready: 1 startup, 3 goods suppliers, 1 service supplier, 7 requests (2 for services), '
      || '7 quotes (one revised after negotiation), 1 open price offer, 2 orders, 1 request waiting for match review.';
end;
$$;

revoke execute on function public.reset_demo_workspace() from public, anon;
grant  execute on function public.reset_demo_workspace() to authenticated;

revoke execute on function public.reset_demo_workspace() from public, anon;
grant  execute on function public.reset_demo_workspace() to authenticated;

-- Reload the demo now.
select public.reset_demo_workspace();

-- Check: the demo requests, their matches and price offers.
select r.title, r.status,
       r.delivery_city is null and r.delivery_state is null as remote,
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
