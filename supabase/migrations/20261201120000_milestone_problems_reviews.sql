-- ============================================================================
-- MPI · Freelancers step 6b: problems, auto-accept and reviews
--
-- 1. Raise a problem with MPI. Either side of a service order can raise a
--    problem on a paid milestone that is not paid out yet: a reason, a
--    description and links. While it is open the milestone cannot be
--    accepted (by hand or automatically), submitted or paid out. MPI's admin
--    resolves it: pay the provider (the milestone counts as accepted and goes
--    to "Payouts to send"), refund the startup (simulated, the milestone is
--    closed), or send it back to work. Every decision is logged.
-- 2. Auto-accept. Work with no answer for 5 days (SAMPLE, for the client to
--    confirm) is accepted automatically by a job every 15 minutes. Never
--    while a problem is open.
-- 3. Reviews. After a completed service order the startup rates the provider
--    1 to 5 stars, with quick tags and a short note, once. The average and
--    count show on the freelancer's anonymous profile and the Providers list.
--
-- Refunds and payouts are SIMULATED. Safe to run more than once.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Two more milestone states: problem (open with MPI) and refunded
-- ----------------------------------------------------------------------------
alter table public.service_milestones drop constraint if exists service_milestones_status_check;
alter table public.service_milestones add constraint service_milestones_status_check
  check (status in ('planned', 'in_progress', 'submitted', 'changes_asked', 'accepted', 'paid_out', 'problem', 'refunded'));
alter table public.service_milestones add column if not exists refunded_at timestamptz;
grant select (refunded_at) on public.service_milestones to authenticated;

-- The order follows its milestones. A refunded milestone counts as closed.
create or replace function app.sync_milestone_order(p_po_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_po     public.purchase_orders%rowtype;
  v_next   public.po_status;
  v_n      integer;
  v_paid   integer;
  v_acc    integer;
  v_out    integer;
  v_title  text;
begin
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  select count(*),
         count(*) filter (where status <> 'planned'),
         count(*) filter (where status in ('accepted', 'paid_out', 'refunded')),
         count(*) filter (where status in ('paid_out', 'refunded'))
    into v_n, v_paid, v_acc, v_out
    from public.service_milestones where po_id = p_po_id;
  v_next := case when v_out = v_n then 'completed'
                 when v_acc = v_n then 'delivered'
                 when v_paid > 0 then 'in_production'
                 else 'issued' end::public.po_status;
  if v_po.status = 'cancelled' or v_po.status = v_next then
    return;
  end if;
  perform set_config('mpi.milestone_sync', 'on', true);
  update public.purchase_orders set status = v_next, status_changed_at = now() where id = p_po_id;
  perform set_config('mpi.milestone_sync', 'off', true);

  select title into v_title from public.requests where id = v_po.request_id;
  if v_next in ('delivered', 'completed') then
    perform app.notify_org(v_po.buyer_org_id, 'order_' || v_next::text,
      'Order ' || v_po.po_number || ': ' || case when v_next = 'delivered' then 'all work accepted' else 'completed' end,
      v_title || case when v_next = 'completed' then '. Rate the provider to help other startups.' else '' end,
      '/startup/orders?o=' || v_po.id);
    perform app.notify_org(v_po.vendor_org_id, 'order_' || v_next::text,
      'Order ' || v_po.po_number || ': ' || case when v_next = 'delivered' then 'all work accepted' else 'completed, all paid out' end,
      v_title, '/supplier/orders?o=' || v_po.id);
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. Problems raised with MPI
-- ----------------------------------------------------------------------------
create table if not exists public.milestone_problems (
  id              uuid primary key default gen_random_uuid(),
  milestone_id    uuid not null references public.service_milestones (id) on delete cascade,
  po_id           uuid not null references public.purchase_orders (id) on delete cascade,
  raised_by_side  text not null check (raised_by_side in ('startup', 'provider')),
  raised_by       uuid references public.profiles (id) on delete set null,
  reason          text not null check (reason in ('quality', 'not_as_agreed', 'late', 'no_response', 'payment', 'other')),
  description     text not null check (char_length(description) between 10 and 2000),
  links           text[] not null default '{}',
  prev_status     text not null,
  status          text not null default 'open' check (status in ('open', 'resolved')),
  decision        text check (decision in ('pay_provider', 'refund_startup', 'back_to_work')),
  decision_note   text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create unique index if not exists milestone_problems_open_idx on public.milestone_problems (milestone_id) where status = 'open';
create index if not exists milestone_problems_po_idx on public.milestone_problems (po_id);

alter table public.milestone_problems enable row level security;
drop policy if exists milestone_problems_read on public.milestone_problems;
create policy milestone_problems_read on public.milestone_problems
  for select to authenticated using (app.is_order_party(po_id));
revoke all on public.milestone_problems from anon, authenticated;
grant select on public.milestone_problems to authenticated;

create or replace function public.raise_problem(p_milestone_id uuid, p_reason text, p_description text,
                                                p_links text[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_m     public.service_milestones%rowtype;
  v_po    public.purchase_orders%rowtype;
  v_side  text;
  v_links text[];
  v_id    uuid;
  v_title text;
begin
  select * into v_m from public.service_milestones where id = p_milestone_id for update;
  if v_m.id is null then
    raise exception 'Milestone not found';
  end if;
  select * into v_po from public.purchase_orders where id = v_m.po_id;
  if app.my_role() = 'startup' and app.my_org_id() = v_po.buyer_org_id then
    v_side := 'startup';
  elsif app.my_role() = 'vendor' and app.my_org_id() = v_po.vendor_org_id then
    v_side := 'provider';
  else
    raise exception 'Not allowed';
  end if;
  if v_m.status = 'problem' then
    raise exception 'A problem is already open on this milestone. MPI is looking at it.';
  end if;
  if v_m.status not in ('in_progress', 'submitted', 'changes_asked', 'accepted') then
    raise exception 'A problem can be raised once a milestone is paid and until it is paid out';
  end if;
  if p_reason is null or p_reason not in ('quality', 'not_as_agreed', 'late', 'no_response', 'payment', 'other') then
    raise exception 'Pick a reason';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Describe the problem in a sentence or two';
  end if;
  select coalesce(array_agg(trim(l)), '{}') into v_links from unnest(coalesce(p_links, '{}')) l where trim(l) <> '';
  if cardinality(v_links) > 5 then
    raise exception 'Add up to 5 links';
  end if;
  if exists (select 1 from unnest(v_links) l where l !~* '^https?://\S+$' or char_length(l) > 500) then
    raise exception 'Each link must start with http:// or https://';
  end if;

  insert into public.milestone_problems (milestone_id, po_id, raised_by_side, raised_by, reason, description, links, prev_status)
  values (v_m.id, v_m.po_id, v_side, auth.uid(), p_reason, trim(p_description), v_links, v_m.status)
  returning id into v_id;
  update public.service_milestones set status = 'problem' where id = v_m.id;
  perform app.milestone_event(v_m.id, v_m.po_id, 'problem', 'Problem raised by the ' || v_side || ': ' || left(trim(p_description), 200));

  select title into v_title from public.requests where id = v_po.request_id;
  perform app.notify_admins('milestone_problem', 'A problem was raised on a milestone',
    v_po.po_number || ', milestone ' || v_m.seq || ': ' || v_m.title, '/admin/orders?o=' || v_po.id);
  if v_side = 'startup' then
    perform app.notify_org(v_po.vendor_org_id, 'milestone_problem', 'The startup raised a problem on milestone ' || v_m.seq,
      v_title || '. MPI will look at it and get back to you.', '/supplier/orders?o=' || v_po.id);
  else
    perform app.notify_org(v_po.buyer_org_id, 'milestone_problem', 'The provider raised a problem on milestone ' || v_m.seq,
      v_title || '. MPI will look at it and get back to you.', '/startup/orders?o=' || v_po.id);
  end if;
  perform app.audit('milestone.problem_raised', 'service_milestone', v_m.id, jsonb_build_object('problem', v_id, 'side', v_side, 'reason', p_reason));
  return v_id;
end;
$$;

-- Admin decides. Refund: the startup gets this milestone's payment back
-- (simulated); the provider's invoice part is credited and MPI's commission
-- on it reversed. MPI's own fee is not refunded (sample rule).
create or replace function public.resolve_problem(p_problem_id uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p       public.milestone_problems%rowtype;
  v_m       public.service_milestones%rowtype;
  v_po      public.purchase_orders%rowtype;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
  v_sup     public.invoices%rowtype;
  v_com     public.invoices%rowtype;
  v_paid    numeric;
  v_c       numeric;
  v_c_tax   numeric;
  v_a_tax   numeric;
  v_ref     uuid;
  v_route   text;
  v_title   text;
  v_words   text;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into v_p from public.milestone_problems where id = p_problem_id for update;
  if v_p.id is null then
    raise exception 'Problem not found';
  end if;
  if v_p.status <> 'open' then
    raise exception 'This problem is already resolved';
  end if;
  if p_decision is null or p_decision not in ('pay_provider', 'refund_startup', 'back_to_work') then
    raise exception 'Pick a decision';
  end if;
  if v_note is null or char_length(v_note) < 3 then
    raise exception 'Write a short reason for the decision. Both sides see it.';
  end if;
  select * into v_m from public.service_milestones where id = v_p.milestone_id for update;
  select * into v_po from public.purchase_orders where id = v_m.po_id for update;
  select payment_route into v_route from public.order_price_snapshots where po_id = v_po.id;

  if p_decision = 'pay_provider' then
    update public.milestone_submissions
       set answer = 'accepted', answer_note = 'Decided by MPI: ' || v_note, answered_at = now(), answered_by = auth.uid()
     where milestone_id = v_m.id and answer is null
       and version = (select max(version) from public.milestone_submissions where milestone_id = v_m.id);
    update public.service_milestones set status = 'accepted', accepted_at = coalesce(accepted_at, now()) where id = v_m.id;
    v_words := 'MPI decided to pay the provider';
  elsif p_decision = 'back_to_work' then
    update public.service_milestones set status = 'in_progress', submitted_at = null where id = v_m.id;
    v_words := 'MPI sent the milestone back to work';
  else
    -- What the startup paid for this milestone.
    select * into v_sup from public.invoices where po_id = v_po.id and kind = 'supplier_to_buyer';
    select * into v_com from public.invoices where po_id = v_po.id and kind = 'mpi_commission_to_supplier';
    select coalesce(sum(ii.amount), 0) into v_paid
      from public.invoice_installments ii where ii.invoice_id = v_sup.id and ii.milestone_id = v_m.id and ii.status = 'paid';
    select coalesce(sum(ii.amount), 0) into v_c
      from public.invoice_installments ii where ii.invoice_id = v_com.id and ii.milestone_id = v_m.id and ii.status = 'due';
    v_a_tax := round(v_paid * v_sup.tax_amount / nullif(v_sup.total, 0), 2);
    v_c_tax := round(v_c * v_com.tax_amount / nullif(v_com.total, 0), 2);

    if v_paid > 0 then
      insert into public.credit_notes (number, invoice_id, po_id, kind, taxable_amount, tax_amount, total, reason, idempotency_key, created_by)
      values (app.next_doc_number('CN'), v_sup.id, v_po.id, 'supplier_credit', v_paid - coalesce(v_a_tax, 0), coalesce(v_a_tax, 0), v_paid,
              'Milestone ' || v_m.seq || ' refunded after a problem: ' || v_note, 'problem-' || v_p.id, auth.uid());
      perform app.refresh_invoice(v_sup.id);
    end if;
    if v_c > 0 then
      insert into public.credit_notes (number, invoice_id, po_id, kind, taxable_amount, tax_amount, total, reason, idempotency_key, created_by)
      values (app.next_doc_number('CN'), v_com.id, v_po.id, 'commission_reversal', v_c - coalesce(v_c_tax, 0), coalesce(v_c_tax, 0), v_c,
              'Milestone ' || v_m.seq || ' refunded', 'problem-' || v_p.id, auth.uid());
      update public.invoice_installments set status = 'waived' where invoice_id = v_com.id and milestone_id = v_m.id and status = 'due';
      perform app.refresh_invoice(v_com.id);
      perform app.ledger(v_po.id, 'milestone_commission_reversed', 'milestone_problem', v_p.id, jsonb_build_array(
        jsonb_build_object('account', 'supplier_payable', 'amount', -v_c),
        jsonb_build_object('account', 'mpi_revenue',      'amount',  v_c - coalesce(v_c_tax, 0)),
        jsonb_build_object('account', 'gst_payable',      'amount',  coalesce(v_c_tax, 0))));
    end if;
    -- (When the startup paid the provider directly, the credit note above is
    -- the record; the provider returns the money itself.)
    if v_paid > 0 then
      if v_route is distinct from 'direct' then
        perform app.ledger(v_po.id, 'milestone_credited', 'milestone_problem', v_p.id, jsonb_build_array(
          jsonb_build_object('account', 'buyer_receivable', 'amount', -v_paid),
          jsonb_build_object('account', 'supplier_payable', 'amount',  v_paid)));
        insert into public.refunds (po_id, buyer_org_id, amount, idempotency_key, created_by)
        values (v_po.id, v_po.buyer_org_id, v_paid, 'problem-refund-' || v_p.id, auth.uid())
        returning id into v_ref;
        perform app.ledger(v_po.id, 'refund_paid', 'refund', v_ref, jsonb_build_array(
          jsonb_build_object('account', 'mpi_cash',         'amount', -v_paid),
          jsonb_build_object('account', 'buyer_receivable', 'amount',  v_paid)));
      end if;
    end if;
    update public.service_milestones set status = 'refunded', refunded_at = now() where id = v_m.id;
    v_words := 'MPI refunded ₹' || v_paid || ' to the startup (simulated)';
  end if;

  update public.milestone_problems
     set status = 'resolved', decision = p_decision, decision_note = v_note, decided_by = auth.uid(), decided_at = now()
   where id = v_p.id;
  perform app.milestone_event(v_m.id, v_m.po_id,
    case p_decision when 'pay_provider' then 'accepted' when 'back_to_work' then 'in_progress' else 'refunded' end,
    v_words || ': ' || v_note);
  perform app.sync_milestone_order(v_po.id);

  select title into v_title from public.requests where id = v_po.request_id;
  perform app.notify_org(v_po.buyer_org_id, 'milestone_problem_resolved', 'Milestone ' || v_m.seq || ': ' || v_words,
    v_title || '. ' || v_note, '/startup/orders?o=' || v_po.id);
  perform app.notify_org(v_po.vendor_org_id, 'milestone_problem_resolved', 'Milestone ' || v_m.seq || ': ' || v_words,
    v_title || '. ' || v_note, '/supplier/orders?o=' || v_po.id);
  perform app.audit('milestone.problem_resolved', 'service_milestone', v_m.id,
    jsonb_build_object('problem', v_p.id, 'decision', p_decision));
end;
$$;

-- Admin: problems waiting for a decision, oldest first.
create or replace function public.problems_to_resolve()
returns table (problem_id uuid, milestone_id uuid, po_id uuid, po_number text, request_title text, buyer_name text,
               vendor_name text, seq integer, title text, raised_by_side text, reason text, description text,
               amount numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, m.id, po.id, po.po_number, r.title, b.name, v.name, m.seq, m.title, p.raised_by_side, p.reason,
           p.description, m.amount, p.created_at
      from public.milestone_problems p
      join public.service_milestones m on m.id = p.milestone_id
      join public.purchase_orders po on po.id = p.po_id
      join public.requests r on r.id = po.request_id
      join public.organisations b on b.id = po.buyer_org_id
      join public.organisations v on v.id = po.vendor_org_id
     where p.status = 'open'
     order by p.created_at;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. Auto-accept after 5 days with no answer (SAMPLE)
-- ----------------------------------------------------------------------------
create or replace function app.auto_accept_days() returns integer
language sql immutable as $$ select 5 $$;

create or replace function app.auto_accept_milestones() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r      record;
  v_n    integer := 0;
  v_title text;
begin
  for r in
    select m.id, m.po_id, m.seq, m.title, po.vendor_org_id, po.buyer_org_id, po.po_number, po.request_id
      from public.service_milestones m
      join public.purchase_orders po on po.id = m.po_id
     where m.status = 'submitted'                      -- never while a problem is open
       and po.status <> 'cancelled'
       and m.submitted_at <= now() - make_interval(days => app.auto_accept_days())
     for update of m skip locked
  loop
    update public.milestone_submissions
       set answer = 'accepted', answer_note = 'Accepted automatically: no answer in ' || app.auto_accept_days() || ' days',
           answered_at = now()
     where milestone_id = r.id and answer is null
       and version = (select max(version) from public.milestone_submissions where milestone_id = r.id);
    update public.service_milestones set status = 'accepted', accepted_at = now() where id = r.id;
    perform app.milestone_event(r.id, r.po_id, 'accepted', 'Accepted automatically: no answer in ' || app.auto_accept_days() || ' days');
    perform app.sync_milestone_order(r.po_id);
    select title into v_title from public.requests where id = r.request_id;
    perform app.notify_org(r.buyer_org_id, 'milestone_accepted', 'Milestone ' || r.seq || ' was accepted automatically',
      v_title || ': no answer in ' || app.auto_accept_days() || ' days, so MPI accepted the work.', '/startup/orders?o=' || r.po_id);
    perform app.notify_org(r.vendor_org_id, 'milestone_accepted', 'Milestone ' || r.seq || ' accepted: MPI will send your payout',
      v_title || ': accepted automatically after ' || app.auto_accept_days() || ' days.', '/supplier/orders?o=' || r.po_id);
    perform app.notify_admins('payout_to_send', 'A milestone payout is ready to send',
      r.po_number || ', milestone ' || r.seq || ': ' || r.title || ' (accepted automatically)', '/admin/orders?o=' || r.po_id);
    perform app.audit('milestone.auto_accepted', 'service_milestone', r.id, '{}'::jsonb);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mpi-auto-accept-milestones', '*/15 * * * *', 'select app.auto_accept_milestones()');
  else
    raise notice 'pg_cron is not available here, so work is not accepted automatically. On Supabase, turn on Cron under Integrations and run this file again.';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 4. Reviews after a completed service order
-- ----------------------------------------------------------------------------
create table if not exists public.provider_reviews (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid not null unique references public.purchase_orders (id) on delete cascade,
  vendor_org_id  uuid not null references public.organisations (id) on delete cascade,
  buyer_org_id   uuid not null references public.organisations (id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  tags           text[] not null default '{}'
                 check (tags <@ array['on_time', 'good_quality', 'easy_to_work_with']::text[]),
  note           text check (note is null or char_length(note) <= 500),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists provider_reviews_vendor_idx on public.provider_reviews (vendor_org_id);

alter table public.provider_reviews enable row level security;
drop policy if exists provider_reviews_read on public.provider_reviews;
create policy provider_reviews_read on public.provider_reviews
  for select to authenticated
  using (app.is_admin() or app.my_org_id() in (buyer_org_id, vendor_org_id));
revoke all on public.provider_reviews from anon, authenticated;
grant select on public.provider_reviews to authenticated;

create or replace function public.leave_review(p_po_id uuid, p_rating integer, p_tags text[] default '{}', p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_po   public.purchase_orders%rowtype;
  v_id   uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_tags text[];
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  if v_po.id is null then
    raise exception 'Order not found';
  end if;
  if app.my_role() is distinct from 'startup' or app.my_org_id() is distinct from v_po.buyer_org_id then
    raise exception 'Not allowed';
  end if;
  if not app.is_milestone_order(v_po.id) then
    raise exception 'Only service orders can be reviewed';
  end if;
  if v_po.status <> 'completed' then
    raise exception 'You can review once the order is completed';
  end if;
  if exists (select 1 from public.provider_reviews where po_id = v_po.id) then
    raise exception 'You already reviewed this order';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Pick 1 to 5 stars';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters';
  end if;
  select coalesce(array_agg(distinct t), '{}') into v_tags from unnest(coalesce(p_tags, '{}')) t;
  if not v_tags <@ array['on_time', 'good_quality', 'easy_to_work_with'] then
    raise exception 'Unknown tag';
  end if;

  insert into public.provider_reviews (po_id, vendor_org_id, buyer_org_id, rating, tags, note, created_by)
  values (v_po.id, v_po.vendor_org_id, v_po.buyer_org_id, p_rating, v_tags, v_note, auth.uid())
  returning id into v_id;
  perform app.notify_org(v_po.vendor_org_id, 'review_received', 'You got a ' || p_rating || '-star review',
    coalesce(v_note, 'From the startup on order ' || v_po.po_number), '/supplier/orders?o=' || v_po.id);
  perform app.audit('review.left', 'purchase_order', v_po.id, jsonb_build_object('rating', p_rating));
  return v_id;
end;
$$;

-- What startups see: the average and count, and recent notes, for
-- freelancers they can browse. Never who wrote them. Providers see their own.
create or replace view public.provider_ratings with (security_barrier) as
select r.vendor_org_id as org_id,
       round(avg(r.rating)::numeric, 1) as rating,
       count(*)::integer as reviews
  from public.provider_reviews r
 where r.vendor_org_id in (select id from public.freelancer_directory)
    or r.vendor_org_id = app.my_org_id()
    or app.is_admin()
 group by r.vendor_org_id;

create or replace view public.provider_review_notes with (security_barrier) as
select r.id, r.vendor_org_id as org_id, r.rating, r.tags, r.note, r.created_at
  from public.provider_reviews r
 where r.vendor_org_id in (select id from public.freelancer_directory)
    or r.vendor_org_id = app.my_org_id()
    or app.is_admin();

revoke all on public.provider_ratings, public.provider_review_notes from public, anon;
grant select on public.provider_ratings, public.provider_review_notes to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Milestones as each side sees them: now with problems, refunds and the
--    auto-accept date.
-- ----------------------------------------------------------------------------
create or replace function public.order_milestones(p_po_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_po   public.purchase_orders%rowtype;
  v_side text;
  v_fee  numeric;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  if v_po.id is null then
    raise exception 'Order not found';
  end if;
  v_side := app.money_side(v_po.buyer_org_id, v_po.vendor_org_id);
  if v_side is null then
    raise exception 'Not allowed';
  end if;
  select coalesce(sum(ii.amount), 0) into v_fee
    from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
   where i.po_id = p_po_id and i.kind = 'mpi_fee_to_buyer' and ii.status = 'due' and i.status <> 'cancelled';

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'seq', m.seq, 'title', m.title, 'done_when', to_jsonb(m.done_when),
             'status', m.status, 'amount', m.amount,
             'to_pay', case when v_side in ('buyer', 'admin') and m.status = 'planned'
                              and m.seq = (select min(seq) from public.service_milestones x where x.po_id = p_po_id and x.status = 'planned')
                            then m.amount + v_fee end,
             'mpi_fee_now', case when v_side in ('buyer', 'admin') and m.status = 'planned'
                                  and m.seq = (select min(seq) from public.service_milestones x where x.po_id = p_po_id and x.status = 'planned')
                                then v_fee end,
             'commission', case when v_side in ('supplier', 'admin') then m.commission end,
             'payout', case when v_side in ('supplier', 'admin') then m.payout end,
             'changes_allowed', m.changes_allowed, 'changes_used', m.changes_used,
             'paid_at', m.paid_at, 'submitted_at', m.submitted_at, 'accepted_at', m.accepted_at,
             'paid_out_at', m.paid_out_at, 'refunded_at', m.refunded_at,
             'auto_accept_at', case when m.status = 'submitted'
                                    then m.submitted_at + make_interval(days => app.auto_accept_days()) end,
             'submissions', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', s.id, 'version', s.version, 'note', s.note, 'links', to_jsonb(s.links),
                        'points_done', to_jsonb(s.points_done), 'submitted_at', s.submitted_at,
                        'answer', s.answer, 'answer_note', s.answer_note, 'points_checked', to_jsonb(s.points_checked),
                        'answered_at', s.answered_at) order by s.version)
                 from public.milestone_submissions s where s.milestone_id = m.id), '[]'::jsonb),
             'problems', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', p.id, 'raised_by', p.raised_by_side, 'reason', p.reason, 'description', p.description,
                        'links', to_jsonb(p.links), 'status', p.status, 'decision', p.decision,
                        'decision_note', p.decision_note, 'created_at', p.created_at, 'decided_at', p.decided_at)
                        order by p.created_at)
                 from public.milestone_problems p where p.milestone_id = m.id), '[]'::jsonb),
             'events', coalesce((
               select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.created_at,
                                                   'by', case when e.changed_by is null then 'system'
                                                              when exists (select 1 from public.profiles p where p.id = e.changed_by and p.role = 'admin') then 'mpi'
                                                              when exists (select 1 from public.profiles p where p.id = e.changed_by and p.org_id = v_po.buyer_org_id) then 'startup'
                                                              else 'provider' end)
                                  order by e.created_at)
                 from public.milestone_events e where e.milestone_id = m.id), '[]'::jsonb))
           order by m.seq)
      from public.service_milestones m where m.po_id = p_po_id), '[]'::jsonb);
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. Grants
-- ----------------------------------------------------------------------------
revoke execute on function app.auto_accept_milestones() from public;
revoke execute on function app.auto_accept_days() from public;
grant  execute on function app.auto_accept_days() to authenticated;   -- used by order_milestones

revoke execute on function public.raise_problem(uuid, text, text, text[]) from public, anon;
revoke execute on function public.resolve_problem(uuid, text, text) from public, anon;
revoke execute on function public.problems_to_resolve() from public, anon;
revoke execute on function public.leave_review(uuid, integer, text[], text) from public, anon;
grant  execute on function public.raise_problem(uuid, text, text, text[]) to authenticated;
grant  execute on function public.resolve_problem(uuid, text, text) to authenticated;
grant  execute on function public.problems_to_resolve() to authenticated;
grant  execute on function public.leave_review(uuid, integer, text[], text) to authenticated;
