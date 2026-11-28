-- ============================================================================
-- MPI · Migration 20261129120000 · Freelancer proposals
--
-- Step 5 of the freelancer road. Once MPI approves a match, the freelancer
-- replies to the brief with a PROPOSAL; the startup compares up to 3, can ask
-- for a change, and hires one.
--
-- A proposal is saved as a normal quote, so price offers (24 hours, 3 per
-- quote, price only), MPI's fee, "You receive", and hiring (approve_quote)
-- all work exactly as for goods. Each deliverable of the brief is a request
-- line; the freelancer prices each one, and that split is the milestone plan
-- that step 6 pays out one milestone at a time.
--
--   1. quotes: revision_rounds and package_id (the package the freelancer
--      started from). The cover note is quotes.notes, the time is
--      quotes.lead_time_days.
--   2. A freelancer's proposal can only be sent with a price on every
--      deliverable and the number of days.
--   3. invitation_declines: "not for me" with a short reason, seen by the
--      freelancer and MPI only (never the startup).
--   4. proposal_changes: the startup asks for a change that is not about
--      price (scope, days, revisions). At most 3 per proposal, one open at a
--      time. The freelancer's next version answers it.
--   5. proposal_preview: what the freelancer receives for a price, before
--      sending (same fee rule and payment terms as the real quote).
--   6. compare_proposals: proposals on a brief scored out of 100 (price 40,
--      skills fit 25, time 25, rounds of changes 10). Sample weights.
--   7. An agreed price offer reissues a proposal with its rounds of changes,
--      package and cover note kept (goods quotes are unchanged).
--
-- Run after 20261128120000_freelancer_matching.sql. Safe to run again.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Proposal fields on quotes
-- ----------------------------------------------------------------------------
alter table public.quotes
  add column if not exists revision_rounds smallint,
  add column if not exists package_id uuid references public.provider_packages (id) on delete set null;

alter table public.quotes drop constraint if exists quotes_revision_rounds_check;
alter table public.quotes add constraint quotes_revision_rounds_check
  check (revision_rounds is null or revision_rounds between 0 and 10);

comment on column public.quotes.revision_rounds is 'Proposal: rounds of changes included.';
comment on column public.quotes.package_id is 'Proposal: the freelancer package it started from (optional).';

grant update (revision_rounds, package_id) on public.quotes to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Rules for a freelancer's proposal
-- ----------------------------------------------------------------------------
create or replace function app.check_proposal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_individual boolean;
  v_missing    integer;
begin
  select o.provider_type = 'individual' into v_individual
    from public.organisations o where o.id = new.vendor_org_id;
  if not coalesce(v_individual, false) then
    return new;
  end if;

  if new.package_id is not null
     and not exists (select 1 from public.provider_packages p
                      where p.id = new.package_id and p.org_id = new.vendor_org_id) then
    raise exception 'That package is not yours';
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    if new.lead_time_days is null or new.lead_time_days < 1 then
      raise exception 'Add how many days the work takes';
    end if;
    select count(*) into v_missing
      from public.request_lines rl
     where rl.request_id = new.request_id
       and not exists (select 1 from public.quote_lines ql
                        where ql.quote_id = new.id and ql.request_line_id = rl.id and ql.unit_price > 0);
    if v_missing > 0 or not exists (select 1 from public.quote_lines ql where ql.quote_id = new.id) then
      raise exception 'Put a price on every deliverable before sending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_proposal on public.quotes;
create trigger check_proposal
  before insert or update on public.quotes
  for each row execute function app.check_proposal();


-- ----------------------------------------------------------------------------
-- 3. Declining a brief, with a reason only MPI sees
-- ----------------------------------------------------------------------------
create table if not exists public.invitation_declines (
  invitation_id uuid primary key references public.rfq_invitations (id) on delete cascade,
  vendor_org_id uuid not null references public.organisations (id) on delete cascade,
  reason        text check (reason is null or char_length(reason) <= 300),
  created_at    timestamptz not null default now()
);

alter table public.invitation_declines enable row level security;
grant select on public.invitation_declines to authenticated;

drop policy if exists invd_select on public.invitation_declines;
create policy invd_select on public.invitation_declines for select to authenticated using (
  vendor_org_id = (select app.my_org_id()) or (select app.is_admin())
);

create or replace function public.decline_invitation(p_invitation_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.rfq_invitations%rowtype;
  v_title text;
begin
  select * into v_inv from public.rfq_invitations where id = p_invitation_id for update;
  if v_inv.id is null or v_inv.vendor_org_id is distinct from app.my_org_id() then
    raise exception 'Not allowed';
  end if;
  if v_inv.status not in ('invited', 'viewed') then
    raise exception 'You already replied to this brief';
  end if;

  update public.rfq_invitations set status = 'declined', responded_at = now() where id = v_inv.id;
  insert into public.invitation_declines (invitation_id, vendor_org_id, reason)
  values (v_inv.id, v_inv.vendor_org_id, nullif(btrim(left(coalesce(p_reason, ''), 300)), ''))
  on conflict (invitation_id) do update set reason = excluded.reason, created_at = now();

  select title into v_title from public.requests where id = v_inv.request_id;
  perform app.notify_admins('invitation_declined', 'A provider declined a brief', v_title,
                            '/admin/matches?r=' || v_inv.request_id);
  perform app.audit('invitation.declined', 'rfq_invitation', v_inv.id,
                    jsonb_build_object('request_id', v_inv.request_id));
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Asking for a change (not price)
-- ----------------------------------------------------------------------------
create table if not exists public.proposal_changes (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references public.quotes (id) on delete cascade,
  request_id        uuid not null references public.requests (id) on delete cascade,
  buyer_org_id      uuid not null references public.organisations (id) on delete cascade,
  vendor_org_id     uuid not null references public.organisations (id) on delete cascade,
  message           text not null check (char_length(message) between 3 and 1000),
  status            text not null default 'open' check (status in ('open', 'answered', 'closed')),
  answered_quote_id uuid references public.quotes (id) on delete set null,
  answered_at       timestamptz,
  created_by        uuid default auth.uid() references public.profiles (id),
  created_at        timestamptz not null default now()
);
create index if not exists proposal_changes_request_idx on public.proposal_changes (request_id);
create unique index if not exists proposal_changes_one_open
  on public.proposal_changes (request_id, vendor_org_id) where status = 'open';

alter table public.proposal_changes enable row level security;
grant select on public.proposal_changes to authenticated;

drop policy if exists pc_select on public.proposal_changes;
create policy pc_select on public.proposal_changes for select to authenticated using (
  buyer_org_id = (select app.my_org_id())
  or vendor_org_id = (select app.my_org_id())
  or (select app.is_admin())
);

create or replace function public.ask_for_change(p_quote_id uuid, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_q    public.quotes%rowtype;
  v_req  public.requests%rowtype;
  v_msg  text := btrim(coalesce(p_message, ''));
  v_id   uuid;
begin
  select * into v_q from public.quotes where id = p_quote_id for update;
  if v_q.id is null then
    raise exception 'Proposal not found';
  end if;
  select * into v_req from public.requests where id = v_q.request_id;
  if app.my_role() is distinct from 'startup' or v_req.org_id is distinct from app.my_org_id() then
    raise exception 'Not allowed';
  end if;
  if v_req.kind <> 'service' then
    raise exception 'Changes can be asked only on a service brief';
  end if;
  if v_req.status not in ('open', 'comparing') then
    raise exception 'This brief is already closed';
  end if;
  if v_q.status <> 'submitted' then
    raise exception 'Only a sent proposal can be changed';
  end if;
  if char_length(v_msg) < 3 then
    raise exception 'Say what you would like changed';
  end if;
  if exists (select 1 from public.proposal_changes c
              where c.request_id = v_req.id and c.vendor_org_id = v_q.vendor_org_id and c.status = 'open') then
    raise exception 'You already asked for a change. Wait for the new version first.';
  end if;
  if exists (select 1 from public.quote_negotiations n where n.quote_id = v_q.id and n.status = 'open') then
    raise exception 'Wait for the reply to your price offer first';
  end if;
  if (select count(*) from public.proposal_changes c
       where c.request_id = v_req.id and c.vendor_org_id = v_q.vendor_org_id) >= 3 then
    raise exception 'You can ask for a change at most 3 times';
  end if;

  insert into public.proposal_changes (quote_id, request_id, buyer_org_id, vendor_org_id, message)
  values (v_q.id, v_req.id, v_req.org_id, v_q.vendor_org_id, left(v_msg, 1000))
  returning id into v_id;

  perform app.notify_org(v_q.vendor_org_id, 'proposal_change', 'The startup asked for a change',
                         v_req.title, '/supplier/requests/' || v_q.invitation_id);
  perform app.audit('proposal.change_asked', 'quote', v_q.id, jsonb_build_object('request_id', v_req.id));
  return v_id;
end;
$$;

-- The freelancer's next version answers the open change (a version made by
-- an agreed price offer does not).
create or replace function app.after_proposal_sent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted')
     and coalesce(current_setting('mpi.price_revision', true), '') <> 'on' then
    update public.proposal_changes
       set status = 'answered', answered_quote_id = new.id, answered_at = now()
     where request_id = new.request_id and vendor_org_id = new.vendor_org_id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists after_proposal_sent on public.quotes;
create trigger after_proposal_sent
  after insert or update of status on public.quotes
  for each row execute function app.after_proposal_sent();

-- Once a brief is hired or cancelled, open changes are closed.
create or replace function app.close_proposal_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('ordered', 'cancelled') and old.status is distinct from new.status then
    update public.proposal_changes set status = 'closed'
     where request_id = new.id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists close_proposal_changes on public.requests;
create trigger close_proposal_changes
  after update of status on public.requests
  for each row execute function app.close_proposal_changes();


-- ----------------------------------------------------------------------------
-- 5. "You receive" before sending
-- ----------------------------------------------------------------------------
create or replace function public.proposal_preview(p_invitation_id uuid, p_price numeric, p_tax_rate numeric default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_inv   public.rfq_invitations%rowtype;
  v_cat   uuid;
  v_rule  public.fee_rules%rowtype;
  v_vol   numeric;
  v_terms text;
  v_calc  jsonb;
begin
  select * into v_inv from public.rfq_invitations where id = p_invitation_id;
  if v_inv.id is null or v_inv.vendor_org_id is distinct from app.my_org_id() then
    raise exception 'Not allowed';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Enter a price';
  end if;
  select category_id into v_cat from public.requests where id = v_inv.request_id;
  v_rule  := app.fee_rule_for(v_cat);
  v_terms := app.payment_terms_label(v_cat);
  select coalesce(t.pct, 0) into v_vol from app.volume_tier(v_inv.vendor_org_id, v_cat, now()) t;
  v_calc := app.money_calc(
    jsonb_build_object(
      'lines', jsonb_build_array(jsonb_build_object('amount', round(p_price, 2),
                                                    'tax_rate', least(greatest(coalesce(p_tax_rate, 0), 0), 100),
                                                    'kind', 'eligible')),
      'volume_pct', coalesce(v_vol, 0),
      'negotiated_pct', 0,
      'tax_mode', coalesce(v_rule.supplier_tax_mode, 'forward'),
      'schedule', app.terms_schedule(v_terms))
    || app.fee_rule_json(v_rule));
  return jsonb_build_object(
    'supplier', v_calc->'supplier',
    'payment_terms', v_terms,
    'fee_rule', jsonb_build_object('version', v_rule.version, 'needs_review', v_rule.needs_review,
                                   'commission_pct', case when v_rule.supplier_commission_enabled
                                                          then v_rule.supplier_commission_pct else 0 end));
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. Comparing proposals on a brief
-- ----------------------------------------------------------------------------
create or replace function public.compare_proposals(p_request_id uuid)
returns table (quote_id uuid, provider_alias text, is_freelancer boolean, total_cost numeric, checkout_total numeric,
               days integer, revision_rounds integer, price_points numeric, fit_points numeric,
               time_points numeric, revision_points numeric, score integer, rank integer,
               budget_fit text, reasons text[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Request not found';
  end if;
  if not (app.is_admin() or app.my_org_id() = v_req.org_id) then
    raise exception 'Not allowed';
  end if;

  return query
  with q as (
    select qt.id, o.display_name, o.provider_type = 'individual' as indiv,
           qt.lead_time_days as lead, qt.revision_rounds::integer as revs,
           app.quote_calc(qt.id) as calc,
           case when cardinality(v_req.skill_ids) = 0 then 1.0
                when o.provider_type = 'individual'
                  then (select count(*) from public.provider_skills ps
                         where ps.org_id = o.id and ps.skill_id = any (v_req.skill_ids))::numeric
                       / cardinality(v_req.skill_ids)
                else 0.6 end as fit_share
      from public.quotes qt
      join public.organisations o on o.id = qt.vendor_org_id
     where qt.request_id = p_request_id and qt.status = 'submitted'
  ), c as (
    select q.*,
           (q.calc->'buyer'->>'total_cost')::numeric as cost,
           (q.calc->'buyer'->>'checkout_total')::numeric as checkout,
           case when v_req.revision_rounds is null or v_req.revision_rounds = 0 then 1.0
                when q.revs is null then 0.5
                else least(q.revs::numeric / v_req.revision_rounds, 1) end as rev_share,
           v_req.needed_by is not null and q.lead is not null and current_date + q.lead > v_req.needed_by as late
      from q
  ), b as (
    select min(cost) as min_cost, min(coalesce(lead, 9999)) as min_lead from c
  ), s as (
    select c.*,
           round(40 * b.min_cost / nullif(c.cost, 0), 1) as p_pts,
           round(25 * c.fit_share, 1) as f_pts,
           round(25 * case when c.lead is null then 0.5 else b.min_lead::numeric / greatest(c.lead, 1) end
                      * case when c.late then 0.5 else 1 end, 1) as t_pts,
           round(10 * c.rev_share, 1) as r_pts
      from c cross join b
  )
  select s.id, s.display_name, s.indiv, s.cost, s.checkout, s.lead, s.revs,
         s.p_pts, s.f_pts, s.t_pts, s.r_pts,
         least(round(coalesce(s.p_pts, 0) + s.f_pts + s.t_pts + s.r_pts), 100)::integer,
         (rank() over (order by (coalesce(s.p_pts, 0) + s.f_pts + s.t_pts + s.r_pts) desc, s.cost))::integer,
         case when v_req.budget_max is null then null
              when s.cost <= v_req.budget_max then 'within'
              when s.cost <= v_req.budget_max * 1.25 then 'a_little_above'
              else 'above' end,
         array_remove(array[
           case when s.cost = (select min_cost from b) then 'Lowest total cost' end,
           case when s.lead is not null then 'Finishes in ' || s.lead || ' days' end,
           case when s.late then 'May miss your date' end,
           case when cardinality(v_req.skill_ids) > 0 and s.fit_share >= 1 then 'Has all the skills you asked for' end,
           case when s.revs is not null then s.revs || ' rounds of changes' end
         ], null)
    from s
   order by 13;
end;
$$;


-- ----------------------------------------------------------------------------
-- 7. A price agreed in negotiation keeps the proposal's details
-- ----------------------------------------------------------------------------
create or replace function app.revise_quote_to_total(p_quote_id uuid, p_total numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old  public.quotes%rowtype;
  v_new  uuid;
  v_base numeric;
  v_calc jsonb;
  v_pct  numeric;
  v_prop boolean;
begin
  select * into v_old from public.quotes where id = p_quote_id;
  v_prop := v_old.revision_rounds is not null or v_old.package_id is not null
            or exists (select 1 from public.organisations o
                        where o.id = v_old.vendor_org_id and o.provider_type = 'individual');

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
                             volume_discount_pct, volume_rate_card_id, volume_clients, supplier_tax_mode, price_terms_locked,
                             revision_rounds, package_id)
  select v_old.invitation_id, v_old.request_id, v_old.vendor_org_id,
         (select max(version) + 1 from public.quotes where invitation_id = v_old.invitation_id),
         'draft', v_old.currency, v_old.lead_time_days, v_old.payment_terms, v_old.valid_until,
         case when v_prop then v_old.notes else 'Revised price agreed in negotiation' end, v_old.created_by,
         v_old.volume_discount_pct, v_old.volume_rate_card_id, v_old.volume_clients, v_old.supplier_tax_mode, true,
         v_old.revision_rounds, v_old.package_id
  returning id into v_new;
  perform set_config('mpi.copy_price_terms', 'off', true);

  insert into public.quote_lines (quote_id, request_line_id, line_type, description, quantity, unit_price, tax_rate, sort_order, pass_through)
  select v_new, request_line_id, line_type, description, quantity, unit_price, tax_rate, sort_order, pass_through
    from public.quote_lines where quote_id = p_quote_id;

  perform set_config('mpi.price_revision', 'on', true);
  update public.quotes set discount_pct = v_pct, status = 'submitted' where id = v_new;
  perform set_config('mpi.price_revision', 'off', true);
  return v_new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. Who may run what
-- ----------------------------------------------------------------------------
revoke execute on function app.check_proposal() from public;
revoke execute on function app.after_proposal_sent() from public;
revoke execute on function app.close_proposal_changes() from public;
revoke execute on function app.revise_quote_to_total(uuid, numeric) from public;
revoke execute on function public.decline_invitation(uuid, text) from public, anon;
revoke execute on function public.ask_for_change(uuid, text) from public, anon;
revoke execute on function public.proposal_preview(uuid, numeric, numeric) from public, anon;
revoke execute on function public.compare_proposals(uuid) from public, anon;
grant execute on function public.decline_invitation(uuid, text) to authenticated;
grant execute on function public.ask_for_change(uuid, text) to authenticated;
grant execute on function public.proposal_preview(uuid, numeric, numeric) to authenticated;
grant execute on function public.compare_proposals(uuid) to authenticated;
