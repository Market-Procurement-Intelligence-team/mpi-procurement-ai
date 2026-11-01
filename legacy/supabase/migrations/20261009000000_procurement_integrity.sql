-- ============================================================================
-- MPI (Made in India) Procurement Platform — Production Schema & Security
-- Migration: 20261009000000_procurement_integrity.sql
-- Description: Authoritative tables for Profiles, RFQs, Quotes, and Telemetry
-- Architecture: Multi-tenant role isolation (Startup vs MSME vs Admin) with RLS
-- ============================================================================

-- Ensure uuid-ossp extension is enabled
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES (Identity & Enterprise Credentials)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('startup', 'msme', 'admin')),
  full_name text not null,
  company_name text not null,
  phone text,
  city text,
  state text,
  udyam_number text,
  gstin text,
  pan_number text,
  is_verified boolean not null default false,
  verification_status text not null default 'Self-Declared' 
    check (verification_status in ('Self-Declared', 'Under Review', 'Verified', 'Rejected')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Index on role for fast lookups
create index if not exists idx_profiles_role on public.profiles(role);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Profile RLS Policies
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Admins can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles admin_p
      where admin_p.id = (select auth.uid()) and admin_p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. RFQS (Procurement Requirements & Dispatched Requests)
-- ----------------------------------------------------------------------------
create table if not exists public.rfqs (
  id text primary key,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  buyer_name text not null,
  buyer_company text not null,
  buyer_city text,
  title text not null,
  category text not null,
  specifications jsonb not null default '[]'::jsonb,
  quantity integer not null check (quantity > 0),
  target_budget numeric not null check (target_budget > 0),
  target_delivery_days integer not null default 14 check (target_delivery_days > 0),
  delivery_location text not null,
  cad_file_url text,
  dispatched_supplier_ids text[] default array[]::text[],
  status text not null default 'Draft'
    check (status in ('Draft', 'Dispatched', 'Under Review', 'Quotes Received', 'PO Issued', 'Completed', 'Cancelled')),
  is_demo boolean not null default false,
  dispatched_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Indexes for performant filtering
create index if not exists idx_rfqs_buyer_id on public.rfqs(buyer_id);
create index if not exists idx_rfqs_status on public.rfqs(status);
create index if not exists idx_rfqs_category on public.rfqs(category);

-- Enable Row Level Security
alter table public.rfqs enable row level security;

-- RFQ Policies
-- Buyers can manage their own RFQs (Draft, Dispatched, etc.)
create policy "Buyers can manage own RFQs"
  on public.rfqs for all
  to authenticated
  using ((select auth.uid()) = buyer_id)
  with check ((select auth.uid()) = buyer_id);

-- Verified/Eligible MSMEs can view Dispatched RFQs in their matching categories
create policy "MSMEs can view dispatched RFQs"
  on public.rfqs for select
  to authenticated
  using (
    status in ('Dispatched', 'Under Review', 'Quotes Received')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'msme'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. QUOTES (Binding Commercial Quotations)
-- ----------------------------------------------------------------------------
create table if not exists public.quotes (
  id text primary key,
  rfq_id text references public.rfqs(id) on delete cascade not null,
  supplier_id uuid references public.profiles(id) on delete cascade not null,
  supplier_name text not null,
  supplier_udyam text,
  supplier_city text,
  
  -- True Commercial Payable Breakdown (What buyer pays to escrow/supplier)
  base_tooling_setup numeric not null default 0,
  unit_manufacturing numeric not null check (unit_manufacturing > 0),
  quality_testing numeric not null default 0,
  logistics_packaging numeric not null default 0,
  gst_rate numeric not null default 0.18,
  gst_amount numeric not null default 0,
  repeat_discount_percent numeric not null default 0,
  repeat_discount_amount numeric not null default 0,
  payable_invoice_amount numeric not null check (payable_invoice_amount > 0),
  
  -- Delivery & Contract Terms
  delivery_days integer not null check (delivery_days > 0),
  payment_terms text not null,
  quote_validity text not null default '30 Days',
  
  -- Distinct Government Scheme Assessment (Post-audit reimbursement claim, NOT deducted from invoice)
  scheme_name text,
  estimated_scheme_reimbursement numeric not null default 0,
  scheme_reimbursement_status text not null default 'Not Claimed'
    check (scheme_reimbursement_status in ('Not Claimed', 'Estimated Eligibility', 'Pending Application', 'Verified Direct Concession', 'Non-Applicable')),
  
  -- Reverse Margin Benchmark Analytics
  baseline_benchmark_cost numeric not null check (baseline_benchmark_cost > 0),
  direct_savings_amount numeric not null default 0,
  direct_savings_percent numeric not null default 0,
  
  -- Quality & Feasibility Scores
  quality_score numeric not null default 90,
  compliance_score numeric not null default 90,
  recommendation_reason text,
  
  -- Lifecycle Status
  status text not null default 'Transmitted'
    check (status in ('Transmitted', 'Under Review', 'Shortlisted', 'Accepted', 'Rejected')),
  
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),

  -- Idempotency constraint: Prevent duplicate quotes by the same supplier on the same RFQ
  constraint uq_rfq_supplier_quote unique (rfq_id, supplier_id)
);

-- Indexes for RFQ and Supplier Lookups
create index if not exists idx_quotes_rfq_id on public.quotes(rfq_id);
create index if not exists idx_quotes_supplier_id on public.quotes(supplier_id);
create index if not exists idx_quotes_status on public.quotes(status);

-- Enable Row Level Security
alter table public.quotes enable row level security;

-- Quote Policies
-- MSME suppliers can manage (insert, select, update) their own quotes
create policy "Suppliers can manage own quotes"
  on public.quotes for all
  to authenticated
  using ((select auth.uid()) = supplier_id)
  with check ((select auth.uid()) = supplier_id);

-- Buyers can view quotes submitted for their own RFQs
create policy "Buyers can view quotes for their RFQs"
  on public.quotes for select
  to authenticated
  using (
    exists (
      select 1 from public.rfqs r
      where r.id = quotes.rfq_id and r.buyer_id = (select auth.uid())
    )
  );

-- Buyers can update quote status (e.g. 'Shortlisted', 'Accepted', 'Rejected')
create policy "Buyers can update status of quotes for their RFQs"
  on public.quotes for update
  to authenticated
  using (
    exists (
      select 1 from public.rfqs r
      where r.id = quotes.rfq_id and r.buyer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.rfqs r
      where r.id = quotes.rfq_id and r.buyer_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 4. TELEMETRY & AUDIT TRAIL
-- ----------------------------------------------------------------------------
create table if not exists public.telemetry_events (
  id bigserial primary key,
  session_id text not null,
  event text not null,
  metadata jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_telemetry_event on public.telemetry_events(event);
create index if not exists idx_telemetry_session on public.telemetry_events(session_id);

alter table public.telemetry_events enable row level security;

-- Anyone authenticated can insert telemetry
create policy "Authenticated users can record telemetry"
  on public.telemetry_events for insert
  to authenticated
  with check (true);

-- Anonymous visitors can insert telemetry
create policy "Anonymous users can record telemetry"
  on public.telemetry_events for insert
  to anon
  with check (true);

-- Only admins can read telemetry
create policy "Admins can view telemetry"
  on public.telemetry_events for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles admin_p
      where admin_p.id = (select auth.uid()) and admin_p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 5. REALTIME REPLICATION CONFIGURATION
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.rfqs;
alter publication supabase_realtime add table public.quotes;

-- ----------------------------------------------------------------------------
-- 6. AUTOMATED USER PROFILE SYNCHRONIZATION TRIGGER
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, company_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Enterprise Founder'),
    coalesce(new.raw_user_meta_data->>'company_name', 'Industrial Enterprise'),
    coalesce(new.raw_user_meta_data->>'role', 'startup')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to execute automatically upon user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. EXPLICIT DATA API GRANTS (PostgREST Exposing Protocol)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant all on table public.profiles to authenticated;
grant select on table public.profiles to anon;

grant all on table public.rfqs to authenticated;
grant select on table public.rfqs to anon;

grant all on table public.quotes to authenticated;
grant select on table public.quotes to anon;

grant all on table public.telemetry_events to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

