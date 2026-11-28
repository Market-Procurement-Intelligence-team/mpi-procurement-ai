-- ============================================================================
-- MPI · Migration 20261128120000 · Freelancer matching and shortlists
--
-- Step 4 of the freelancer road: a service brief is matched with freelancers
-- as well as businesses, and startups can browse anonymous freelancer
-- profiles and shortlist them.
--
--   1. Matching: for a service brief, the AI also scores live freelancers out
--      of 100 (kind of service 25, skills 30, price fit 20, timing 15,
--      availability 10). A freelancer a little over the budget is still
--      suggested, with fewer points. The budget is never shown in a reason.
--      "Kind of provider" on the brief (any / business / freelancer) is
--      followed. Paused or unapproved profiles are left out. Businesses keep
--      their scoring exactly as before.
--   2. provider_shortlists: freelancers a startup has saved while browsing.
--      Only that startup sees its list.
--   3. request_picks: up to 3 shortlisted freelancers the startup adds to a
--      brief before sending it. They reach MPI as suggestions marked
--      suggested_by = 'buyer' ("Picked by the startup"). MPI still approves
--      every match; nothing reaches the freelancer before that.
--   4. Approved freelancers can be invited to a brief (they have no business
--      verification, so the invitation rule now accepts an approved
--      freelancer profile instead).
--
-- Run after 20261126120000_service_briefs.sql. Safe to run again.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. "Picked by the startup" on matches
-- ----------------------------------------------------------------------------
alter table public.request_matches drop constraint if exists request_matches_suggested_by_check;
alter table public.request_matches add constraint request_matches_suggested_by_check
  check (suggested_by in ('ai', 'admin', 'buyer'));


-- ----------------------------------------------------------------------------
-- 2. Who a startup may see and pick
-- ----------------------------------------------------------------------------

-- An approved, live freelancer in the caller's world (demo or real), while
-- freelancers are switched on. Same rule as the freelancer_directory view.
create or replace function app.is_browsable_provider(p_org_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_browse_freelancers()
     and exists (select 1
                   from public.organisations o
                   join public.provider_profiles p on p.org_id = o.id
                  where o.id = p_org_id
                    and o.provider_type = 'individual'
                    and p.status = 'active'
                    and (o.is_demo = coalesce(app.my_org_is_demo(), false) or app.is_admin()));
$$;
revoke execute on function app.is_browsable_provider(uuid) from public;
grant execute on function app.is_browsable_provider(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Tables
-- ----------------------------------------------------------------------------

-- Freelancers a startup saved while browsing (its own list, up to 30).
create table if not exists public.provider_shortlists (
  buyer_org_id    uuid not null references public.organisations (id) on delete cascade,
  provider_org_id uuid not null references public.organisations (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (buyer_org_id, provider_org_id)
);

-- Freelancers the startup picked for one brief (up to 3), set before sending.
create table if not exists public.request_picks (
  request_id      uuid not null references public.requests (id) on delete cascade,
  provider_org_id uuid not null references public.organisations (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (request_id, provider_org_id)
);

create or replace function app.check_shortlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.provider_shortlists where buyer_org_id = new.buyer_org_id) >= 30 then
    raise exception 'Your shortlist can hold up to 30 providers';
  end if;
  return new;
end;
$$;

drop trigger if exists check_shortlist on public.provider_shortlists;
create trigger check_shortlist before insert on public.provider_shortlists
  for each row execute function app.check_shortlist();

alter table public.provider_shortlists enable row level security;
alter table public.request_picks       enable row level security;

grant select, insert, delete on public.provider_shortlists to authenticated;
grant select on public.request_picks to authenticated;

drop policy if exists sl_select on public.provider_shortlists;
drop policy if exists sl_insert on public.provider_shortlists;
drop policy if exists sl_delete on public.provider_shortlists;
create policy sl_select on public.provider_shortlists for select to authenticated
  using (buyer_org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy sl_insert on public.provider_shortlists for insert to authenticated
  with check (buyer_org_id = (select app.my_org_id()) and app.is_browsable_provider(provider_org_id));
create policy sl_delete on public.provider_shortlists for delete to authenticated
  using (buyer_org_id = (select app.my_org_id()));

-- Picks are changed only through set_request_picks() below.
drop policy if exists rp_select on public.request_picks;
create policy rp_select on public.request_picks for select to authenticated
  using (app.owns_request(request_id) or (select app.is_admin()));


-- ----------------------------------------------------------------------------
-- 4. How well a freelancer fits a brief, out of 100
-- ----------------------------------------------------------------------------
create or replace function app.provider_fit(p_request_id uuid, p_org_id uuid,
                                            out score integer, out reasons text[], out days integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_req      public.requests%rowtype;
  v_p        public.provider_profiles%rowtype;
  v_city     text;
  v_cat_name text;
  v_wanted   integer;
  v_have     integer;
  v_names    text[];
  v_price    numeric;
  v_turn     integer;
begin
  select * into v_req from public.requests where id = p_request_id;
  select * into v_p from public.provider_profiles where org_id = p_org_id;
  select city into v_city from public.organisations where id = p_org_id;
  select name into v_cat_name from public.catalogue_categories where id = v_req.category_id;
  score := 0;
  reasons := '{}';

  -- Kind of service: 25
  if exists (select 1 from public.vendor_categories vc
              where vc.vendor_org_id = p_org_id and vc.category_id = v_req.category_id) then
    score := score + 25;
    reasons := reasons || ('Works in ' || coalesce(v_cat_name, 'this service'));
  else
    reasons := reasons || ('Does not list ' || coalesce(v_cat_name, 'this service'));
  end if;

  -- Skills the brief asks for: 30
  v_wanted := cardinality(v_req.skill_ids);
  if v_wanted = 0 then
    score := score + 18;
  else
    select count(*), array_agg(s.name order by s.sort_order, s.name)
      into v_have, v_names
      from public.provider_skills ps join public.skills s on s.id = ps.skill_id
     where ps.org_id = p_org_id and ps.skill_id = any (v_req.skill_ids);
    score := score + round(30.0 * v_have / v_wanted)::integer;
    if v_have = 0 then
      reasons := reasons || 'None of the skills asked for'::text;
    elsif v_have = v_wanted then
      reasons := reasons || ('Has ' || array_to_string(v_names[1:3], ', '));
    else
      reasons := reasons || ('Has ' || v_have || ' of ' || v_wanted || ' skills asked for');
    end if;
  end if;

  -- Price fit: 20. Uses the cheapest active package for this kind of service.
  -- The reason never shows the budget.
  select pk.price, pk.turnaround_days into v_price, v_turn
    from public.provider_packages pk
   where pk.org_id = p_org_id and pk.is_active and pk.category_id = v_req.category_id
   order by pk.price limit 1;
  if v_price is null then
    score := score + 6;
    reasons := reasons || 'No package for this service yet'::text;
  elsif v_req.budget_max is null then
    score := score + 14;
    reasons := reasons || ('Packages from ₹' || to_char(v_price, 'FM999,999,999'));
  elsif v_price <= v_req.budget_max then
    score := score + 20;
    reasons := reasons || 'Package price fits'::text;
  elsif v_price <= v_req.budget_max * 1.25 then
    score := score + 10;
    reasons := reasons || 'Package price a little above the range'::text;
  else
    reasons := reasons || 'Package price above the range'::text;
  end if;

  -- Timing: 15. Package turnaround, else their usual time, plus extra when
  -- they have limited time.
  days := coalesce(v_turn, v_p.usual_delivery_days, 14);
  if v_p.availability = 'limited' then
    days := days + ceil(days * 0.3)::integer;
  end if;
  if v_req.needed_by is null then
    score := score + 10;
    reasons := reasons || ('Can finish in about ' || days || ' days');
  elsif current_date + days <= v_req.needed_by then
    score := score + 15;
    reasons := reasons || ('Can finish in about ' || days || ' days, before your date');
  else
    reasons := reasons || ('May be ' || (current_date + days - v_req.needed_by) || ' days late');
  end if;

  -- Free to take work: 10
  if v_p.availability = 'available' then
    score := score + 10;
    reasons := reasons || 'Available now'::text;
  elsif v_p.availability = 'limited' then
    score := score + 5;
    reasons := reasons || 'Limited time right now'::text;
  else
    reasons := reasons || 'Busy right now'::text;
  end if;

  -- Place: no points, but worth knowing.
  if v_req.delivery_city is not null then
    if v_p.work_mode = 'remote' then
      reasons := reasons || 'Works remotely only'::text;
    elsif v_city is not distinct from v_req.delivery_city then
      reasons := reasons || ('Based in ' || v_city);
    end if;
  end if;

  score := least(score, 100);
end;
$$;
revoke execute on function app.provider_fit(uuid, uuid) from public;


-- ----------------------------------------------------------------------------
-- 5. Suggestions for a request (replaces the money-engine version)
--    Businesses: unchanged. Freelancers: only for service briefs.
--    Startup picks: added on top, marked 'buyer', never trimmed.
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
  v_fit      record;
  v_open     boolean;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Request not found';
  end if;
  select is_demo into v_demo from public.organisations where id = v_req.org_id;
  select name, is_tangible into v_cat_name, v_tangible from public.catalogue_categories where id = v_req.category_id;
  v_remote := coalesce(v_tangible, false) = false
              and v_req.delivery_city is null and v_req.delivery_state is null;
  v_open := coalesce((select freelancers_enabled from public.platform_settings), false);

  delete from public.request_matches where request_id = p_request_id and status = 'suggested';

  -- Businesses (skipped when the brief asks for freelancers only)
  for v_c in
    select o.id, o.city, o.state, vd.certifications, vd.lead_time_days,
           vd.capacity_utilisation_pct, vd.pan_india_dispatch
      from public.organisations o
      join public.vendor_details vd on vd.org_id = o.id
     where o.type = 'vendor'
       and o.provider_type = 'business'
       and o.verification_status = 'verified'
       and o.is_demo = v_demo
       and not (v_req.kind = 'service' and v_req.provider_preference = 'freelancer')
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

    -- Delivery: 20
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

  -- Freelancers: service briefs only, while freelancers are switched on
  if v_req.kind = 'service' and v_req.provider_preference <> 'business' and v_open
     and v_req.category_id is not null then
    for v_c in
      select o.id
        from public.organisations o
        join public.provider_profiles p on p.org_id = o.id
       where o.provider_type = 'individual'
         and p.status = 'active'
         and o.is_demo = v_demo
         and exists (select 1 from public.vendor_categories vc
                      where vc.vendor_org_id = o.id and vc.category_id = v_req.category_id)
         and not exists (select 1 from public.request_matches m
                          where m.request_id = p_request_id and m.vendor_org_id = o.id)
    loop
      v_fit := app.provider_fit(p_request_id, v_c.id);
      insert into public.request_matches
        (request_id, vendor_org_id, score, reasons, estimated_delivery_days, estimated_delivery_date)
      values
        (p_request_id, v_c.id, v_fit.score, v_fit.reasons, v_fit.days, current_date + v_fit.days);
    end loop;
  end if;

  -- Keep the 5 best AI suggestions.
  delete from public.request_matches m
   using (select id, row_number() over (order by score desc, estimated_delivery_days, created_at) as rn
            from public.request_matches
           where request_id = p_request_id and status = 'suggested' and suggested_by = 'ai') ranked
   where m.id = ranked.id and ranked.rn > 5;

  -- The startup's own picks: mark them, or add them if the AI left them out.
  if v_req.kind = 'service' and v_open then
    update public.request_matches m
       set suggested_by = 'buyer'
     where m.request_id = p_request_id and m.status = 'suggested'
       and m.vendor_org_id in (select rp.provider_org_id from public.request_picks rp where rp.request_id = p_request_id);

    for v_c in
      select rp.provider_org_id as id
        from public.request_picks rp
        join public.organisations o on o.id = rp.provider_org_id
        join public.provider_profiles p on p.org_id = o.id
       where rp.request_id = p_request_id
         and p.status = 'active'
         and o.is_demo = v_demo
         and not exists (select 1 from public.request_matches m
                          where m.request_id = p_request_id and m.vendor_org_id = rp.provider_org_id)
    loop
      v_fit := app.provider_fit(p_request_id, v_c.id);
      insert into public.request_matches
        (request_id, vendor_org_id, score, reasons, estimated_delivery_days, estimated_delivery_date, suggested_by)
      values
        (p_request_id, v_c.id, v_fit.score, v_fit.reasons, v_fit.days, current_date + v_fit.days, 'buyer');
    end loop;
  end if;

  select count(*) into v_count
    from public.request_matches where request_id = p_request_id and status = 'suggested';
  return v_count;
end;
$$;
revoke execute on function app.suggest_matches_for(uuid) from public;


-- ----------------------------------------------------------------------------
-- 6. Startup: choose the shortlisted freelancers for a brief (before sending)
-- ----------------------------------------------------------------------------
create or replace function public.set_request_picks(p_request_id uuid, p_org_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req public.requests%rowtype;
  v_id  uuid;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_org_ids, '{}')) x);
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null or not app.owns_request(p_request_id) then
    raise exception 'Not allowed';
  end if;
  if v_req.kind <> 'service' then
    raise exception 'Only a service brief can have picked providers';
  end if;
  if v_req.status <> 'draft' then
    raise exception 'Picks can only be changed before the brief is sent';
  end if;
  if cardinality(v_ids) > 3 then
    raise exception 'You can pick up to 3 providers for a brief';
  end if;
  foreach v_id in array v_ids loop
    if not app.is_browsable_provider(v_id) then
      raise exception 'One of the picked providers is not available';
    end if;
  end loop;

  delete from public.request_picks where request_id = p_request_id and provider_org_id <> all (v_ids);
  insert into public.request_picks (request_id, provider_org_id)
  select p_request_id, x from unnest(v_ids) x
  on conflict do nothing;
end;
$$;
revoke execute on function public.set_request_picks(uuid, uuid[]) from public, anon;
grant execute on function public.set_request_picks(uuid, uuid[]) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Invitations: an approved freelancer counts like a verified business
--    (replaces the matching-negotiation version; the other rules stay)
-- ----------------------------------------------------------------------------
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

  if v_vendor.type <> 'vendor'
     or not (v_vendor.verification_status = 'verified'
             or (v_vendor.provider_type = 'individual'
                 and exists (select 1 from public.provider_profiles p
                              where p.org_id = v_vendor.id and p.status = 'active'))) then
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
-- Quick look after running: how many freelancers a service brief can match now.
-- ----------------------------------------------------------------------------
select (select count(*) from public.provider_profiles where status = 'active') as live_freelancers,
       (select freelancers_enabled from public.platform_settings) as freelancers_on;
