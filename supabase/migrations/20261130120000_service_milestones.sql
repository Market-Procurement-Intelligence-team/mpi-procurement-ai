-- ============================================================================
-- MPI · Freelancers step 6a: service orders with milestones
--
-- When a startup hires a provider on a service brief, the order is split into
-- milestones, one per deliverable in the hired proposal, each with its "done
-- when" points and its price. The startup pays one milestone at a time
-- (simulated), the provider submits the work as links, the startup accepts it
-- or asks for changes (up to the rounds agreed in the proposal), and MPI pays
-- the accepted milestone out to the provider after its commission.
--
-- Money stays with MPI until the startup accepts that milestone. The old
-- whole-order payment (pay_order) and payout (settle_supplier) are refused
-- for these orders, and the order's status follows its milestones:
--   first milestone paid   -> in_production ("In progress")
--   every milestone accepted -> delivered
--   every milestone paid out -> completed
-- Goods orders and their payment terms do not change.
--
-- All payments are SIMULATED. Safe to run more than once.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.service_milestones (
  id               uuid primary key default gen_random_uuid(),
  po_id            uuid not null references public.purchase_orders (id) on delete cascade,
  seq              integer not null check (seq >= 1),
  title            text not null,
  done_when        text[] not null default '{}',
  quote_line_id    uuid references public.quote_lines (id) on delete set null,
  amount           numeric(14,2) not null check (amount >= 0),   -- the provider's invoice part the startup pays
  commission       numeric(14,2) not null default 0 check (commission >= 0),  -- MPI's commission (with GST) on it
  payout           numeric(14,2) generated always as (amount - commission) stored,
  status           text not null default 'planned'
                   check (status in ('planned', 'in_progress', 'submitted', 'changes_asked', 'accepted', 'paid_out')),
  changes_allowed  smallint not null default 0 check (changes_allowed between 0 and 10),
  changes_used     smallint not null default 0 check (changes_used >= 0),
  paid_at          timestamptz,
  submitted_at     timestamptz,
  accepted_at      timestamptz,
  paid_out_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (po_id, seq)
);
create index if not exists service_milestones_po_idx on public.service_milestones (po_id);

create table if not exists public.milestone_submissions (
  id             uuid primary key default gen_random_uuid(),
  milestone_id   uuid not null references public.service_milestones (id) on delete cascade,
  po_id          uuid not null references public.purchase_orders (id) on delete cascade,
  version        integer not null check (version >= 1),
  note           text not null check (char_length(note) between 3 and 2000),
  links          text[] not null default '{}',
  points_done    integer[] not null default '{}',   -- which "done when" points the provider confirms (0-based)
  submitted_by   uuid references public.profiles (id) on delete set null,
  submitted_at   timestamptz not null default now(),
  answer         text check (answer in ('accepted', 'changes')),
  answer_note    text check (answer_note is null or char_length(answer_note) <= 1000),
  points_checked integer[] not null default '{}',   -- which points the startup ticked when answering
  answered_by    uuid references public.profiles (id) on delete set null,
  answered_at    timestamptz,
  unique (milestone_id, version)
);
create index if not exists milestone_submissions_po_idx on public.milestone_submissions (po_id);

-- Every milestone step: who, when and why.
create table if not exists public.milestone_events (
  id           uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.service_milestones (id) on delete cascade,
  po_id        uuid not null references public.purchase_orders (id) on delete cascade,
  status       text not null,
  note         text,
  changed_by   uuid references public.profiles (id) on delete set null,   -- empty when done by the system
  created_at   timestamptz not null default now()
);
create index if not exists milestone_events_po_idx on public.milestone_events (po_id, created_at);

-- A milestone's own installment on the provider's invoice and on MPI's
-- commission invoice, and its own payout.
alter table public.invoice_installments
  add column if not exists milestone_id uuid references public.service_milestones (id) on delete set null;
alter table public.invoice_installments drop constraint if exists invoice_installments_due_event_check;
alter table public.invoice_installments add constraint invoice_installments_due_event_check
  check (due_event in ('on_order', 'on_delivery', 'on_settlement', 'on_milestone'));
alter table public.settlements
  add column if not exists milestone_id uuid references public.service_milestones (id) on delete set null;
create unique index if not exists settlements_milestone_idx on public.settlements (milestone_id) where milestone_id is not null;

comment on table public.service_milestones is 'Service orders: one milestone per deliverable of the hired proposal, paid, submitted, accepted and paid out one at a time.';
comment on column public.service_milestones.amount is 'The provider''s invoice share for this milestone (with GST), what the startup pays for it.';
comment on column public.service_milestones.commission is 'MPI''s commission share (with GST), taken from the payout.';


-- ----------------------------------------------------------------------------
-- 2. Who can read what. Nobody writes these tables directly.
--    The startup does not see MPI's commission or the provider's payout.
-- ----------------------------------------------------------------------------
alter table public.service_milestones enable row level security;
alter table public.milestone_submissions enable row level security;
alter table public.milestone_events enable row level security;

create or replace function app.is_order_party(p_po_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin() or exists (
    select 1 from public.purchase_orders po
     where po.id = p_po_id and app.my_org_id() in (po.buyer_org_id, po.vendor_org_id));
$$;

drop policy if exists service_milestones_read on public.service_milestones;
create policy service_milestones_read on public.service_milestones
  for select to authenticated using (app.is_order_party(po_id));
drop policy if exists milestone_submissions_read on public.milestone_submissions;
create policy milestone_submissions_read on public.milestone_submissions
  for select to authenticated using (app.is_order_party(po_id));
drop policy if exists milestone_events_read on public.milestone_events;
create policy milestone_events_read on public.milestone_events
  for select to authenticated using (app.is_order_party(po_id));

revoke all on public.service_milestones, public.milestone_submissions, public.milestone_events from anon, authenticated;
grant select (id, po_id, seq, title, done_when, amount, status, changes_allowed, changes_used,
              paid_at, submitted_at, accepted_at, paid_out_at, created_at)
  on public.service_milestones to authenticated;
grant select on public.milestone_submissions, public.milestone_events to authenticated;

create or replace function app.is_milestone_order(p_po_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.service_milestones m where m.po_id = p_po_id);
$$;

create or replace function app.milestone_event(p_m uuid, p_po uuid, p_status text, p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into public.milestone_events (milestone_id, po_id, status, note, changed_by)
  values (p_m, p_po, p_status, p_note, auth.uid());
$$;

-- The order's status follows its milestones. Only these functions may move
-- it (or cancel it).
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
         count(*) filter (where status in ('accepted', 'paid_out')),
         count(*) filter (where status = 'paid_out')
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
      v_title, '/startup/orders?o=' || v_po.id);
    perform app.notify_org(v_po.vendor_org_id, 'order_' || v_next::text,
      'Order ' || v_po.po_number || ': ' || case when v_next = 'delivered' then 'all work accepted' else 'completed, all paid out' end,
      v_title, '/supplier/orders?o=' || v_po.id);
  end if;
end;
$$;

create or replace function app.guard_milestone_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and new.status <> 'cancelled'
     and coalesce(current_setting('mpi.milestone_sync', true), 'off') <> 'on'
     and app.is_milestone_order(new.id) then
    raise exception 'This order moves with its milestones: pay, submit and accept each milestone instead';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_milestone_order_status on public.purchase_orders;
create trigger guard_milestone_order_status
  before update of status on public.purchase_orders
  for each row execute function app.guard_milestone_order_status();


-- ----------------------------------------------------------------------------
-- 3. Hiring on a service brief makes the milestones. The proposal's prices,
--    days and rounds of changes are frozen on the order. The provider's
--    invoice and MPI's commission are split into one part per milestone; MPI's
--    fee to the startup is paid with the first milestone.
-- ----------------------------------------------------------------------------
create or replace function app.make_service_milestones(p_po_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_po       public.purchase_orders%rowtype;
  v_q        public.quotes%rowtype;
  v_kind     text;
  v_sup_inv  public.invoices%rowtype;
  v_com_inv  public.invoices%rowtype;
  v_weights  numeric;
  v_extra    numeric;
  v_n        integer;
  v_i        integer := 0;
  v_amt_left numeric;
  v_com_left numeric;
  v_amt      numeric;
  v_com      numeric;
  v_m        uuid;
  r          record;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  select kind into v_kind from public.requests where id = v_po.request_id;
  if v_kind is distinct from 'service' or app.is_milestone_order(p_po_id) then
    return;
  end if;
  select * into v_q from public.quotes where id = v_po.quote_id;

  -- One milestone per priced deliverable. Charges not tied to a deliverable
  -- are added to the first milestone.
  select count(*), coalesce(sum(ql.line_amount + ql.line_tax), 0)
    into v_n, v_weights
    from public.quote_lines ql where ql.quote_id = v_q.id and ql.request_line_id is not null;
  if v_n = 0 then
    return;   -- nothing priced per deliverable: keep the normal payment terms
  end if;
  select coalesce(sum(ql.line_amount + ql.line_tax), 0) into v_extra
    from public.quote_lines ql where ql.quote_id = v_q.id and ql.request_line_id is null;
  v_weights := v_weights + v_extra;

  select * into v_sup_inv from public.invoices where po_id = p_po_id and kind = 'supplier_to_buyer';
  select * into v_com_inv from public.invoices where po_id = p_po_id and kind = 'mpi_commission_to_supplier';
  v_amt_left := coalesce(v_sup_inv.total, 0);
  v_com_left := coalesce(v_com_inv.total, 0);

  delete from public.invoice_installments where invoice_id in (v_sup_inv.id, v_com_inv.id) and status = 'due';

  for r in
    select ql.id, ql.description, ql.line_amount + ql.line_tax as weight,
           coalesce(nullif(trim(rl.specs->>'Done when'), ''),
                    (select d->>'done_when' from jsonb_array_elements(rq.deliverables) d
                      where d->>'title' = rl.description limit 1),
                    rq.deliverables->(rl.sort_order)->>'done_when') as done_when
      from public.quote_lines ql
      left join public.request_lines rl on rl.id = ql.request_line_id
      left join public.requests rq on rq.id = rl.request_id
     where ql.quote_id = v_q.id and ql.request_line_id is not null
     order by coalesce(rl.sort_order, ql.sort_order), ql.sort_order, ql.id
  loop
    v_i := v_i + 1;
    if v_i = v_n then
      v_amt := v_amt_left;
      v_com := v_com_left;
    else
      v_amt := round(coalesce(v_sup_inv.total, 0) * (r.weight + case when v_i = 1 then v_extra else 0 end) / nullif(v_weights, 0), 2);
      v_com := round(coalesce(v_com_inv.total, 0) * (r.weight + case when v_i = 1 then v_extra else 0 end) / nullif(v_weights, 0), 2);
      v_amt := coalesce(v_amt, 0);
      v_com := coalesce(v_com, 0);
    end if;
    v_amt_left := v_amt_left - v_amt;
    v_com_left := v_com_left - v_com;

    insert into public.service_milestones (po_id, seq, title, done_when, quote_line_id, amount, commission, changes_allowed)
    values (p_po_id, v_i, r.description,
            coalesce(array(select trim(p) from regexp_split_to_table(coalesce(r.done_when, ''), E'\\s*[\\n;]\\s*') p
                            where trim(p) <> ''), '{}'),
            r.id, v_amt, v_com, coalesce(v_q.revision_rounds, 0))
    returning id into v_m;

    if v_sup_inv.id is not null then
      insert into public.invoice_installments (invoice_id, seq, label, pct, amount, due_event, milestone_id)
      values (v_sup_inv.id, v_i, 'Milestone ' || v_i || ': ' || left(r.description, 80),
              round(100 * v_amt / nullif(v_sup_inv.total, 0), 3), v_amt, 'on_milestone', v_m);
    end if;
    if v_com_inv.id is not null then
      insert into public.invoice_installments (invoice_id, seq, label, pct, amount, due_event, milestone_id)
      values (v_com_inv.id, v_i, 'Milestone ' || v_i || ': deducted from its payout',
              round(100 * v_com / nullif(v_com_inv.total, 0), 3), v_com, 'on_settlement', v_m);
    end if;
    perform app.milestone_event(v_m, p_po_id, 'planned', null);
  end loop;

  update public.invoice_installments set label = 'MPI fee, paid with milestone 1'
   where invoice_id in (select id from public.invoices where po_id = p_po_id and kind = 'mpi_fee_to_buyer');

  update public.purchase_orders
     set expected_delivery = coalesce(expected_delivery, (v_po.approved_at::date + coalesce(v_q.lead_time_days, 0)))
   where id = p_po_id and v_q.lead_time_days is not null;
end;
$$;

-- Runs after the order's invoices are made (trigger names fire in order:
-- after_order_created, then make_service_milestones).
create or replace function app.after_service_order_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.make_service_milestones(new.id);
  return null;
end;
$$;

drop trigger if exists make_service_milestones on public.purchase_orders;
create trigger make_service_milestones
  after insert on public.purchase_orders
  for each row execute function app.after_service_order_created();


-- ----------------------------------------------------------------------------
-- 4. The startup pays a milestone (simulated). Milestones are paid in order.
-- ----------------------------------------------------------------------------
create or replace function public.pay_milestone(p_milestone_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m       public.service_milestones%rowtype;
  v_po      public.purchase_orders%rowtype;
  v_route   text;
  v_mpi     uuid;
  v_to_mpi  numeric := 0;
  v_to_sup  numeric := 0;
  v_fee     numeric := 0;
  v_pay_mpi uuid;
  v_pay_sup uuid;
  v_ids     uuid[] := '{}';
  r         record;
  v_title   text;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'A payment needs a unique key (8 characters or more)';
  end if;
  if exists (select 1 from public.payments where idempotency_key in (p_idempotency_key, p_idempotency_key || ':supplier')) then
    return jsonb_build_object('already_recorded', true, 'simulated', true,
      'paid', (select sum(amount) from public.payments where idempotency_key in (p_idempotency_key, p_idempotency_key || ':supplier')));
  end if;

  select * into v_m from public.service_milestones where id = p_milestone_id for update;
  if v_m.id is null then
    raise exception 'Milestone not found';
  end if;
  select * into v_po from public.purchase_orders where id = v_m.po_id for update;
  if not (app.is_admin() or (app.my_role() = 'startup' and app.my_org_id() = v_po.buyer_org_id)) then
    raise exception 'Not allowed';
  end if;
  if v_po.status = 'cancelled' then
    raise exception 'This order is cancelled';
  end if;
  if v_m.status <> 'planned' then
    raise exception 'This milestone is already paid';
  end if;
  if exists (select 1 from public.service_milestones where po_id = v_m.po_id and seq < v_m.seq and status = 'planned') then
    raise exception 'Pay the milestones in order: milestone % comes first',
      (select min(seq) from public.service_milestones where po_id = v_m.po_id and status = 'planned');
  end if;

  select payment_route into v_route from public.order_price_snapshots where po_id = v_po.id;
  select id into v_mpi from public.organisations where type = 'platform' order by created_at limit 1;

  -- This milestone's part of the provider's invoice, plus MPI's fee if it is
  -- still due (it goes with the first payment).
  for r in
    select ii.id, ii.amount, i.kind
      from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
     where i.po_id = v_po.id and i.status <> 'cancelled' and ii.status = 'due' and ii.amount > 0
       and ((i.kind = 'supplier_to_buyer' and ii.milestone_id = v_m.id)
            or (i.kind = 'mpi_fee_to_buyer' and ii.due_event = 'on_order'))
  loop
    v_ids := v_ids || r.id;
    if r.kind = 'mpi_fee_to_buyer' then
      v_to_mpi := v_to_mpi + r.amount;
      v_fee := v_fee + r.amount;
    elsif v_route = 'direct' then
      v_to_sup := v_to_sup + r.amount;
    else
      v_to_mpi := v_to_mpi + r.amount;
    end if;
  end loop;

  if v_to_mpi > 0 then
    insert into public.payments (po_id, payer_org_id, payee, payee_org_id, amount, idempotency_key, created_by)
    values (v_po.id, v_po.buyer_org_id, 'mpi', v_mpi, v_to_mpi, p_idempotency_key, auth.uid())
    returning id into v_pay_mpi;
  end if;
  if v_to_sup > 0 then
    insert into public.payments (po_id, payer_org_id, payee, payee_org_id, amount, idempotency_key, created_by)
    values (v_po.id, v_po.buyer_org_id, 'supplier', v_po.vendor_org_id, v_to_sup,
            case when v_pay_mpi is null then p_idempotency_key else p_idempotency_key || ':supplier' end, auth.uid())
    returning id into v_pay_sup;
  end if;
  if cardinality(v_ids) > 0 then
    insert into public.payment_allocations (payment_id, installment_id, amount)
    select case when i.kind = 'mpi_fee_to_buyer' or v_route <> 'direct' then v_pay_mpi else v_pay_sup end, ii.id, ii.amount
      from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
     where ii.id = any (v_ids);
    update public.invoice_installments set status = 'paid', paid_at = now() where id = any (v_ids);
    perform app.refresh_invoice(i.id) from public.invoices i where i.po_id = v_po.id;
  end if;
  if v_to_mpi > 0 then
    perform app.ledger(v_po.id, 'buyer_payment', 'payment', v_pay_mpi, jsonb_build_array(
      jsonb_build_object('account', 'mpi_cash',         'amount',  v_to_mpi),
      jsonb_build_object('account', 'buyer_receivable', 'amount', -v_to_mpi)));
  end if;

  update public.service_milestones set status = 'in_progress', paid_at = now() where id = v_m.id;
  perform app.milestone_event(v_m.id, v_po.id, 'in_progress', 'Paid ₹' || (v_to_mpi + v_to_sup) || ' (simulated)');
  perform app.sync_milestone_order(v_po.id);

  select title into v_title from public.requests where id = v_po.request_id;
  perform app.notify_org(v_po.vendor_org_id, 'milestone_paid',
    'Milestone ' || v_m.seq || ' is paid: you can start (simulated)',
    v_title || ': ' || v_m.title || '. MPI holds the money until the startup accepts the work.',
    '/supplier/orders?o=' || v_po.id);
  perform app.audit('milestone.paid', 'service_milestone', v_m.id,
    jsonb_build_object('po_id', v_po.id, 'to_mpi', v_to_mpi, 'to_supplier', v_to_sup, 'fee', v_fee, 'key', p_idempotency_key));

  return jsonb_build_object('simulated', true, 'note', 'Simulated payment: no real money moved.',
                            'paid', v_to_mpi + v_to_sup, 'milestone', v_m.amount, 'mpi_fee', v_fee);
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. The provider submits the work: a note, links, and the "done when"
--    points they confirm.
-- ----------------------------------------------------------------------------
create or replace function public.submit_milestone(p_milestone_id uuid, p_note text, p_links text[],
                                                   p_points_done integer[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_m     public.service_milestones%rowtype;
  v_po    public.purchase_orders%rowtype;
  v_links text[];
  v_id    uuid;
  v_ver   integer;
  v_title text;
begin
  select * into v_m from public.service_milestones where id = p_milestone_id for update;
  if v_m.id is null then
    raise exception 'Milestone not found';
  end if;
  select * into v_po from public.purchase_orders where id = v_m.po_id;
  if app.my_role() is distinct from 'vendor' or app.my_org_id() is distinct from v_po.vendor_org_id then
    raise exception 'Not allowed';
  end if;
  if v_po.status = 'cancelled' then
    raise exception 'This order is cancelled';
  end if;
  if v_m.status = 'planned' then
    raise exception 'Wait until the startup pays this milestone before submitting work';
  end if;
  if v_m.status not in ('in_progress', 'changes_asked') then
    raise exception 'This milestone is already submitted';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Add a short note about the work';
  end if;
  select coalesce(array_agg(trim(l)), '{}') into v_links
    from unnest(coalesce(p_links, '{}')) l where trim(l) <> '';
  if cardinality(v_links) = 0 then
    raise exception 'Add at least one link to the work';
  end if;
  if cardinality(v_links) > 10 then
    raise exception 'Add up to 10 links';
  end if;
  if exists (select 1 from unnest(v_links) l where l !~* '^https?://\S+$' or char_length(l) > 500) then
    raise exception 'Each link must start with http:// or https://';
  end if;

  select coalesce(max(version), 0) + 1 into v_ver from public.milestone_submissions where milestone_id = v_m.id;
  insert into public.milestone_submissions (milestone_id, po_id, version, note, links, points_done, submitted_by)
  values (v_m.id, v_m.po_id, v_ver, trim(p_note), v_links,
          coalesce(array(select distinct p from unnest(coalesce(p_points_done, '{}')) p
                          where p >= 0 and p < cardinality(v_m.done_when) order by p), '{}'),
          auth.uid())
  returning id into v_id;

  update public.service_milestones set status = 'submitted', submitted_at = now() where id = v_m.id;
  perform app.milestone_event(v_m.id, v_m.po_id, 'submitted', case when v_ver > 1 then 'Version ' || v_ver end);

  select title into v_title from public.requests where id = v_po.request_id;
  perform app.notify_org(v_po.buyer_org_id, 'milestone_submitted',
    'Work submitted for milestone ' || v_m.seq || ': please review',
    v_title || ': ' || v_m.title, '/startup/orders?o=' || v_po.id);
  perform app.audit('milestone.submitted', 'service_milestone', v_m.id, jsonb_build_object('version', v_ver));
  return v_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. The startup accepts the work, or asks for changes. Changes count
--    against the rounds agreed in the proposal.
-- ----------------------------------------------------------------------------
create or replace function public.answer_submission(p_submission_id uuid, p_accept boolean, p_note text default null,
                                                    p_points_checked integer[] default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s     public.milestone_submissions%rowtype;
  v_m     public.service_milestones%rowtype;
  v_po    public.purchase_orders%rowtype;
  v_title text;
  v_note  text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_s from public.milestone_submissions where id = p_submission_id for update;
  if v_s.id is null then
    raise exception 'Submission not found';
  end if;
  select * into v_m from public.service_milestones where id = v_s.milestone_id for update;
  select * into v_po from public.purchase_orders where id = v_m.po_id;
  if app.my_role() is distinct from 'startup' or app.my_org_id() is distinct from v_po.buyer_org_id then
    raise exception 'Not allowed';
  end if;
  if v_s.answer is not null or v_m.status <> 'submitted'
     or v_s.version <> (select max(version) from public.milestone_submissions where milestone_id = v_m.id) then
    raise exception 'This submission was already answered';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Keep the note under 1000 characters';
  end if;
  select title into v_title from public.requests where id = v_po.request_id;

  if p_accept then
    update public.milestone_submissions
       set answer = 'accepted', answer_note = v_note, answered_by = auth.uid(), answered_at = now(),
           points_checked = coalesce(array(select distinct p from unnest(coalesce(p_points_checked, '{}')) p
                                            where p >= 0 and p < cardinality(v_m.done_when) order by p), '{}')
     where id = v_s.id;
    update public.service_milestones set status = 'accepted', accepted_at = now() where id = v_m.id;
    perform app.milestone_event(v_m.id, v_m.po_id, 'accepted', v_note);
    perform app.sync_milestone_order(v_po.id);
    perform app.notify_org(v_po.vendor_org_id, 'milestone_accepted',
      'Milestone ' || v_m.seq || ' accepted: MPI will send your payout',
      v_title || ': ' || v_m.title, '/supplier/orders?o=' || v_po.id);
    perform app.notify_admins('payout_to_send', 'A milestone payout is ready to send',
      v_po.po_number || ', milestone ' || v_m.seq || ': ' || v_m.title, '/admin/orders?o=' || v_po.id);
    perform app.audit('milestone.accepted', 'service_milestone', v_m.id, jsonb_build_object('submission', v_s.id));
  else
    if v_note is null or char_length(v_note) < 3 then
      raise exception 'Say what needs to change';
    end if;
    if v_m.changes_used >= v_m.changes_allowed then
      raise exception 'You have used all % round(s) of changes agreed in the proposal. Accept the work, or contact MPI.', v_m.changes_allowed;
    end if;
    update public.milestone_submissions
       set answer = 'changes', answer_note = v_note, answered_by = auth.uid(), answered_at = now(),
           points_checked = coalesce(array(select distinct p from unnest(coalesce(p_points_checked, '{}')) p
                                            where p >= 0 and p < cardinality(v_m.done_when) order by p), '{}')
     where id = v_s.id;
    update public.service_milestones set status = 'changes_asked', changes_used = changes_used + 1 where id = v_m.id;
    perform app.milestone_event(v_m.id, v_m.po_id, 'changes_asked', v_note);
    perform app.notify_org(v_po.vendor_org_id, 'milestone_changes',
      'Changes asked on milestone ' || v_m.seq || ' (' || (v_m.changes_used + 1) || ' of ' || v_m.changes_allowed || ')',
      v_title || ': ' || v_m.title, '/supplier/orders?o=' || v_po.id);
    perform app.audit('milestone.changes_asked', 'service_milestone', v_m.id, jsonb_build_object('submission', v_s.id));
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 7. MPI pays an accepted milestone out to the provider, after its
--    commission (simulated). Never before the startup accepts it.
-- ----------------------------------------------------------------------------
create or replace function public.pay_out_milestone(p_milestone_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m       public.service_milestones%rowtype;
  v_po      public.purchase_orders%rowtype;
  v_route   text;
  v_gross   numeric;
  v_com     numeric;
  v_com_ids uuid[];
  v_net     numeric;
  v_id      uuid;
  v_title   text;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'A payout needs a unique key (8 characters or more)';
  end if;
  if exists (select 1 from public.settlements where idempotency_key = p_idempotency_key) then
    return (select jsonb_build_object('already_recorded', true, 'simulated', true, 'net_paid', net_amount,
                                      'commission_deducted', commission_deducted)
              from public.settlements where idempotency_key = p_idempotency_key);
  end if;

  select * into v_m from public.service_milestones where id = p_milestone_id for update;
  if v_m.id is null then
    raise exception 'Milestone not found';
  end if;
  select * into v_po from public.purchase_orders where id = v_m.po_id for update;
  if v_m.status = 'paid_out' then
    raise exception 'This milestone is already paid out';
  end if;
  if v_m.status <> 'accepted' then
    raise exception 'Only work the startup accepted can be paid out';
  end if;
  select payment_route into v_route from public.order_price_snapshots where po_id = v_po.id;

  select coalesce(sum(ii.amount), 0) into v_gross
    from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
   where i.po_id = v_po.id and i.kind = 'supplier_to_buyer' and ii.milestone_id = v_m.id and ii.status = 'paid';
  select coalesce(sum(ii.amount), 0), coalesce(array_agg(ii.id), '{}') into v_com, v_com_ids
    from public.invoice_installments ii join public.invoices i on i.id = ii.invoice_id
   where i.po_id = v_po.id and i.kind = 'mpi_commission_to_supplier' and ii.milestone_id = v_m.id and ii.status = 'due';

  if v_route = 'direct' then
    -- The startup paid the provider directly; the provider now pays MPI's commission.
    insert into public.settlements (po_id, vendor_org_id, gross_amount, commission_deducted, net_amount, kind,
                                    idempotency_key, created_by, milestone_id)
    values (v_po.id, v_po.vendor_org_id, 0, v_com, 0, 'commission_paid_by_supplier', p_idempotency_key, auth.uid(), v_m.id)
    returning id into v_id;
    if v_com > 0 then
      perform app.ledger(v_po.id, 'commission_paid', 'settlement', v_id, jsonb_build_array(
        jsonb_build_object('account', 'mpi_cash',         'amount',  v_com),
        jsonb_build_object('account', 'supplier_payable', 'amount', -v_com)));
    end if;
    v_net := 0;
  else
    if v_gross <= 0 then
      raise exception 'Nothing to pay out: this milestone was not paid';
    end if;
    v_net := v_gross - v_com;
    insert into public.settlements (po_id, vendor_org_id, gross_amount, commission_deducted, net_amount,
                                    idempotency_key, created_by, milestone_id)
    values (v_po.id, v_po.vendor_org_id, v_gross, v_com, v_net, p_idempotency_key, auth.uid(), v_m.id)
    returning id into v_id;
    perform app.ledger(v_po.id, 'supplier_payout', 'settlement', v_id, jsonb_build_array(
      jsonb_build_object('account', 'supplier_payable', 'amount',  v_net),
      jsonb_build_object('account', 'mpi_cash',         'amount', -v_net)));
  end if;

  if cardinality(v_com_ids) > 0 then
    update public.invoice_installments set status = 'paid', paid_at = now() where id = any (v_com_ids);
    perform app.refresh_invoice(i.id) from public.invoices i where i.po_id = v_po.id and i.kind = 'mpi_commission_to_supplier';
  end if;

  update public.service_milestones set status = 'paid_out', paid_out_at = now() where id = v_m.id;
  perform app.milestone_event(v_m.id, v_po.id, 'paid_out',
    case when v_route = 'direct' then 'Commission of ₹' || v_com || ' recorded (simulated)'
         else '₹' || v_net || ' paid out after ₹' || v_com || ' commission (simulated)' end);
  perform app.sync_milestone_order(v_po.id);

  select title into v_title from public.requests where id = v_po.request_id;
  perform app.notify_org(v_po.vendor_org_id, 'payout_sent',
    'Payout for milestone ' || v_m.seq || ' (simulated)',
    '₹' || v_net || ' paid to you after MPI''s commission of ₹' || v_com || ' · ' || v_title || '. Simulated: no real money moved.',
    '/supplier/orders?o=' || v_po.id);
  perform app.audit('milestone.paid_out', 'service_milestone', v_m.id,
    jsonb_build_object('gross', v_gross, 'commission', v_com, 'net', v_net, 'key', p_idempotency_key));

  return jsonb_build_object('simulated', true, 'note', 'Simulated payout: no real money moved.',
                            'gross', v_gross, 'commission_deducted', v_com, 'net_paid', v_net);
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. Everything about an order's milestones, from the asker's side. The
--    startup sees what it pays; the provider sees what it receives; admin
--    sees both.
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
             'paid_at', m.paid_at, 'submitted_at', m.submitted_at, 'accepted_at', m.accepted_at, 'paid_out_at', m.paid_out_at,
             'submissions', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', s.id, 'version', s.version, 'note', s.note, 'links', to_jsonb(s.links),
                        'points_done', to_jsonb(s.points_done), 'submitted_at', s.submitted_at,
                        'answer', s.answer, 'answer_note', s.answer_note, 'points_checked', to_jsonb(s.points_checked),
                        'answered_at', s.answered_at) order by s.version)
                 from public.milestone_submissions s where s.milestone_id = m.id), '[]'::jsonb),
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

-- Admin: accepted milestones waiting for their payout, oldest first.
create or replace function public.payouts_to_send()
returns table (milestone_id uuid, po_id uuid, po_number text, request_title text, vendor_name text, seq integer,
               title text, accepted_at timestamptz, gross numeric, commission numeric, payout numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  return query
    select m.id, po.id, po.po_number, r.title, o.name, m.seq, m.title, m.accepted_at, m.amount, m.commission, m.payout
      from public.service_milestones m
      join public.purchase_orders po on po.id = m.po_id
      join public.requests r on r.id = po.request_id
      join public.organisations o on o.id = po.vendor_org_id
     where m.status = 'accepted' and po.status <> 'cancelled'
     order by m.accepted_at, po.po_number, m.seq;
end;
$$;


-- ----------------------------------------------------------------------------
-- 9. The whole-order payment and payout are refused for milestone orders.
-- ----------------------------------------------------------------------------
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
  if app.is_milestone_order(p_po_id) then
    raise exception 'This order is paid one milestone at a time';
  end if;
  return app.pay_due(p_po_id, p_idempotency_key, auth.uid());
end;
$$;

create or replace function public.settle_supplier(p_po_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if app.is_milestone_order(p_po_id) then
    raise exception 'This order is paid out one accepted milestone at a time';
  end if;
  return app.settle(p_po_id, p_idempotency_key, auth.uid());
end;
$$;


-- ----------------------------------------------------------------------------
-- 10. Grants
-- ----------------------------------------------------------------------------
revoke execute on function app.is_order_party(uuid) from public;
revoke execute on function app.is_milestone_order(uuid) from public;
revoke execute on function app.milestone_event(uuid, uuid, text, text) from public;
revoke execute on function app.sync_milestone_order(uuid) from public;
revoke execute on function app.guard_milestone_order_status() from public;
revoke execute on function app.make_service_milestones(uuid) from public;
revoke execute on function app.after_service_order_created() from public;
grant  execute on function app.is_order_party(uuid) to authenticated;   -- used by the read policies

revoke execute on function public.pay_milestone(uuid, text) from public, anon;
revoke execute on function public.submit_milestone(uuid, text, text[], integer[]) from public, anon;
revoke execute on function public.answer_submission(uuid, boolean, text, integer[]) from public, anon;
revoke execute on function public.pay_out_milestone(uuid, text) from public, anon;
revoke execute on function public.order_milestones(uuid) from public, anon;
revoke execute on function public.payouts_to_send() from public, anon;
grant  execute on function public.pay_milestone(uuid, text) to authenticated;
grant  execute on function public.submit_milestone(uuid, text, text[], integer[]) to authenticated;
grant  execute on function public.answer_submission(uuid, boolean, text, integer[]) to authenticated;
grant  execute on function public.pay_out_milestone(uuid, text) to authenticated;
grant  execute on function public.order_milestones(uuid) to authenticated;
grant  execute on function public.payouts_to_send() to authenticated;
