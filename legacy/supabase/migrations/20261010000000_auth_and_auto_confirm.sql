-- ============================================================================
-- MPI AI Procurement Co-Founder — Migration 20261010000000
-- Automated User Confirmation, Canonical Seed Accounts & RLS Optimization
-- ============================================================================

-- 1. AUTO-CONFIRM TRIGGER FOR AUTH.USERS
-- Automatically marks new user email as confirmed so email-verification does not block dev/test workflows
create or replace function public.auto_confirm_new_user()
returns trigger as $$
begin
  new.email_confirmed_at = coalesce(new.email_confirmed_at, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_confirm on auth.users;
create trigger on_auth_user_created_confirm
  before insert on auth.users
  for each row execute procedure public.auto_confirm_new_user();

-- Auto-confirm any existing users
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- 2. CURRENT USER ROLE HELPER (Security Definer to eliminate RLS recursion)
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

grant execute on function public.current_user_role() to authenticated, anon;

-- 3. PROFILE POLICIES (Allow authenticated users to view profiles and manage own)
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Authenticated users can view basic profiles" on public.profiles;
create policy "Authenticated users can view basic profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- 4. RFQ POLICIES (Refined with current_user_role for MSMEs)
drop policy if exists "Buyers can manage own RFQs" on public.rfqs;
create policy "Buyers can manage own RFQs"
  on public.rfqs for all
  to authenticated
  using ((select auth.uid()) = buyer_id)
  with check ((select auth.uid()) = buyer_id);

drop policy if exists "MSMEs can view dispatched RFQs" on public.rfqs;
create policy "MSMEs can view dispatched RFQs"
  on public.rfqs for select
  to authenticated
  using (
    status in ('Dispatched', 'Under Review', 'Quotes Received')
    and (public.current_user_role() = 'msme' or buyer_id = (select auth.uid()))
  );

-- 5. QUOTE POLICIES
drop policy if exists "Suppliers can manage own quotes" on public.quotes;
create policy "Suppliers can manage own quotes"
  on public.quotes for all
  to authenticated
  using ((select auth.uid()) = supplier_id)
  with check ((select auth.uid()) = supplier_id);

drop policy if exists "Buyers can view quotes for their RFQs" on public.quotes;
create policy "Buyers can view quotes for their RFQs"
  on public.quotes for select
  to authenticated
  using (
    exists (
      select 1 from public.rfqs r
      where r.id = quotes.rfq_id and r.buyer_id = (select auth.uid())
    )
  );

drop policy if exists "Buyers can update status of quotes for their RFQs" on public.quotes;
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

-- 6. CANONICAL SEED ACCOUNTS (Startup Founder & MSME Director)
do $$
declare
  v_startup_id uuid := '11111111-1111-1111-1111-111111111111';
  v_msme_id uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- 6.1 Startup Founder (founder@novabio.tech / founder@123)
  if not exists (select 1 from auth.users where email = 'founder@novabio.tech') then
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
    ) values (
      v_startup_id,
      '00000000-0000-0000-0000-000000000000',
      'founder@novabio.tech',
      extensions.crypt('Founder@123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Aarav Mehta","company_name":"NovaBio Health","role":"startup"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt('Founder@123', extensions.gen_salt('bf')),
        email_confirmed_at = now()
    where email = 'founder@novabio.tech';
    select id into v_startup_id from auth.users where email = 'founder@novabio.tech';
  end if;

  insert into public.profiles (id, full_name, company_name, role, city, verification_status)
  values (
    v_startup_id,
    'Aarav Mehta',
    'NovaBio Health',
    'startup',
    'Bengaluru',
    'Verified'
  ) on conflict (id) do update set role = 'startup', full_name = 'Aarav Mehta', company_name = 'NovaBio Health';

  -- 6.2 MSME Director (director@apexprecision.in / Apex@123)
  if not exists (select 1 from auth.users where email = 'director@apexprecision.in') then
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
    ) values (
      v_msme_id,
      '00000000-0000-0000-0000-000000000000',
      'director@apexprecision.in',
      extensions.crypt('Apex@123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rajesh Sharma","company_name":"Apex Precision Packaging Ltd.","role":"msme"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt('Apex@123', extensions.gen_salt('bf')),
        email_confirmed_at = now()
    where email = 'director@apexprecision.in';
    select id into v_msme_id from auth.users where email = 'director@apexprecision.in';
  end if;

  insert into public.profiles (id, full_name, company_name, role, city, verification_status)
  values (
    v_msme_id,
    'Rajesh Sharma',
    'Apex Precision Packaging Ltd.',
    'msme',
    'Pune',
    'Verified'
  ) on conflict (id) do update set role = 'msme', full_name = 'Rajesh Sharma', company_name = 'Apex Precision Packaging Ltd.';
end $$;
