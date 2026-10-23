-- ============================================================================
-- MPI · Migration 20261021120000 · Core schema (v2, 22 Oct: fields from the
-- old app's flows + anonymity)
--
-- Scope: the core journey only
--   startup raises a request -> invites up to 3 verified suppliers
--   -> suppliers send itemised quotes -> startup approves one -> purchase order
--   -> supplier updates order progress -> startup marks it completed
--
-- Anonymity: startups and suppliers never see each other's company names or
-- contact details. Each side sees a code ("MPI Verified Supplier #001",
-- "MPI Verified Buyer #001") through the org_public and supplier_directory
-- views. Only the admin sees real names.
--
-- Later migrations add: samples, simulated payments, copilot threads,
-- vendor documents (file uploads), catalogue seed data, demo workspace seed.
--
-- Safe to run once on an EMPTY project. It does not drop anything.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Private helper schema (not exposed through the API)
-- ----------------------------------------------------------------------------
create schema if not exists app;
grant usage on schema app to authenticated, anon;


-- ----------------------------------------------------------------------------
-- 1. Fixed value lists (enums)
-- ----------------------------------------------------------------------------
create type public.app_role            as enum ('startup', 'vendor', 'admin');
create type public.org_type            as enum ('startup', 'vendor', 'platform');
create type public.verification_status as enum ('not_required', 'pending', 'under_review', 'needs_info', 'verified', 'rejected', 'suspended');
create type public.request_status      as enum ('draft', 'open', 'comparing', 'ordered', 'cancelled');
create type public.request_source      as enum ('catalogue', 'ai_assisted', 'assisted_sourcing');
create type public.invitation_status   as enum ('invited', 'viewed', 'declined', 'quoted');
create type public.quote_status        as enum ('draft', 'submitted', 'superseded', 'withdrawn', 'accepted', 'rejected');
create type public.quote_line_type     as enum ('item', 'setup', 'testing', 'logistics', 'other');
create type public.po_status           as enum ('issued', 'in_production', 'qc_passed', 'dispatched', 'delivered', 'completed', 'cancelled');
create type public.enterprise_size     as enum ('micro', 'small', 'medium');


-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- Companies: every user belongs to exactly one organisation.
create table public.organisations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 200),
  type                public.org_type not null,
  gstin               text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  udyam_number        text,
  city                text,
  state               text,
  verification_status public.verification_status not null default 'not_required',
  verification_note   text,           -- admin's note, e.g. what information is missing
  verified_at         timestamptz,
  verified_by         uuid,           -- the admin's profile id
  display_name        text not null,  -- anonymous code shown to the other side, set automatically
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Number series for the anonymous codes.
create sequence public.buyer_code_seq;
create sequence public.supplier_code_seq;

-- People: one row per signed-up user (id = the login account id).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid not null references public.organisations (id) on delete restrict,
  role        public.app_role not null,
  full_name   text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles (org_id);

-- Startup business profile (from startup onboarding). One row per startup org,
-- created automatically at sign-up.
create table public.startup_details (
  org_id                    uuid primary key references public.organisations (id) on delete cascade,
  stage                     text check (stage in ('idea', 'prototype', 'mvp', 'early_revenue', 'traction', 'growth', 'scaling')),
  industry                  text,
  products_sold             text,
  team_size                 text,
  funding_stage             text check (funding_stage in ('bootstrapped', 'angel_pre_seed', 'seed', 'series_a_plus')),
  has_dpiit                 boolean not null default false,
  dpiit_number              text,
  annual_procurement_budget numeric(14,2) check (annual_procurement_budget is null or annual_procurement_budget >= 0),
  turnaround_priority       text check (turnaround_priority in ('standard', 'urgent', 'cost')),
  interest_category_ids     uuid[] not null default '{}',   -- catalogue categories they buy
  procurement_description   text,
  government_interests      text[] not null default '{}',
  updated_at                timestamptz not null default now()
);

-- Supplier business profile (from MSME onboarding). One row per supplier org,
-- created automatically at sign-up. PAN and factory address stay private.
create table public.vendor_details (
  org_id                     uuid primary key references public.organisations (id) on delete cascade,
  enterprise_type            public.enterprise_size,
  pan_number                 text check (pan_number is null or pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  factory_address            text,
  machinery                  text[] not null default '{}',
  monthly_capacity           text,
  capacity_utilisation_pct   integer check (capacity_utilisation_pct between 0 and 100),
  certifications             text[] not null default '{}',   -- e.g. ISO 9001, ZED Gold
  moq                        numeric(14,3) check (moq is null or moq >= 0),
  payment_terms              text,
  quality_testing_facilities text[] not null default '{}',
  lead_time_days             integer check (lead_time_days is null or lead_time_days >= 0),
  pan_india_dispatch         boolean not null default false,
  schemes_utilised           text[] not null default '{}',
  updated_at                 timestamptz not null default now()
);

-- Catalogue
create table public.catalogue_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  parent_id   uuid references public.catalogue_categories (id) on delete set null,
  is_tangible boolean not null default true,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.catalogue_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.catalogue_categories (id) on delete restrict,
  name        text not null,
  description text,
  unit        text not null default 'unit',
  is_tangible boolean not null default true,
  specs       jsonb not null default '{}'::jsonb,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index catalogue_items_category_idx on public.catalogue_items (category_id);

-- Which categories a supplier serves.
create table public.vendor_categories (
  vendor_org_id uuid not null references public.organisations (id) on delete cascade,
  category_id   uuid not null references public.catalogue_categories (id) on delete cascade,
  primary key (vendor_org_id, category_id)
);

-- A startup's purchase request (the RFQ).
create table public.requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations (id) on delete cascade,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  title           text not null check (char_length(title) between 3 and 200),
  description     text,
  requirement_text text,              -- what the startup typed or said, before the AI filled the form
  input_language  text,               -- e.g. en, hi
  ai_extracted    jsonb,              -- what the AI filled in, kept for review
  required_certifications text[] not null default '{}',
  category_id     uuid references public.catalogue_categories (id),
  source          public.request_source not null default 'catalogue',
  status          public.request_status not null default 'draft',
  needed_by       date,
  delivery_city   text,
  delivery_state  text,
  budget_min      numeric(14,2) check (budget_min is null or budget_min >= 0),
  budget_max      numeric(14,2) check (budget_max is null or budget_max >= 0),
  currency        char(3) not null default 'INR',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);
create index requests_org_id_idx on public.requests (org_id);

-- Line items inside a request.
create table public.request_lines (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  item_id     uuid references public.catalogue_items (id),
  description text not null,
  quantity    numeric(14,3) not null check (quantity > 0),
  unit        text not null default 'unit',
  specs       jsonb not null default '{}'::jsonb,
  sort_order  integer not null default 0
);
create index request_lines_request_idx on public.request_lines (request_id);

-- Which suppliers were invited to quote (max 3 per request).
create table public.rfq_invitations (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.requests (id) on delete cascade,
  vendor_org_id uuid not null references public.organisations (id) on delete cascade,
  status        public.invitation_status not null default 'invited',
  invited_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (request_id, vendor_org_id)
);
create index rfq_invitations_vendor_idx on public.rfq_invitations (vendor_org_id);

-- A supplier's quote. Revisions are new rows with version + 1.
create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.rfq_invitations (id) on delete cascade,
  request_id      uuid not null references public.requests (id) on delete cascade,
  vendor_org_id   uuid not null references public.organisations (id) on delete cascade,
  version         integer not null default 1 check (version >= 1),
  status          public.quote_status not null default 'draft',
  currency        char(3) not null default 'INR',
  -- subtotal, discount_amount and tax_amount are calculated from the lines.
  -- The discount (e.g. a loyalty discount) applies before GST.
  subtotal        numeric(14,2) not null default 0,
  discount_pct    numeric(5,2)  not null default 0 check (discount_pct between 0 and 100),
  discount_amount numeric(14,2) not null default 0,
  tax_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) generated always as (subtotal - discount_amount + tax_amount) stored,
  lead_time_days  integer check (lead_time_days is null or lead_time_days >= 0),
  payment_terms   text,
  valid_until     date,
  notes           text,
  submitted_at    timestamptz,
  created_by      uuid default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (invitation_id, version)
);
create index quotes_request_idx on public.quotes (request_id);
create index quotes_vendor_idx on public.quotes (vendor_org_id);

create table public.quote_lines (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes (id) on delete cascade,
  request_line_id uuid references public.request_lines (id) on delete set null,
  line_type       public.quote_line_type not null default 'item',  -- item, or a one-off charge like setup or testing
  description     text not null,
  quantity        numeric(14,3) not null check (quantity > 0),
  unit_price      numeric(14,2) not null check (unit_price >= 0),
  tax_rate        numeric(5,2)  not null default 18 check (tax_rate between 0 and 100),
  line_amount     numeric(16,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_tax        numeric(16,2) generated always as (round(quantity * unit_price * tax_rate / 100, 2)) stored,
  sort_order      integer not null default 0
);
create index quote_lines_quote_idx on public.quote_lines (quote_id);

-- Purchase order created when a startup approves a quote (one per request).
create sequence public.po_number_seq;
create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  po_number     text not null unique
                default 'MPI-PO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.po_number_seq')::text, 5, '0'),
  request_id    uuid not null unique references public.requests (id) on delete restrict,
  quote_id      uuid not null unique references public.quotes (id) on delete restrict,
  buyer_org_id  uuid not null references public.organisations (id),
  vendor_org_id uuid not null references public.organisations (id),
  status        public.po_status not null default 'issued',
  total_amount  numeric(14,2) not null,
  currency      char(3) not null default 'INR',
  approved_by   uuid not null references public.profiles (id),
  approved_at   timestamptz not null default now(),
  expected_delivery date,             -- set by the supplier
  status_changed_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- In-app notifications (one row per person).
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Audit trail of important actions (admin-only reading).
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  org_id      uuid,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);


-- ----------------------------------------------------------------------------
-- 3. Helper functions (who is the signed-in user?)
--    SECURITY DEFINER so they can read profiles without RLS recursion.
-- ----------------------------------------------------------------------------
create function app.my_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create function app.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create function app.my_org_is_demo() returns boolean
language sql stable security definer set search_path = '' as $$
  select o.is_demo from public.organisations o
  join public.profiles p on p.org_id = o.id
  where p.id = auth.uid();
$$;

-- Is the signed-in vendor invited to this request?
create function app.is_invited_to(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rfq_invitations i
    where i.request_id = p_request_id and i.vendor_org_id = app.my_org_id()
  );
$$;

-- Does the signed-in user's organisation own this request?
create function app.owns_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
    where r.id = p_request_id and r.org_id = app.my_org_id()
  );
$$;

-- Can the signed-in user see this request at all?
create function app.can_see_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin()
      or app.owns_request(p_request_id)
      or exists (
           select 1 from public.rfq_invitations i
           join public.requests r on r.id = i.request_id
           where i.request_id = p_request_id
             and i.vendor_org_id = app.my_org_id()
             and r.status <> 'draft'
         );
$$;

-- Send the same notification to everyone in an organisation.
create function app.notify_org(p_org_id uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link from public.profiles p where p.org_id = p_org_id;
$$;

create function app.audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, org_id, action, entity_type, entity_id, details)
  values (auth.uid(), app.my_org_id(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ----------------------------------------------------------------------------
-- 4. Automatic behaviour (triggers)
-- ----------------------------------------------------------------------------

-- 4a. Keep updated_at current.
create function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch before update on public.organisations   for each row execute function app.touch_updated_at();
create trigger touch before update on public.profiles        for each row execute function app.touch_updated_at();
create trigger touch before update on public.catalogue_items for each row execute function app.touch_updated_at();
create trigger touch before update on public.requests        for each row execute function app.touch_updated_at();
create trigger touch before update on public.quotes          for each row execute function app.touch_updated_at();
create trigger touch before update on public.startup_details for each row execute function app.touch_updated_at();
create trigger touch before update on public.vendor_details  for each row execute function app.touch_updated_at();

-- 4a2. Give every new organisation its anonymous code.
create function app.set_display_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.display_name := case new.type
    when 'vendor'  then 'MPI Verified Supplier #' || lpad(nextval('public.supplier_code_seq')::text, 3, '0')
    when 'startup' then 'MPI Verified Buyer #'    || lpad(nextval('public.buyer_code_seq')::text, 3, '0')
    else 'MPI'
  end;
  return new;
end;
$$;

create trigger set_display_name
  before insert on public.organisations
  for each row execute function app.set_display_name();

-- 4b. On sign-up: create the organisation + profile.
--     The sign-up form may say 'startup' or 'vendor'. 'admin' can NEVER be self-chosen.
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'startup');
  v_org  uuid;
begin
  if v_type not in ('startup', 'vendor') then
    v_type := 'startup';
  end if;

  insert into public.organisations (name, type, verification_status)
  values (
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), 'My organisation'),
    v_type::public.org_type,
    case when v_type = 'vendor' then 'pending' else 'not_required' end::public.verification_status
  )
  returning id into v_org;

  insert into public.profiles (id, org_id, role, full_name, email)
  values (new.id, v_org, v_type::public.app_role, new.raw_user_meta_data ->> 'full_name', new.email);

  -- Empty business profile, filled in during onboarding.
  if v_type = 'vendor' then
    insert into public.vendor_details (org_id) values (v_org);
  else
    insert into public.startup_details (org_id) values (v_org);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- 4c. Invitation rules: max 3 suppliers, supplier must be verified,
--     demo and real data never mix.
create function app.check_invitation() returns trigger
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

  if (select count(*) from public.rfq_invitations where request_id = new.request_id) >= 3 then
    raise exception 'A request can invite at most 3 suppliers';
  end if;

  return new;
end;
$$;

create trigger check_invitation
  before insert on public.rfq_invitations
  for each row execute function app.check_invitation();

-- 4d. Tell the supplier they were invited.
create function app.after_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
begin
  select title into v_title from public.requests where id = new.request_id;
  perform app.notify_org(new.vendor_org_id, 'rfq_invited', 'New request for quote',
                         v_title, '/vendor/opportunities/' || new.request_id);
  perform app.audit('rfq.invited', 'request', new.request_id,
                    jsonb_build_object('vendor_org_id', new.vendor_org_id));
  return new;
end;
$$;

create trigger after_invitation
  after insert on public.rfq_invitations
  for each row execute function app.after_invitation();

-- 4e. Quote checks: supplier must be the invited one; request must still be open.
create function app.check_quote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.rfq_invitations%rowtype;
  v_req_status public.request_status;
begin
  select * into v_inv from public.rfq_invitations where id = new.invitation_id;
  if v_inv.id is null or v_inv.vendor_org_id <> new.vendor_org_id or v_inv.request_id <> new.request_id then
    raise exception 'Quote does not match its invitation';
  end if;

  select status into v_req_status from public.requests where id = new.request_id;
  if tg_op = 'INSERT' and v_req_status not in ('open', 'comparing') then
    raise exception 'This request is not accepting quotes';
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger check_quote
  before insert or update on public.quotes
  for each row execute function app.check_quote();

-- 4f. When a quote is submitted: older versions become "superseded",
--     invitation becomes "quoted", the startup is notified.
create function app.after_quote_submitted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_buyer uuid;
  v_title text;
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    update public.quotes set status = 'superseded'
     where invitation_id = new.invitation_id and id <> new.id and status = 'submitted';

    update public.rfq_invitations set status = 'quoted', responded_at = now()
     where id = new.invitation_id;

    select r.org_id, r.title into v_buyer, v_title from public.requests r where r.id = new.request_id;
    perform app.notify_org(v_buyer, 'quote_received', 'New quote received',
                           v_title, '/app/requests/' || new.request_id);
    perform app.audit('quote.submitted', 'quote', new.id,
                      jsonb_build_object('request_id', new.request_id, 'version', new.version, 'total', new.total));
  end if;
  return new;
end;
$$;

create trigger after_quote_submitted
  after insert or update of status on public.quotes
  for each row execute function app.after_quote_submitted();

-- 4g. Keep quote totals equal to the sum of its lines, less the discount.
--     The discount applies before GST, so GST is reduced by the same share.
create function app.fill_quote_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_sub numeric;
  v_tax numeric;
begin
  select coalesce(sum(line_amount), 0), coalesce(sum(line_tax), 0)
    into v_sub, v_tax
    from public.quote_lines where quote_id = new.id;

  new.subtotal        := v_sub;
  new.discount_amount := round(v_sub * new.discount_pct / 100, 2);
  new.tax_amount      := round(v_tax * (100 - new.discount_pct) / 100, 2);
  return new;
end;
$$;

create trigger fill_quote_totals
  before insert or update on public.quotes
  for each row execute function app.fill_quote_totals();

-- When a line changes, touch its quote so fill_quote_totals runs again.
create function app.recalc_quote_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.quotes set subtotal = subtotal
   where id = coalesce(new.quote_id, old.quote_id);
  return null;
end;
$$;

create trigger recalc_quote_totals
  after insert or update or delete on public.quote_lines
  for each row execute function app.recalc_quote_totals();

revoke execute on all functions in schema app from public;
grant execute on function
  app.my_org_id(), app.my_role(), app.is_admin(), app.my_org_is_demo(),
  app.is_invited_to(uuid), app.owns_request(uuid), app.can_see_request(uuid)
to authenticated;
grant execute on function app.is_admin() to anon;  -- catalogue policy; always false for visitors


-- ----------------------------------------------------------------------------
-- 5. Actions the app calls (API functions)
-- ----------------------------------------------------------------------------

-- 5a. Startup approves one quote -> purchase order. All-or-nothing.
create function public.approve_quote(p_quote_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_quote public.quotes%rowtype;
  v_req   public.requests%rowtype;
  v_po    uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.id is null then
    raise exception 'Quote not found';
  end if;

  select * into v_req from public.requests where id = v_quote.request_id for update;

  if app.my_role() is distinct from 'startup' or v_req.org_id is distinct from app.my_org_id() then
    raise exception 'Not allowed';
  end if;
  if v_quote.status <> 'submitted' then
    raise exception 'Only a submitted quote can be approved';
  end if;
  if v_req.status not in ('open', 'comparing') then
    raise exception 'This request is already closed';
  end if;

  update public.quotes set status = 'accepted' where id = v_quote.id;
  update public.quotes set status = 'rejected'
   where request_id = v_req.id and id <> v_quote.id and status = 'submitted';
  update public.requests set status = 'ordered' where id = v_req.id;

  insert into public.purchase_orders
    (request_id, quote_id, buyer_org_id, vendor_org_id, total_amount, currency, approved_by)
  values
    (v_req.id, v_quote.id, v_req.org_id, v_quote.vendor_org_id, v_quote.total, v_quote.currency, auth.uid())
  returning id into v_po;

  perform app.notify_org(v_quote.vendor_org_id, 'quote_accepted', 'Your quote was accepted',
                         v_req.title, '/vendor/quotes');
  perform app.notify_org(q.vendor_org_id, 'quote_not_selected', 'Quote not selected', v_req.title, '/vendor/quotes')
     from public.quotes q
    where q.request_id = v_req.id and q.status = 'rejected';
  perform app.audit('quote.approved', 'purchase_order', v_po,
                    jsonb_build_object('request_id', v_req.id, 'quote_id', v_quote.id, 'total', v_quote.total));
  return v_po;
end;
$$;

-- 5b. Admin sets a supplier's verification status, with an optional note
--     (e.g. which document is missing when asking for more information).
create function public.set_vendor_verification(p_org_id uuid, p_status public.verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_status = 'not_required' then
    raise exception 'Invalid status for a supplier';
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

-- 5c. Order progress. The supplier moves it through production and delivery,
--     the startup marks it completed once delivered, admin can cancel.
create function public.update_order_status(p_po_id uuid, p_status public.po_status, p_expected_delivery date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_po      public.purchase_orders%rowtype;
  v_title   text;
  v_allowed boolean;
  v_order   constant public.po_status[] := array['issued', 'in_production', 'qc_passed', 'dispatched', 'delivered']::public.po_status[];
begin
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if v_po.id is null then
    raise exception 'Order not found';
  end if;
  if v_po.status in ('completed', 'cancelled') then
    raise exception 'This order is already closed';
  end if;

  if app.is_admin() then
    v_allowed := true;
  elsif v_po.vendor_org_id = app.my_org_id() then
    -- forward only, through the production steps
    v_allowed := p_status = any (v_order)
             and array_position(v_order, p_status) > array_position(v_order, v_po.status);
  elsif v_po.buyer_org_id = app.my_org_id() then
    v_allowed := p_status = 'completed' and v_po.status = 'delivered';
  else
    v_allowed := false;
  end if;

  if not v_allowed then
    raise exception 'Not allowed';
  end if;
  if p_expected_delivery is not null and v_po.vendor_org_id <> app.my_org_id() and not app.is_admin() then
    raise exception 'Only the supplier can set the delivery date';
  end if;

  update public.purchase_orders
     set status            = p_status,
         status_changed_at = now(),
         expected_delivery = coalesce(p_expected_delivery, expected_delivery)
   where id = v_po.id;

  select title into v_title from public.requests where id = v_po.request_id;
  perform app.notify_org(v_po.buyer_org_id, 'order_' || p_status::text,
                         'Order ' || v_po.po_number || ': ' || replace(p_status::text, '_', ' '), v_title, '/app/orders');
  perform app.notify_org(v_po.vendor_org_id, 'order_' || p_status::text,
                         'Order ' || v_po.po_number || ': ' || replace(p_status::text, '_', ' '), v_title, '/vendor/quotes');
  perform app.audit('order.status', 'purchase_order', v_po.id,
                    jsonb_build_object('from', v_po.status, 'to', p_status));
end;
$$;

revoke execute on function public.approve_quote(uuid) from public, anon;
revoke execute on function public.set_vendor_verification(uuid, public.verification_status, text) from public, anon;
revoke execute on function public.update_order_status(uuid, public.po_status, date) from public, anon;
grant  execute on function public.approve_quote(uuid) to authenticated;
grant  execute on function public.set_vendor_verification(uuid, public.verification_status, text) to authenticated;
grant  execute on function public.update_order_status(uuid, public.po_status, date) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Table access (grants). New tables are NOT auto-exposed in this project,
--    so access is granted explicitly. Row-level rules (section 7) then decide
--    WHICH rows each person sees.
-- ----------------------------------------------------------------------------
grant select on public.catalogue_categories, public.catalogue_items to anon, authenticated;
grant insert, update, delete on public.catalogue_categories, public.catalogue_items to authenticated;

grant select on public.organisations to authenticated;
grant update (name, gstin, udyam_number, city, state) on public.organisations to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select on public.startup_details to authenticated;
grant update (stage, industry, products_sold, team_size, funding_stage, has_dpiit, dpiit_number,
              annual_procurement_budget, turnaround_priority, interest_category_ids,
              procurement_description, government_interests)
  on public.startup_details to authenticated;

grant select on public.vendor_details to authenticated;
grant update (enterprise_type, pan_number, factory_address, machinery, monthly_capacity,
              capacity_utilisation_pct, certifications, moq, payment_terms,
              quality_testing_facilities, lead_time_days, pan_india_dispatch, schemes_utilised)
  on public.vendor_details to authenticated;

grant select, insert, delete on public.vendor_categories to authenticated;

grant select, insert, update, delete on public.requests, public.request_lines to authenticated;
grant select, insert, delete on public.rfq_invitations to authenticated;
grant update (status, responded_at) on public.rfq_invitations to authenticated;

grant select, insert on public.quotes to authenticated;
grant update (status, lead_time_days, valid_until, notes, currency, discount_pct, payment_terms) on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_lines to authenticated;

grant select on public.purchase_orders to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.audit_log to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Row-level security (who sees which rows)
-- ----------------------------------------------------------------------------
alter table public.organisations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.startup_details      enable row level security;
alter table public.vendor_details       enable row level security;
alter table public.catalogue_categories enable row level security;
alter table public.catalogue_items      enable row level security;
alter table public.vendor_categories    enable row level security;
alter table public.requests             enable row level security;
alter table public.request_lines        enable row level security;
alter table public.rfq_invitations      enable row level security;
alter table public.quotes               enable row level security;
alter table public.quote_lines          enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.notifications        enable row level security;
alter table public.audit_log            enable row level security;

-- Organisations: only your own; admin sees all. Other companies are seen
-- only through the anonymous views in section 8.
create policy org_select on public.organisations for select to authenticated using (
  id = (select app.my_org_id())
  or (select app.is_admin())
);
create policy org_update_own on public.organisations for update to authenticated
  using (id = (select app.my_org_id()))
  with check (id = (select app.my_org_id()));

-- Profiles: yourself, your colleagues; admin sees all.
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or org_id = (select app.my_org_id())
  or (select app.is_admin())
);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Business profiles: your own organisation; admin sees all. Rows are created
-- at sign-up, so there is no insert or delete.
create policy sd_select on public.startup_details for select to authenticated using (
  org_id = (select app.my_org_id()) or (select app.is_admin())
);
create policy sd_update on public.startup_details for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));

create policy vd_select on public.vendor_details for select to authenticated using (
  org_id = (select app.my_org_id()) or (select app.is_admin())
);
create policy vd_update on public.vendor_details for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));

-- Catalogue: everyone (even logged-out visitors) reads active items; admin edits.
create policy cat_select on public.catalogue_categories for select to anon, authenticated
  using (is_active or (select app.is_admin()));
create policy cat_admin_insert on public.catalogue_categories for insert to authenticated with check ((select app.is_admin()));
create policy cat_admin_update on public.catalogue_categories for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy cat_admin_delete on public.catalogue_categories for delete to authenticated using ((select app.is_admin()));

create policy item_select on public.catalogue_items for select to anon, authenticated
  using (is_active or (select app.is_admin()));
create policy item_admin_insert on public.catalogue_items for insert to authenticated with check ((select app.is_admin()));
create policy item_admin_update on public.catalogue_items for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy item_admin_delete on public.catalogue_items for delete to authenticated using ((select app.is_admin()));

-- Supplier categories: readable by signed-in users; suppliers manage their own.
create policy vc_select on public.vendor_categories for select to authenticated using (true);
create policy vc_insert on public.vendor_categories for insert to authenticated with check (
  vendor_org_id = (select app.my_org_id()) and (select app.my_role()) = 'vendor'
);
create policy vc_delete on public.vendor_categories for delete to authenticated using (
  vendor_org_id = (select app.my_org_id()) or (select app.is_admin())
);

-- Requests: the startup that owns it, invited suppliers (not drafts), admin.
create policy req_select on public.requests for select to authenticated using (
  org_id = (select app.my_org_id())
  or (select app.is_admin())
  or (status <> 'draft' and app.is_invited_to(id))
);
create policy req_insert on public.requests for insert to authenticated with check (
  org_id = (select app.my_org_id())
  and created_by = (select auth.uid())
  and (select app.my_role()) = 'startup'
  and status in ('draft', 'open')
);
-- Startups can move their request between draft/open/comparing/cancelled.
-- "ordered" is only set by approve_quote().
create policy req_update on public.requests for update to authenticated
  using (org_id = (select app.my_org_id()) and status <> 'ordered')
  with check (org_id = (select app.my_org_id()) and status in ('draft', 'open', 'comparing', 'cancelled'));
create policy req_delete on public.requests for delete to authenticated
  using (org_id = (select app.my_org_id()) and status = 'draft');

create policy rl_select on public.request_lines for select to authenticated
  using (app.can_see_request(request_id));
create policy rl_insert on public.request_lines for insert to authenticated
  with check (app.owns_request(request_id));
create policy rl_update on public.request_lines for update to authenticated
  using (app.owns_request(request_id)) with check (app.owns_request(request_id));
create policy rl_delete on public.request_lines for delete to authenticated
  using (app.owns_request(request_id));

-- Invitations: the startup that owns the request, the invited supplier, admin.
create policy inv_select on public.rfq_invitations for select to authenticated using (
  vendor_org_id = (select app.my_org_id())
  or app.owns_request(request_id)
  or (select app.is_admin())
);
create policy inv_insert on public.rfq_invitations for insert to authenticated
  with check (app.owns_request(request_id) and status = 'invited');
-- Supplier can mark "viewed" or "declined".
create policy inv_update_vendor on public.rfq_invitations for update to authenticated
  using (vendor_org_id = (select app.my_org_id()))
  with check (vendor_org_id = (select app.my_org_id()) and status in ('viewed', 'declined'));
create policy inv_delete on public.rfq_invitations for delete to authenticated
  using (app.owns_request(request_id) and status in ('invited', 'viewed'));

-- Quotes: supplier sees its own; startup sees non-draft quotes on its requests; admin.
create policy q_select on public.quotes for select to authenticated using (
  vendor_org_id = (select app.my_org_id())
  or (status <> 'draft' and app.owns_request(request_id))
  or (select app.is_admin())
);
create policy q_insert on public.quotes for insert to authenticated with check (
  vendor_org_id = (select app.my_org_id())
  and (select app.my_role()) = 'vendor'
  and status in ('draft', 'submitted')
);
-- Supplier edits a draft, submits it, or withdraws a submitted one.
create policy q_update on public.quotes for update to authenticated
  using (vendor_org_id = (select app.my_org_id()) and status in ('draft', 'submitted'))
  with check (vendor_org_id = (select app.my_org_id()) and status in ('draft', 'submitted', 'withdrawn'));

-- Quote lines follow their quote; only draft quotes can be edited.
create policy ql_select on public.quote_lines for select to authenticated using (
  exists (select 1 from public.quotes q where q.id = quote_id)  -- q_select applies
);
create policy ql_write on public.quote_lines for insert to authenticated with check (
  exists (select 1 from public.quotes q
          where q.id = quote_id and q.vendor_org_id = (select app.my_org_id()) and q.status = 'draft')
);
create policy ql_update on public.quote_lines for update to authenticated
  using (exists (select 1 from public.quotes q
                 where q.id = quote_id and q.vendor_org_id = (select app.my_org_id()) and q.status = 'draft'))
  with check (exists (select 1 from public.quotes q
                 where q.id = quote_id and q.vendor_org_id = (select app.my_org_id()) and q.status = 'draft'));
create policy ql_delete on public.quote_lines for delete to authenticated
  using (exists (select 1 from public.quotes q
                 where q.id = quote_id and q.vendor_org_id = (select app.my_org_id()) and q.status = 'draft'));

-- Purchase orders: buyer, supplier, admin. Created only by approve_quote().
create policy po_select on public.purchase_orders for select to authenticated using (
  buyer_org_id = (select app.my_org_id())
  or vendor_org_id = (select app.my_org_id())
  or (select app.is_admin())
);

-- Notifications: only your own; you can mark them read.
create policy notif_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Audit log: admin only.
create policy audit_select on public.audit_log for select to authenticated
  using ((select app.is_admin()));


-- ----------------------------------------------------------------------------
-- 8. Anonymous views (what one side may see about the other)
--    These run with the owner's rights, so they bypass the organisations
--    rule above, but they only ever return non-identifying columns:
--    no company name, GSTIN, Udyam, PAN, address, people or contacts.
-- ----------------------------------------------------------------------------

-- Anonymous code for any organisation in the same demo/real world.
-- Used to label quotes, invitations and orders ("MPI Verified Buyer #004").
create view public.org_public with (security_barrier) as
select o.id, o.type, o.display_name
  from public.organisations o
 where auth.uid() is not null
   and (o.is_demo = coalesce(app.my_org_is_demo(), false) or app.is_admin());

-- Verified suppliers a startup can browse and invite.
create view public.supplier_directory with (security_barrier) as
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
                       where vc.vendor_org_id = o.id), '{}') as category_ids
  from public.organisations o
  left join public.vendor_details vd on vd.org_id = o.id
 where o.type = 'vendor'
   and o.verification_status = 'verified'
   and auth.uid() is not null
   and app.my_role() in ('startup', 'admin')
   and (o.is_demo = coalesce(app.my_org_is_demo(), false) or app.is_admin());

revoke all on public.org_public, public.supplier_directory from public, anon;
grant select on public.org_public, public.supplier_directory to authenticated;

-- ============================================================================
-- End of migration
-- ============================================================================
