-- ============================================================================
-- MPI · Migration 20261022130000 · Investor demo workspace
--
-- Before running: create these 4 users in Supabase
-- (Authentication -> Users -> Add user, tick "Auto Confirm User"):
--   mpi-demostartup@example.com     the demo startup
--   mpi-demosupplier1@example.com   demo supplier 1 (packaging)
--   mpi-demosupplier2@example.com   demo supplier 2 (prototyping)
--   mpi-demosupplier3@example.com   demo supplier 3 (packaging and printing)
--
-- This file adds public.reset_demo_workspace() and runs it once. The function
-- turns those 4 accounts into the demo workspace and (re)loads its sample
-- data. Admin can run it again before each pitch to start fresh.
--
-- Demo organisations have is_demo = true, so real accounts never see them
-- and they can never be invited by, or invite, a real organisation.
-- Company names below are fictional and only visible to the admin.
--
-- Run after 20261021120000_core_schema.sql and 20261022120000_catalogue_seed.sql.
-- ============================================================================

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
  v_pack    uuid;  v_proto uuid;
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid;
  v_inv uuid; v_q uuid; v_q_win uuid; v_q_lose uuid;
  v_line uuid;
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
  delete from public.purchase_orders
   where buyer_org_id = any (v_demo_orgs) or vendor_org_id = any (v_demo_orgs);
  delete from public.requests where org_id = any (v_demo_orgs);   -- lines, invitations, quotes go with it
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
  --    startups, so they are converted here).
  select org_id into v_s1 from public.profiles where email = v_emails[2];
  select org_id into v_s2 from public.profiles where email = v_emails[3];
  select org_id into v_s3 from public.profiles where email = v_emails[4];

  update public.profiles set role = 'vendor' where org_id in (v_s1, v_s2, v_s3);
  update public.profiles set full_name = 'Suresh Rao (demo)'   where email = v_emails[2];
  update public.profiles set full_name = 'Neha Kulkarni (demo)' where email = v_emails[3];
  update public.profiles set full_name = 'Imran Shaikh (demo)'  where email = v_emails[4];

  update public.organisations o
     set type = 'vendor', is_demo = true, verification_status = 'verified',
         verified_at = coalesce(o.verified_at, now()), verification_note = null,
         display_name = case when o.display_name like 'MPI Verified Supplier #%' then o.display_name
                             else 'MPI Verified Supplier #' || lpad(nextval('public.supplier_code_seq')::text, 3, '0') end,
         name = v.name, city = v.city, state = v.state
    from (values
      (v_s1, 'Demo · Shree Balaji Packaging', 'Bengaluru', 'Karnataka'),
      (v_s2, 'Demo · Deccan Proto Works',     'Pune',      'Maharashtra'),
      (v_s3, 'Demo · Sabarmati Print & Pack', 'Ahmedabad', 'Gujarat')
    ) as v (org_id, name, city, state)
   where o.id = v.org_id;

  delete from public.startup_details where org_id in (v_s1, v_s2, v_s3);
  insert into public.vendor_details (org_id) values (v_s1), (v_s2), (v_s3) on conflict (org_id) do nothing;
  update public.vendor_details d
     set enterprise_type = v.size::public.enterprise_size, machinery = v.machinery,
         monthly_capacity = v.capacity, capacity_utilisation_pct = v.util,
         certifications = v.certs, moq = v.moq, payment_terms = v.terms,
         quality_testing_facilities = v.qa, lead_time_days = v.lead, pan_india_dispatch = v.pan_india
    from (values
      (v_s1, 'small', array['3-ply corrugator', 'Flexo printer', 'Die-cutter'], '4 lakh boxes', 70,
             array['ISO 9001'], 1000::numeric, '50% advance, 50% on dispatch', array['Burst strength tester'], 12, true),
      (v_s2, 'micro', array['FDM 3D printers (x4)', 'SLA printer', 'CNC router'], '300 prototype parts', 55,
             array[]::text[], 1::numeric, '100% advance', array['Vernier and gauge set'], 7, true),
      (v_s3, 'small', array['Offset press', 'Label rewinder', 'Lamination line'], '15 lakh labels', 65,
             array['ISO 9001', 'ZED Bronze'], 5000::numeric, '30 days credit after delivery', array['Colour matching booth'], 10, false)
    ) as v (org_id, size, machinery, capacity, util, certs, moq, terms, qa, lead, pan_india)
   where d.org_id = v.org_id;

  select id into v_pack  from public.catalogue_categories where slug = 'packaging-and-printing';
  select id into v_proto from public.catalogue_categories where slug = 'prototyping-and-product-development';
  insert into public.vendor_categories (vendor_org_id, category_id) values
    (v_s1, v_pack), (v_s2, v_proto), (v_s3, v_pack);

  -- 4. Request 1: mailer boxes, two quotes in, startup is comparing.
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

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r1, v_s1) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until, discount_pct)
  values (v_inv, v_r1, v_s1, 'draft', 12, '50% advance, 50% on dispatch', current_date + 15, 2.5) returning id into v_q;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order) values
    (v_q, v_line, 'item',  'Kraft mailer box, 3-ply, 2-colour print', 2000, 19.50, 1),
    (v_q, null,   'setup', 'Printing plates and die', 1, 4500, 2);
  update public.quotes set status = 'submitted' where id = v_q;

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r1, v_s3) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
  values (v_inv, v_r1, v_s3, 'draft', 10, '30 days credit after delivery', current_date + 10) returning id into v_q;
  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, sort_order) values
    (v_q, v_line, 'item',      'Kraft mailer box, 3-ply, 2-colour print', 2000, 21.00, 1),
    (v_q, null,   'logistics', 'Delivery to Bengaluru', 1, 2200, 2);
  update public.quotes set status = 'submitted' where id = v_q;
  update public.requests set status = 'comparing' where id = v_r1;

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

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r2, v_s3) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
  values (v_inv, v_r2, v_s3, 'draft', 8, '30 days credit after delivery', current_date + 10) returning id into v_q_win;
  insert into public.quote_lines (quote_id, request_line_id, description, quantity, unit_price)
  values (v_q_win, v_line, 'Matte BOPP label, 60 x 40 mm, 4-colour', 10000, 0.95);
  update public.quotes set status = 'submitted' where id = v_q_win;

  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r2, v_s1) returning id into v_inv;
  insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
  values (v_inv, v_r2, v_s1, 'draft', 12, '50% advance, 50% on dispatch', current_date + 15) returning id into v_q_lose;
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
  insert into public.rfq_invitations (request_id, vendor_org_id) values (v_r3, v_s2) returning id into v_inv;
  update public.rfq_invitations set status = 'viewed', responded_at = now() where id = v_inv;

  -- 7. Request 4: a draft the startup has not sent yet.
  insert into public.requests (org_id, created_by, title, category_id, source, status, delivery_city, delivery_state)
  values (v_buyer, v_buyer_user, 'Tamper-evident seals, 5,000 pcs', v_pack, 'catalogue', 'draft', 'Bengaluru', 'Karnataka')
  returning id into v_r4;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_r4, (select id from public.catalogue_items where name = 'Tamper-evident seals'),
          'Void tamper-evident seal, 25 mm round', 5000, 'pcs');

  perform app.audit('demo.reset', 'organisation', v_buyer, jsonb_build_object('orgs', v_demo_orgs));
  return 'Demo workspace ready: 1 startup, 3 suppliers, 4 requests, 4 quotes, 1 order.';
end;
$$;

revoke execute on function public.reset_demo_workspace() from public, anon;
grant  execute on function public.reset_demo_workspace() to authenticated;

-- Load it now.
select public.reset_demo_workspace();

-- Check: one row per demo company.
select o.display_name, o.type, o.name, o.verification_status,
       (select count(*) from public.requests r where r.org_id = o.id) as requests,
       (select count(*) from public.quotes q where q.vendor_org_id = o.id) as quotes
  from public.organisations o
 where o.is_demo
 order by o.type, o.display_name;
