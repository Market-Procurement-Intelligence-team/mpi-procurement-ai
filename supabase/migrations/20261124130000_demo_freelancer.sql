-- ============================================================================
-- MPI · Migration 20261124130000 · Demo freelancer
--
-- Adds a demo freelancer to the demo workspace: a UI/UX and Shopify
-- freelancer in Pune with a full, approved profile (skills, projects, work
-- history, a course, three packages, PAN and bank checked).
--
-- Needs one more demo login, made in Supabase Auth like the others:
--   mpi-demofreelancer@example.com
-- Until that login exists, the reset simply skips the freelancer and says so.
--
-- Startups see the demo freelancer only while freelancers are switched on
-- (admin Profile > Settings > Freelancers).
--
-- The earlier reset stays as it is and runs first.
-- Run after 20261124120000_freelancer_providers.sql.
-- ============================================================================

alter function public.reset_demo_workspace() set schema app;
alter function app.reset_demo_workspace() rename to reset_demo_workspace_money;
revoke execute on function app.reset_demo_workspace_money() from public, anon, authenticated;

create or replace function public.reset_demo_workspace() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_base  text;
  v_user  uuid;
  v_org   uuid;
  v_it    uuid;
  v_mkt   uuid;
  v_pack  uuid;
begin
  if session_user = 'authenticator' and not app.is_admin() then
    raise exception 'Not allowed';
  end if;

  v_base := app.reset_demo_workspace_money();

  select id, org_id into v_user, v_org from public.profiles where email = 'mpi-demofreelancer@example.com';
  if v_user is null then
    return v_base || ' Demo freelancer skipped: create the login mpi-demofreelancer@example.com in Supabase Auth, then reset again.';
  end if;

  select id into v_it   from public.catalogue_categories where slug = 'it-and-digital-services';
  select id into v_mkt  from public.catalogue_categories where slug = 'marketing-and-sales-support';
  select id into v_pack from public.catalogue_categories where slug = 'packaging-and-printing';

  -- The login was made in Supabase Auth, so it starts as a startup. Turn it
  -- into a one-person supplier (freelancer).
  update public.profiles set role = 'vendor', full_name = 'Riya Deshmukh (demo)' where id = v_user;
  update public.organisations o
     set type = 'vendor', is_demo = true, provider_type = 'individual',
         verification_status = 'not_required', verification_note = null,
         display_name = case when o.display_name like 'MPI Verified Supplier #%' then o.display_name
                             else 'MPI Verified Supplier #' || lpad(nextval('public.supplier_code_seq')::text, 3, '0') end,
         name = 'Demo · Riya Deshmukh', city = 'Pune', state = 'Maharashtra', gstin = null, udyam_number = null
   where o.id = v_org;
  delete from public.startup_details where org_id = v_org;
  insert into public.vendor_details (org_id) values (v_org) on conflict (org_id) do nothing;
  update public.vendor_details set pan_number = 'DEMOP0000F', enterprise_type = null where org_id = v_org;

  -- Start the profile again from nothing.
  delete from public.provider_profiles where org_id = v_org;  -- removes skills, projects and the rest too
  delete from public.vendor_categories where vendor_org_id = v_org;
  delete from public.notifications where user_id = v_user;

  insert into public.provider_profiles (
    org_id, headline, bio, years_experience, languages, tools, work_mode, service_area, availability,
    max_parallel_projects, usual_delivery_days, legal_name, payout_reference,
    status, submitted_at, reviewed_at, payout_status)
  values (
    v_org,
    'UI/UX designer and Shopify developer for D2C brands',
    'I design and build online stores and app screens for small consumer brands. Six years of work with food, '
      || 'beauty and home brands: research, wireframes, final designs in Figma, and Shopify stores that are easy '
      || 'for the founder to run. I work remotely and share progress every few days.',
    6,
    '[{"name": "English", "level": "fluent"}, {"name": "Hindi", "level": "fluent"}, {"name": "Marathi", "level": "native"}]',
    array['Figma', 'Shopify', 'Webflow', 'Canva', 'Google Analytics'],
    'remote', 'Anywhere in India', 'available', 3, 10,
    'Riya Deshmukh (demo)', 'demo-payout-ref-001',
    'active', now() - interval '3 days', now() - interval '2 days', 'verified');

  insert into public.vendor_categories (vendor_org_id, category_id) values (v_org, v_it), (v_org, v_mkt);

  insert into public.provider_skills (org_id, skill_id, level, years)
  select v_org, s.id, v.level, v.years
    from (values ('ui-ux-design', 'expert', 6), ('shopify-woocommerce', 'expert', 4),
                 ('web-development', 'intermediate', 3), ('product-photos', 'beginner', 1)) as v(slug, level, years)
    join public.skills s on s.slug = v.slug;

  insert into public.provider_projects (org_id, title, category_id, role_and_work, tools, result, year, link,
                                        client_kind, client_name, sort_order)
  values
    (v_org, 'Shopify store for a millet snacks brand', v_it,
     'Designed and built the whole store: home page, product pages, bundles and checkout.',
     array['Figma', 'Shopify'], 'Orders from the site went up about 40% in three months.', 2025,
     'https://example.com/demo-portfolio/millet-store', 'D2C food startup', 'Demo Millet Foods Pvt Ltd', 1),
    (v_org, 'Booking app screens for a salon chain', v_it,
     'User research with 8 customers, wireframes, and 24 final screens handed over to the developers.',
     array['Figma'], 'Launched in 4 cities.', 2024,
     'https://example.com/demo-portfolio/salon-app', 'Beauty services company', 'Demo Glow Salons LLP', 2),
    (v_org, 'Product photo refresh for a candle brand', v_mkt,
     'Planned the shoot and edited 60 product photos for the store and Instagram.',
     array['Lightroom', 'Canva'], null, 2024, null, 'Home decor startup', 'Demo Wick & Co', 3);

  insert into public.provider_experience (org_id, role_title, company_kind, company_name, started_on, ended_on, description)
  values
    (v_org, 'Freelance UI/UX designer', 'Self-employed', null, date '2022-06-01', null,
     'Design and Shopify work for small consumer brands.'),
    (v_org, 'Product designer', 'E-commerce agency, 40 people', 'Demo Pixel Agency Pvt Ltd', date '2019-07-01', date '2022-05-31',
     'Designed stores and apps for 15+ clients; led the design team of 3.');

  insert into public.provider_credentials (org_id, kind, title, issuer, year, link)
  values
    (v_org, 'course', 'Google UX Design Certificate', 'Coursera', 2021, 'https://example.com/demo-certificate'),
    (v_org, 'education', 'B.Des. Communication Design', 'Demo Institute of Design, Pune', 2019, null);

  insert into public.provider_packages (org_id, category_id, title, deliverables, exclusions, price, revision_rounds,
                                        turnaround_days, sort_order)
  values
    (v_org, v_it, 'Shopify store setup',
     array['Theme set up in your brand colours', 'Up to 15 products added', 'Payment and shipping set up', '30-minute handover call'],
     array['Product photos', 'Paid apps and theme cost'], 25000, 2, 10, 1),
    (v_org, v_it, 'App or website screens in Figma',
     array['Up to 10 screens', 'Clickable prototype', 'Design files handed over'],
     array['Building the app'], 18000, 3, 7, 2),
    (v_org, v_mkt, 'Product photo editing (30 photos)',
     array['Background clean-up', 'Colour correction', 'Sizes for store and Instagram'],
     array['The photo shoot'], 6000, 1, 4, 3);

  insert into public.provider_verifications (org_id, kind, status, evidence_ref, verified_at)
  values (v_org, 'identity_pan', 'verified', 'Demo PAN card', now() - interval '2 days'),
         (v_org, 'bank', 'verified', 'Demo bank details', now() - interval '2 days'),
         (v_org, 'credential', 'pending', 'Google UX certificate link', null);
  -- Adding the bank check sets the payout to pending; it is already checked.
  update public.provider_profiles set payout_status = 'verified' where org_id = v_org;

  return v_base || ' Freelancers: 1 demo freelancer with an approved profile (shown to startups while freelancers are switched on).';
end;
$$;

revoke execute on function public.reset_demo_workspace() from public, anon;
grant  execute on function public.reset_demo_workspace() to authenticated;

-- Reload the demo now.
select public.reset_demo_workspace();

-- ============================================================================
-- End of migration
-- ============================================================================
