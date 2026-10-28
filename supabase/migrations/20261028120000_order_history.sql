-- ============================================================================
-- MPI · Migration 20261028120000 · Order history
--
-- Until now an order only remembered its latest step and when it last
-- changed. From now on every step is recorded with its date and time
-- (placed, in production, quality checked, dispatched, delivered,
-- completed or cancelled) and who made the change, so the order screen can
-- show a timeline and the admin can see when each step happened.
--
-- Steps are recorded automatically whenever an order is created or its
-- status changes; the app only reads them.
--
-- Orders that already exist get the steps we know: when they were placed,
-- and their current step. Steps in between were never stored, so they are
-- not made up.
--
-- Run after 20261027120000_remote_services_offer_expiry.sql. Safe to run again.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references public.purchase_orders (id) on delete cascade,
  status      public.po_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,  -- empty when done by the system
  created_at  timestamptz not null default now()
);
create index if not exists order_events_po_idx on public.order_events (po_id, created_at);


-- ----------------------------------------------------------------------------
-- 2. Record a step whenever an order is created or changes status
-- ----------------------------------------------------------------------------
create or replace function app.record_order_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (po_id, status, changed_by, created_at)
    values (new.id, 'issued', coalesce(auth.uid(), new.approved_by), new.approved_at);
    if new.status <> 'issued' then
      insert into public.order_events (po_id, status, changed_by, created_at)
      values (new.id, new.status, auth.uid(), new.status_changed_at);
    end if;
  elsif new.status is distinct from old.status then
    insert into public.order_events (po_id, status, changed_by, created_at)
    values (new.id, new.status, auth.uid(), now());
  end if;
  return null;
end;
$$;

revoke execute on function app.record_order_event() from public;

drop trigger if exists record_order_event on public.purchase_orders;
create trigger record_order_event
  after insert or update of status on public.purchase_orders
  for each row execute function app.record_order_event();


-- ----------------------------------------------------------------------------
-- 3. Steps for orders that already exist (only those with no history yet)
-- ----------------------------------------------------------------------------
insert into public.order_events (po_id, status, changed_by, created_at)
select po.id, 'issued'::public.po_status, po.approved_by, po.approved_at
  from public.purchase_orders po
 where not exists (select 1 from public.order_events e where e.po_id = po.id)
union all
select po.id, po.status, null, po.status_changed_at
  from public.purchase_orders po
 where po.status <> 'issued'
   and not exists (select 1 from public.order_events e where e.po_id = po.id);


-- ----------------------------------------------------------------------------
-- 4. Access: whoever can see the order (its startup, its supplier, admin)
--    can read its history. Nobody writes to it directly.
-- ----------------------------------------------------------------------------
grant select on public.order_events to authenticated;
alter table public.order_events enable row level security;

drop policy if exists oe_select on public.order_events;
create policy oe_select on public.order_events for select to authenticated using (
  exists (select 1 from public.purchase_orders po where po.id = po_id)
);


-- ----------------------------------------------------------------------------
-- 5. Demo workspace: the demo orders get a few days of history
--    (replaces the earlier version; only section 11 is new)
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

  -- 11. Order history for the two demo orders, as if they were placed a
  --     few days ago: labels placed 4 days ago, production started 2 days
  --     ago; logo project placed 3 days ago, work started yesterday.
  update public.purchase_orders po
     set approved_at = now() - v.placed, created_at = now() - v.placed, status_changed_at = now() - v.started
    from (values (v_r2, interval '4 days', interval '2 days'),
                 (v_r7, interval '3 days', interval '1 day')) as v (request_id, placed, started)
   where po.request_id = v.request_id;
  delete from public.order_events
   where po_id in (select id from public.purchase_orders where request_id in (v_r2, v_r7));
  insert into public.order_events (po_id, status, changed_by, created_at)
  select po.id, 'issued'::public.po_status, v_buyer_user, po.approved_at
    from public.purchase_orders po where po.request_id in (v_r2, v_r7)
  union all
  select po.id, 'in_production'::public.po_status,
         (select p.id from public.profiles p where p.org_id = po.vendor_org_id order by p.created_at limit 1),
         po.status_changed_at
    from public.purchase_orders po where po.request_id in (v_r2, v_r7);

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

-- Check: every order and its steps, oldest first.
select po.po_number, r.title, e.status, to_char(e.created_at, 'DD Mon HH24:MI') as at
  from public.order_events e
  join public.purchase_orders po on po.id = e.po_id
  join public.requests r on r.id = po.request_id
 order by po.po_number, e.created_at;

-- ============================================================================
-- End of migration
-- ============================================================================
