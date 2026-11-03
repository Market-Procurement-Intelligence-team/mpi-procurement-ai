-- ============================================================================
-- MPI · End-to-end check (not a migration)
--
-- Runs the whole journey on the real database, as the real demo accounts:
--   startup sends a request -> suppliers are matched -> admin approves ->
--   supplier quotes -> price negotiation (and offer expiry) -> startup
--   approves -> order and its history -> a remote service request ->
--   government scheme suggestions -> the suppliers' price guide -> money:
--   the spec's worked examples, invoices, payments, payouts and returns.
-- It also checks that each person sees only what they should.
--
-- NOTHING IS SAVED. Everything runs inside one block that is cancelled at the
-- end, so the database is exactly as it was before. Because of that, the
-- result appears as an "error" in the SQL Editor: read the message, which
-- starts with "MPI END-TO-END CHECK".
--
-- Needs: all migrations up to 20261102120000 run, and the demo workspace
-- (mpi-demostartup@, mpi-demosupplier1-3@, mpi-demoservice@example.com).
-- Safe to run as often as you like, e.g. on the morning of a demo.
-- ============================================================================

do $check$
declare
  v_me        text := current_user;     -- the SQL Editor's own role, to switch back to
  v_lines     text[] := '{}';
  v_pass      integer := 0;
  v_total     integer := 0;
  v_ok        boolean;
  v_got       text;

  -- people
  u_startup uuid; u_s1 uuid; u_s2 uuid; u_s3 uuid; u_sv uuid; u_admin uuid;
  o_startup uuid; o_s1 uuid; o_s2 uuid; o_s3 uuid; o_sv uuid;

  -- things made during the check
  v_pack    uuid; v_it uuid;
  v_req     uuid; v_line uuid; v_match uuid; v_inv uuid;
  v_quote   uuid; v_quote2 uuid; v_offer uuid; v_counter uuid;
  v_po      uuid; v_po_number text;
  v_req2    uuid;
  v_num     numeric;
  v_int     integer;
  v_txt     text;
  v_arr     text[];
  v_guide   record;
  v_guide_n integer;
  v_json    jsonb;
  v_po2     uuid;
  v_ql      uuid;
begin
  -- --------------------------------------------------------------------------
  -- Who is who
  -- --------------------------------------------------------------------------
  select id, org_id into u_startup, o_startup from public.profiles where email = 'mpi-demostartup@example.com';
  select id, org_id into u_s1, o_s1 from public.profiles where email = 'mpi-demosupplier1@example.com';
  select id, org_id into u_s2, o_s2 from public.profiles where email = 'mpi-demosupplier2@example.com';
  select id, org_id into u_s3, o_s3 from public.profiles where email = 'mpi-demosupplier3@example.com';
  select id, org_id into u_sv, o_sv from public.profiles where email = 'mpi-demoservice@example.com';
  select id into u_admin from public.profiles where role = 'admin' order by created_at limit 1;
  if u_startup is null or u_s1 is null or u_s2 is null or u_s3 is null or u_sv is null or u_admin is null then
    raise exception 'MPI END-TO-END CHECK could not start: a demo account or the admin account is missing. Run select public.reset_demo_workspace(); first.';
  end if;
  select id into v_pack from public.catalogue_categories where slug = 'packaging-and-printing';
  select id into v_it   from public.catalogue_categories where slug = 'it-and-digital-services';

  -- ==========================================================================
  -- 1. The startup sends a request
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.requests (org_id, title, category_id, source, status, needed_by,
                               delivery_city, delivery_state, budget_max, required_certifications)
  values (o_startup, 'End-to-end check: corrugated boxes', v_pack, 'catalogue', 'draft', current_date + 25,
          'Bengaluru', 'Karnataka', 50000, array['ISO 9001'])
  returning id into v_req;
  insert into public.request_lines (request_id, item_id, description, quantity, unit)
  values (v_req, (select id from public.catalogue_items where name = 'Corrugated boxes'), '3-ply corrugated box', 1000, 'pcs')
  returning id into v_line;
  update public.requests set status = 'open' where id = v_req;

  v_total := v_total + 1;
  select count(*) into v_int from public.catalogue_items i
    join public.catalogue_categories c on c.id = i.category_id
   where i.is_active and c.is_active;
  v_ok := v_int = 100 and (select count(*) from public.catalogue_categories where is_active) = 9;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup sees the full catalogue: 9 groups, ' || v_int || ' items (expected 100)');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  select count(*) into v_int from public.request_matches where request_id = v_req;
  v_ok := v_int = 0;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup does not see suggested suppliers before the admin approves (sees ' || v_int || ')');
  if v_ok then v_pass := v_pass + 1; end if;

  perform set_config('role', v_me, true);

  v_total := v_total + 1;
  select count(*), bool_or(vendor_org_id = o_s1) into v_int, v_ok
    from public.request_matches where request_id = v_req and status = 'suggested';
  v_ok := coalesce(v_ok, false);
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Request sent: ' || v_int || ' supplier(s) suggested automatically, including demo supplier 1');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  select count(*) > 0 into v_ok from public.notifications
   where user_id = u_admin and type = 'matches_to_review' and link = '/admin/matches/' || v_req;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Admin is notified that there are matches to review');
  if v_ok then v_pass := v_pass + 1; end if;

  -- Supplier 1 cannot see the request yet
  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select count(*) into v_int from public.requests where id = v_req;
  v_ok := v_int = 0;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier cannot see the request before being approved for it');
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- ==========================================================================
  -- 2. The admin approves supplier 1
  -- ==========================================================================
  select id into v_match from public.request_matches where request_id = v_req and vendor_org_id = o_s1;
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_total := v_total + 1;
  begin
    perform public.review_match(v_match, true, 'End-to-end check');
    select id into v_inv from public.rfq_invitations where request_id = v_req and vendor_org_id = o_s1;
    v_ok := v_inv is not null;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Admin approves the match, and the supplier is invited to quote');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Admin approves the match: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- Startup: sees the approved match with reasons; cannot invite an unapproved supplier
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_total := v_total + 1;
  select count(*), max(cardinality(reasons)) into v_int, v_num from public.request_matches where request_id = v_req;
  v_ok := v_int = 1 and v_num >= 2;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup sees the 1 approved supplier, with plain-language reasons');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  select count(*) > 0 into v_ok from public.notifications where user_id = u_startup and type = 'supplier_matched' and link = '/app/requests/' || v_req;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup is notified that a verified supplier was matched');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    execute 'select budget_max from public.request_private_details where request_id = $1' into v_num using v_req;
    v_ok := v_num = 50000;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup can still see its own budget (₹' || coalesce(v_num::text, 'nothing') || ')');
  exception when undefined_table then
    v_ok := false;
    v_lines := v_lines || '✗ Private request details are not set up yet (run 20261028140000_hide_budget_from_suppliers.sql)'::text;
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    insert into public.rfq_invitations (request_id, vendor_org_id) values (v_req, o_s2);
    v_ok := false;
    v_lines := v_lines || '✗ Startup could invite a supplier the admin had not approved'::text;
  exception when others then
    v_ok := true;
    v_lines := v_lines || ('✓ Startup cannot invite a supplier the admin has not approved (' || sqlerrm || ')');
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- ==========================================================================
  -- 3. Supplier 1 quotes
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_total := v_total + 1;
  select count(*) into v_int from public.requests where id = v_req;
  v_ok := v_int = 1;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Invited supplier can now see the request');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    select budget_max into v_num from public.requests where id = v_req;
    v_ok := v_num is null;
    v_lines := v_lines || (case when v_ok then '✓ Supplier cannot see the startup''s budget'
                                else '✗ Supplier CAN see the startup''s budget (₹' || v_num || '). Suppliers should never see it' end);
  exception when insufficient_privilege then
    v_ok := true;
    v_lines := v_lines || '✓ Supplier cannot see the startup''s budget'::text;
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    execute 'select count(*) from public.request_private_details where request_id = $1' into v_int using v_req;
    v_ok := v_int = 0;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier cannot see the startup''s own words or the AI''s reading of them (budget often appears there)');
  exception when undefined_table then
    v_ok := false;
    v_lines := v_lines || '✗ Private request details are not set up yet (run 20261028140000_hide_budget_from_suppliers.sql)'::text;
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  select count(*) into v_int from public.organisations where id = o_startup;
  select display_name into v_txt from public.org_public where id = o_startup;
  v_ok := v_int = 0 and v_txt like 'MPI Verified Buyer #%';
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier sees the startup only as "' || coalesce(v_txt, '?') || '", never its real name');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    select * into v_guide from public.price_guide(v_line);
    v_guide_n := v_guide.price_count;
    v_ok := v_guide.source = 'past_quotes' and v_guide.price_count >= 5
            and v_guide.low <= v_guide.typical and v_guide.typical <= v_guide.high;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier sees a price guide while quoting: ₹' || coalesce(v_guide.low::text, '?')
               || ' to ₹' || coalesce(v_guide.high::text, '?') || ' per piece, typical ₹' || coalesce(v_guide.typical::text, '?')
               || ', from ' || coalesce(v_guide.price_count, 0) || ' past prices');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Supplier sees a price guide: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    insert into public.quotes (invitation_id, request_id, vendor_org_id, status, lead_time_days, payment_terms, valid_until)
    values (v_inv, v_req, o_s1, 'draft', 10, '100% after delivery', current_date + 10)
    returning id into v_quote;
    insert into public.quote_lines (quote_id, request_line_id, description, quantity, unit_price)
    values (v_quote, v_line, '3-ply corrugated box', 1000, 20);
    update public.quotes set status = 'submitted' where id = v_quote;
    select total, payment_terms, volume_discount_pct into v_num, v_txt, v_int from public.quotes where id = v_quote;
    v_ok := v_num = round(20000 * (1 - v_int / 100.0) * 1.18, 2)
            and v_txt in ('30% before work starts, 70% on delivery', '100% advance before work starts');
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier sends a quote: total ₹' || v_num || ' incl. GST after the supplier''s MPI volume rate of ' || v_int || '%; payment terms set by MPI ("' || v_txt || '"), not by the supplier');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Supplier sends a quote: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  select price_count into v_int from public.price_guide(v_line);
  v_ok := v_int = v_guide_n;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'The price guide ignores the quotes on the same request (still ' || coalesce(v_int, 0) || ' past prices after this quote)');
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- Not invited (supplier 2) and the startup cannot ask for the price guide
  v_total := v_total + 1;
  v_int := 0;
  foreach v_txt in array array[u_s2::text, u_startup::text] loop
    perform set_config('request.jwt.claim.sub', v_txt, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_txt, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      perform public.price_guide(v_line);
    exception when others then
      v_int := v_int + 1;
    end;
    perform set_config('role', v_me, true);
  end loop;
  v_ok := v_int = 2;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Only invited suppliers get the price guide (a supplier not invited and the startup are refused)');
  if v_ok then v_pass := v_pass + 1; end if;

  -- Too few past prices (rapid prototyping, demo request for supplier 2): the app asks the AI instead
  perform set_config('request.jwt.claim.sub', u_s2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    select g.source, g.price_count into v_txt, v_int
      from public.request_lines rl
      join public.catalogue_items i on i.id = rl.item_id and i.name = 'Rapid prototyping'
      join public.rfq_invitations inv on inv.request_id = rl.request_id and inv.vendor_org_id = o_s2,
           lateral public.price_guide(rl.id) g
     limit 1;
    v_ok := v_txt = 'too_few';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'With too few past prices (' || coalesce(v_int, 0) || ' for rapid prototyping) the guide hands over to the AI estimate');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Price guide with too few past prices: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- ==========================================================================
  -- 4. Negotiation
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_total := v_total + 1;
  select count(*) > 0 into v_ok from public.notifications where user_id = u_startup and type = 'quote_received' and link = '/app/requests/' || v_req;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup is notified of the new quote');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  select count(*) into v_int from public.organisations where id = o_s1;
  select display_name into v_txt from public.org_public where id = o_s1;
  v_ok := v_int = 0 and v_txt like 'MPI Verified Supplier #%';
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup sees the supplier only as "' || coalesce(v_txt, '?') || '", never its real name');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    v_offer := public.propose_price(v_quote, 19000, 'Can you do ₹19,000?');
    select expires_at - created_at into v_txt from public.quote_negotiations where id = v_offer;
    v_ok := v_txt = '1 day' or v_txt = '24:00:00';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup asks for ₹19,000; the offer expires 24 hours later');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Startup asks for a lower price: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    perform public.propose_price(v_quote, 18500);
    v_ok := false;
    v_lines := v_lines || '✗ Startup could make a second offer while one is still open'::text;
  exception when others then
    v_ok := true;
    v_lines := v_lines || ('✓ Only one open offer at a time (' || sqlerrm || ')');
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    v_counter := public.respond_to_price(v_offer, 'counter', 20000, 'Best is ₹20,000');
    v_ok := v_counter is not null;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier counters with ₹20,000');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Supplier counters: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    v_quote2 := public.respond_to_price(v_counter, 'accept', null, 'Agreed');
    select total into v_num from public.quotes where id = v_quote2;
    select status::text into v_txt from public.quotes where id = v_quote;
    v_ok := v_num = 20000 and v_txt = 'superseded';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup accepts: a new quote version at ₹' || v_num || ' replaces the old one (' || v_txt || ')');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Startup accepts the counter-offer: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- Offer expiry, on the demo's open offer (mailer boxes, supplier 3)
  v_total := v_total + 1;
  select id into v_offer from public.quote_negotiations where vendor_org_id = o_s3 and status = 'open' limit 1;
  if v_offer is null then
    v_ok := false;
    v_lines := v_lines || '✗ Offer expiry: the demo has no open offer to test with (run reset_demo_workspace first)'::text;
  else
    update public.quote_negotiations set expires_at = now() - interval '1 minute' where id = v_offer;
    perform set_config('request.jwt.claim.sub', u_s3::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', u_s3, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      perform public.respond_to_price(v_offer, 'accept');
      v_ok := false;
      v_lines := v_lines || '✗ A supplier could still accept an offer after its 24 hours'::text;
    exception when others then
      v_ok := sqlerrm like '%expired%';
      v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'An offer past its 24 hours cannot be answered (' || sqlerrm || ')');
    end;
    perform set_config('role', v_me, true);
  end if;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  v_int := app.expire_offers();
  select status::text into v_txt from public.quote_negotiations where id = v_offer;
  v_ok := v_int >= 1 and v_txt = 'expired';
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'The expiry job marks it expired (' || v_int || ' offer(s)) and notifies both sides');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  if to_regclass('cron.job') is null then
    v_ok := false;
    v_lines := v_lines || '✗ The 15-minute expiry job is not set up (turn on Cron under Integrations)'::text;
  else
    execute 'select count(*) from cron.job where jobname = ''mpi-expire-price-offers'' and active' into v_int;
    v_ok := v_int = 1;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'The expiry job runs every 15 minutes');
  end if;
  if v_ok then v_pass := v_pass + 1; end if;

  -- ==========================================================================
  -- 5. Order
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    v_po := public.approve_quote(v_quote2);
    select po_number, total_amount into v_po_number, v_num from public.purchase_orders where id = v_po;
    select status::text into v_txt from public.requests where id = v_req;
    v_ok := v_po_number ~ '^MPI-PO-[0-9]{4}-[0-9]{5}$' and v_num = 20000 and v_txt = 'ordered';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup approves the quote: order ' || v_po_number || ' for ₹' || v_num || ', request marked ordered');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Startup approves the quote: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    perform public.update_order_status(v_po, 'dispatched');
    v_ok := false;
    v_lines := v_lines || '✗ Startup could move the order forward itself'::text;
  exception when others then
    v_ok := true;
    v_lines := v_lines || '✓ Only the supplier moves the order forward (startup refused)'::text;
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select count(*) > 0 into v_ok from public.notifications where user_id = u_s1 and type = 'quote_accepted';
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier is notified that its quote was accepted');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    perform public.update_order_status(v_po, 'in_production', current_date + 9);
    select array_agg(e.status::text order by e.created_at, e.status) into v_arr from public.order_events e where e.po_id = v_po;
    v_ok := v_arr = array['issued', 'in_production'];
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier starts production; order history shows ' || coalesce(array_to_string(v_arr, ' → '), 'nothing'));
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Supplier starts production: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select (select count(*) from public.requests where id = v_req)
       + (select count(*) from public.quotes where request_id = v_req)
       + (select count(*) from public.purchase_orders where id = v_po)
       + (select count(*) from public.order_events where po_id = v_po)
    into v_int;
  v_ok := v_int = 0;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'A supplier not involved sees nothing of this request, its quotes or its order');
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- ==========================================================================
  -- 5b. Money: the spec's worked examples, invoices, payments, payouts, returns
  -- ==========================================================================
  -- The calculation against the client's spec (31 Oct 2026), section by section
  for v_txt, v_json, v_arr in
    select * from (values
      ('Packaging example (B2): buyer pays ₹12,602.40, supplier gets ₹11,859, MPI earns ₹630',
       '{"lines":[{"amount":10000,"tax_rate":18,"kind":"eligible"},{"amount":1000,"tax_rate":18,"kind":"extra"},{"amount":500,"tax_rate":18,"kind":"extra"}],"volume_pct":10,"buyer_fee":{"type":"percent","value":2},"commission":{"enabled":true,"pct":5},"mpi_tax_pct":18}'::jsonb,
       array['buyer.checkout_total=12602.40', 'supplier.payout=11859.00', 'mpi.revenue=630.00', 'mpi.invoices_total=743.40', 'savings.net=820.00']),
      ('Marketing example (C4): checkout ₹21,664.80, agency gets ₹20,178, MPI earns ₹1,260, ad budget not charged',
       '{"lines":[{"amount":20000,"tax_rate":18,"kind":"eligible"},{"amount":50000,"tax_rate":0,"kind":"pass_through"}],"volume_pct":10,"buyer_fee":{"type":"percent","value":2},"commission":{"enabled":true,"pct":5},"mpi_tax_pct":18}'::jsonb,
       array['buyer.checkout_total=21664.80', 'supplier.payout=20178.00', 'mpi.revenue=1260.00', 'buyer.cash_paid=71664.80', 'savings.net=1640.00']),
      ('Legal example (C5): no commission, fee ₹13,500, reverse-charge GST ₹2,430 kept apart, cash ₹16,090',
       '{"lines":[{"amount":15000,"tax_rate":18,"kind":"eligible"},{"amount":2000,"tax_rate":0,"kind":"pass_through"}],"volume_pct":10,"tax_mode":"reverse","buyer_fee":{"type":"fixed","value":500},"commission":{"enabled":false},"mpi_tax_pct":18}'::jsonb,
       array['supplier.invoice_total=13500.00', 'supplier.commission=0', 'buyer.rcm_tax=2430.00', 'buyer.cash_paid=16090.00', 'buyer.total_cost=18520.00']),
      ('CA example (C6): no commission, total ₹6,164, MPI earns ₹300; with 30 extra entries ₹6,518',
       '{"lines":[{"amount":5000,"tax_rate":18,"kind":"eligible"},{"amount":300,"tax_rate":18,"kind":"extra"},{"amount":500,"tax_rate":0,"kind":"pass_through"}],"volume_pct":10,"buyer_fee":{"type":"fixed","value":300},"commission":{"enabled":false},"mpi_tax_pct":18}'::jsonb,
       array['buyer.cash_paid=6518.00', 'mpi.revenue=300.00', 'supplier.commission=0']),
      ('Prototyping example (C7): client ₹63,177.20, payout ₹60,947, MPI ₹1,890; 30/40/30 split ₹18,762 / ₹25,016 / ₹18,762',
       '{"lines":[{"amount":30000,"tax_rate":18,"kind":"eligible"},{"amount":20000,"tax_rate":18,"kind":"extra"},{"amount":5000,"tax_rate":18,"kind":"extra"},{"amount":1000,"tax_rate":18,"kind":"extra"}],"volume_pct":10,"buyer_fee":{"type":"percent","value":2},"commission":{"enabled":true,"pct":5},"mpi_tax_pct":18,"schedule":[30,40,30]}'::jsonb,
       array['buyer.checkout_total=63177.20', 'supplier.payout=60947.00', 'mpi.revenue=1890.00', 'sched=18762.00/25016.00/18762.00']),
      ('Discounts stack: 10% then 5% = 14.5%, never applied twice',
       '{"lines":[{"amount":10000,"tax_rate":18,"kind":"eligible"}],"volume_pct":10,"negotiated_pct":5}'::jsonb,
       array['supplier.taxable=8550.00', 'savings.pct=14.50'])
    ) t (label, input, expect)
  loop
    v_total := v_total + 1;
    v_ok := true;
    declare
      v_calc jsonb := app.money_calc(v_json);
      v_e text;
    begin
      foreach v_e in array v_arr loop
        if split_part(v_e, '=', 1) = 'sched' then
          v_ok := v_ok and (select string_agg(x->>'amount', '/' order by (x->>'seq')::integer)
                              from jsonb_array_elements(v_calc->'supplier'->'schedule') x) = split_part(v_e, '=', 2);
        else
          v_ok := v_ok and (v_calc #>> string_to_array(split_part(v_e, '=', 1), '.'))::numeric = split_part(v_e, '=', 2)::numeric;
        end if;
      end loop;
      v_ok := v_ok and (v_calc->>'cash_reconciles')::boolean;
    end;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || v_txt);
    if v_ok then v_pass := v_pass + 1; end if;
  end loop;

  -- The order just placed got its 3 invoices and a frozen price record
  v_total := v_total + 1;
  select count(*) into v_int from public.invoices where po_id = v_po;
  select (outputs->>'cash_reconciles')::boolean into v_ok from public.order_price_snapshots where po_id = v_po;
  v_ok := coalesce(v_ok, false) and v_int = 3;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'The order has ' || v_int || ' invoices (supplier, MPI fee, MPI commission) and a frozen price record that adds up');
  if v_ok then v_pass := v_pass + 1; end if;

  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select array_agg(kind order by kind) into v_arr from public.invoices where po_id = v_po;
  v_ok := v_arr = array['mpi_fee_to_buyer', 'supplier_to_buyer'];
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup sees its 2 invoices, not MPI''s commission to the supplier');
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    v_json := public.pay_order(v_po, 'e2e-' || v_po || '-advance');
    v_num := (v_json->>'paid')::numeric;
    v_json := public.pay_order(v_po, 'e2e-' || v_po || '-advance');   -- same click twice
    select count(*) into v_int from public.payments where po_id = v_po;
    v_ok := v_num > 0 and (v_json->>'already_recorded')::boolean and v_int = 1;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup pays the advance and MPI fee (simulated, ₹' || v_num || '); paying twice by mistake records it once');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Startup pays the advance: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    perform public.pay_order(v_po, 'e2e-' || v_po || '-balance');
    v_ok := false;
    v_lines := v_lines || '✗ The balance could be paid before delivery'::text;
  exception when others then
    v_ok := sqlerrm like '%delivered%';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'The balance is only due on delivery (' || sqlerrm || ')');
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select array_agg(kind order by kind) into v_arr from public.invoices where po_id = v_po;
  v_json := public.order_money(v_po);
  v_ok := v_arr = array['mpi_commission_to_supplier', 'supplier_to_buyer'] and v_json->'amounts'->'buyer' is null
          and v_json->'amounts'->'mpi' is null;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier sees its invoice and MPI''s commission, never the buyer''s MPI fee');
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    v_json := public.settle_supplier(v_po, 'e2e-' || v_po || '-payout');
    v_json := v_json || jsonb_build_object('balances', public.order_money(v_po)->'balances');
    v_ok := (v_json->>'net_paid')::numeric > 0 and (v_json->>'commission_deducted')::numeric > 0
            and (v_json->'balances'->>'mpi_cash')::numeric
                = -((v_json->'balances'->>'mpi_revenue')::numeric + (v_json->'balances'->>'gst_payable')::numeric);
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Admin pays the supplier ₹' || (v_json->>'net_paid')
                           || ' after ₹' || (v_json->>'commission_deducted') || ' commission; MPI keeps exactly its fees and their GST');
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Admin pays the supplier out: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    perform public.set_fee_rule((select id from public.catalogue_categories where slug = 'compliance-and-legal-support'),
                                'fixed', 500, true, 5);
    v_ok := false;
    v_lines := v_lines || '✗ Commission could be switched on for legal work'::text;
  exception when others then
    v_ok := sqlerrm like '%Commission must stay off%';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Commission cannot be switched on for legal or CA work (professional rules)');
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  v_total := v_total + 1;
  select coalesce(sum(amount), 0) into v_num from public.ledger_entries;
  select count(*) into v_int from (select po_id from public.ledger_entries group by po_id having sum(amount) <> 0) x;
  v_ok := v_num = 0 and v_int = 0;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'MPI''s books balance on every order');
  if v_ok then v_pass := v_pass + 1; end if;

  -- Spec B2.1 on the demo's shipping cartons order: delivered, paid in full,
  -- paid out, then 100 cartons come back.
  select po.id, ql.id into v_po2, v_ql
    from public.purchase_orders po
    join public.requests r on r.id = po.request_id
    join public.quote_lines ql on ql.quote_id = po.quote_id and ql.line_type = 'item'
   where r.title = 'Shipping cartons, 1,000 pcs' and po.buyer_org_id = o_startup
   limit 1;
  v_total := v_total + 1;
  if v_po2 is null then
    v_ok := false;
    v_lines := v_lines || '✗ Returns: the demo shipping cartons order is missing (run reset_demo_workspace first)'::text;
  else
    begin
      perform set_config('request.jwt.claim.sub', u_s1::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.update_order_status(v_po2, 'delivered');
      perform set_config('role', v_me, true);

      perform set_config('request.jwt.claim.sub', u_startup::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.pay_order(v_po2, 'e2e-' || v_po2 || '-balance');
      perform set_config('role', v_me, true);

      perform set_config('request.jwt.claim.sub', u_admin::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.settle_supplier(v_po2, 'e2e-' || v_po2 || '-payout-2');
      select coalesce(sum(net_amount), 0) into v_num from public.settlements where po_id = v_po2;
      perform set_config('role', v_me, true);

      perform set_config('request.jwt.claim.sub', u_s1::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      v_json := public.record_return(v_po2, v_ql, 100, 'Crushed in transit', 'e2e-' || v_po2 || '-return');
      perform set_config('role', v_me, true);

      v_ok := v_num = 11859
              and (v_json->>'supplier_credit')::numeric = 1062
              and (v_json->>'buyer_fee_reversal')::numeric = 21.24
              and (v_json->>'commission_reversal')::numeric = 53.10
              and (v_json->>'refund_due')::numeric = 1083.24;
      v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end
        || 'Return of 100 cartons (spec B2.1): supplier paid ₹' || v_num || ' in total; credit ₹' || (v_json->>'supplier_credit')
        || ', MPI fee back ₹' || (v_json->>'buyer_fee_reversal') || ', commission back ₹' || (v_json->>'commission_reversal')
        || ', refund due ₹' || (v_json->>'refund_due') || ', supplier owes MPI ₹' || (v_json->>'supplier_owes_mpi'));
    exception when others then
      perform set_config('role', v_me, true);
      v_ok := false;
      v_lines := v_lines || ('✗ Return of 100 cartons: ' || sqlerrm);
    end;
  end if;
  if v_ok then v_pass := v_pass + 1; end if;

  -- Offer comparison on the demo's mailer boxes (2 offers)
  select id into v_req2 from public.requests where org_id = o_startup and title = 'Printed mailer boxes, 2,000 pcs' limit 1;
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    select count(*), max(score), string_agg(supplier_alias || ' ' || score || '/100', ', ' order by rank)
      into v_int, v_num, v_txt
      from public.compare_offers(v_req2);
    v_ok := v_int = 2 and v_num <= 100;
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup compares 2 offers, scored out of 100 on total cost incl. MPI fee: ' || coalesce(v_txt, 'none'));
  exception when others then
    v_ok := false;
    v_lines := v_lines || ('✗ Offer comparison: ' || sqlerrm);
  end;
  if v_ok then v_pass := v_pass + 1; end if;

  v_total := v_total + 1;
  begin
    perform public.approve_quote((select id from public.quotes where request_id = v_req2 and status = 'submitted' limit 1), 1);
    v_ok := false;
    v_lines := v_lines || '✗ A quote could be approved at a price the startup never saw'::text;
  exception when others then
    v_ok := sqlerrm like '%price changed%';
    v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Approving refuses a price that changed since the startup saw it');
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s3::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s3, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  begin
    perform public.compare_offers(v_req2);
    v_ok := false;
    v_lines := v_lines || '✗ A supplier could see the comparison of competing offers'::text;
  exception when others then
    v_ok := true;
    v_lines := v_lines || '✓ Suppliers cannot see the comparison of competing offers'::text;
  end;
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select clients_last_month, current_pct into v_int, v_num
    from public.volume_status() where category_name = 'Packaging & Printing';
  v_ok := v_int = 10 and v_num = 10;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier sees its MPI volume: ' || coalesce(v_int::text, '?')
                         || ' clients last month, so MPI clients get ' || coalesce(v_num::text, '?') || '% off');
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  v_total := v_total + 1;
  select max(score) into v_int from public.request_matches;
  v_ok := v_int <= 100;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Match scores are out of 100 (highest now ' || coalesce(v_int::text, '?') || ')');
  if v_ok then v_pass := v_pass + 1; end if;

  -- ==========================================================================
  -- 6. A remote service request
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.requests (org_id, title, category_id, source, status, needed_by)
  values (o_startup, 'End-to-end check: landing page', v_it, 'ai_assisted', 'open', current_date + 30)
  returning id into v_req2;
  perform set_config('role', v_me, true);

  v_total := v_total + 1;
  select 'Works remotely, anywhere in India' = any (reasons), estimated_delivery_days into v_ok, v_int
    from public.request_matches where request_id = v_req2 and vendor_org_id = o_sv;
  v_ok := coalesce(v_ok, false);
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Remote service request: the service supplier is matched ("Works remotely"), delivery in about ' || coalesce(v_int::text, '?') || ' days');
  if v_ok then v_pass := v_pass + 1; end if;

  -- ==========================================================================
  -- 7. Government schemes
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', u_startup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_startup, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select count(*) into v_int from public.suggest_schemes(10);
  select g.short_name into v_txt from public.suggest_schemes(1) s join public.government_schemes g on g.id = s.scheme_id;
  v_ok := v_int >= 3;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Startup gets ' || v_int || ' scheme suggestions, top: ' || coalesce(v_txt, 'none'));
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  perform set_config('request.jwt.claim.sub', u_s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_s1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_total := v_total + 1;
  select count(*) into v_int from public.suggest_schemes(10);
  v_ok := v_int >= 1;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Supplier gets ' || v_int || ' scheme suggestions');
  if v_ok then v_pass := v_pass + 1; end if;
  perform set_config('role', v_me, true);

  -- ==========================================================================
  -- 8. Record keeping
  -- ==========================================================================
  v_total := v_total + 1;
  select count(distinct action) into v_int from public.audit_log
   where action in ('match.approved', 'quote.submitted', 'negotiation.counter', 'negotiation.accept', 'quote.approved')
     and created_at >= now() - interval '1 minute';
  v_ok := v_int = 5;
  v_lines := v_lines || (case when v_ok then '✓ ' else '✗ ' end || 'Every key step is written to the audit log (' || v_int || ' of 5)');
  if v_ok then v_pass := v_pass + 1; end if;

  -- ==========================================================================
  -- Report, then cancel everything
  -- ==========================================================================
  raise exception using
    message = format(E'MPI END-TO-END CHECK: %s of %s checks passed. Nothing was saved.\n\n%s',
                     v_pass, v_total,
                     -- failed checks first, so they show even when a tool cuts the message short
                     array_to_string(array(select l from unnest(v_lines) with ordinality as u(l, n)
                                            order by (l like '✗%') desc, n), E'\n'));
end;
$check$;
