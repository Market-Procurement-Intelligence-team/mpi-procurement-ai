-- ============================================================================
-- MPI · Migration 20261124120000 · Freelancer providers (step 1: database)
--
-- Freelancers are a second kind of service provider, next to businesses.
-- A freelancer is a supplier organisation of one person (provider_type
-- 'individual') with a public-facing profile they build themselves:
-- headline, bio, skills, projects, experience, certificates and courses,
-- education, and fixed-price service packages.
--
-- Privacy (follows the client's Freelancer Provider brief, 20 Nov 2026):
--   * Startups never see a freelancer's name, PAN, bank details, client
--     names, company names or links. They see the anonymous code
--     ("MPI Verified Supplier #012") and the work itself, through the
--     freelancer_* views below, and only for profiles MPI has approved.
--   * The freelancer sees and edits their own profile. Status fields
--     (approval, payout check) are changed only by MPI through functions.
--   * MPI (admin) sees everything.
--
-- Freelancer sign-up is behind a switch (platform_settings.freelancers_enabled,
-- off by default) and freelancers can pick only categories MPI has opened to
-- them (catalogue_categories.freelancers_allowed).
--
-- Freelancers are kept out of the existing goods/supplier matching for now:
-- their organisation's verification_status is 'not_required', so the current
-- matching, supplier directory and supplier verification queue skip them.
-- Freelancer matching comes in a later step.
--
-- Run after 20261104120000_request_schemes.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Switches
-- ----------------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists freelancers_enabled boolean not null default false;

alter table public.catalogue_categories
  add column if not exists freelancers_allowed boolean not null default false;

update public.catalogue_categories
   set freelancers_allowed = true
 where slug in ('packaging-and-printing', 'it-and-digital-services', 'marketing-and-sales-support');

-- Business (default) or a single person (freelancer).
alter table public.organisations
  add column if not exists provider_type text not null default 'business'
  check (provider_type in ('business', 'individual'));

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- The freelancer's profile. One per freelancer organisation.
create table public.provider_profiles (
  org_id               uuid primary key references public.organisations (id) on delete cascade,
  headline             text check (headline is null or char_length(headline) <= 120),
  bio                  text check (bio is null or char_length(bio) <= 2000),
  years_experience     integer check (years_experience is null or years_experience between 0 and 60),
  -- [{"name": "Hindi", "level": "fluent"}], level: basic | conversational | fluent | native
  languages            jsonb not null default '[]'::jsonb check (jsonb_typeof(languages) = 'array'),
  tools                text[] not null default '{}',
  work_mode            text not null default 'remote' check (work_mode in ('remote', 'on_site', 'both')),
  service_area         text check (service_area is null or char_length(service_area) <= 200),
  availability         text not null default 'available' check (availability in ('available', 'limited', 'busy')),
  max_parallel_projects integer not null default 2 check (max_parallel_projects between 1 and 20),
  usual_delivery_days  integer check (usual_delivery_days is null or usual_delivery_days between 1 and 365),
  -- Private: seen by the freelancer and MPI only.
  legal_name           text check (legal_name is null or char_length(legal_name) <= 200),
  payout_reference     text check (payout_reference is null or char_length(payout_reference) <= 200),
  -- Set by MPI only (through the functions in section 5).
  status               text not null default 'draft'
                       check (status in ('draft', 'pending_review', 'active', 'paused', 'suspended')),
  status_note          text,
  submitted_at         timestamptz,
  reviewed_by          uuid references public.profiles (id),
  reviewed_at          timestamptz,
  payout_status        text not null default 'not_started'
                       check (payout_status in ('not_started', 'pending', 'verified', 'rejected')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index provider_profiles_status_idx on public.provider_profiles (status);

-- The skills list freelancers pick from, grouped by category.
create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.catalogue_categories (id) on delete cascade,
  slug        text not null unique,
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);
create index skills_category_idx on public.skills (category_id);

create table public.provider_skills (
  org_id   uuid not null references public.provider_profiles (org_id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level    text not null default 'intermediate' check (level in ('beginner', 'intermediate', 'expert')),
  years    integer check (years is null or years between 0 and 60),
  primary key (org_id, skill_id)
);

-- Past work. client_name and link are private to the freelancer and MPI.
create table public.provider_projects (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.provider_profiles (org_id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 120),
  category_id   uuid references public.catalogue_categories (id) on delete set null,
  role_and_work text check (role_and_work is null or char_length(role_and_work) <= 1500),
  tools         text[] not null default '{}',
  result        text check (result is null or char_length(result) <= 500),
  year          integer check (year is null or year between 1980 and 2100),
  link          text check (link is null or char_length(link) <= 500),
  client_kind   text check (client_kind is null or char_length(client_kind) <= 120),  -- "D2C food startup"
  client_name   text check (client_name is null or char_length(client_name) <= 200),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index provider_projects_org_idx on public.provider_projects (org_id);

-- Work history. company_name is private to the freelancer and MPI.
create table public.provider_experience (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.provider_profiles (org_id) on delete cascade,
  role_title   text not null check (char_length(role_title) between 2 and 120),
  company_kind text check (company_kind is null or char_length(company_kind) <= 120),
  company_name text check (company_name is null or char_length(company_name) <= 200),
  started_on   date not null,
  ended_on     date,  -- empty = still working there
  description  text check (description is null or char_length(description) <= 1500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);
create index provider_experience_org_idx on public.provider_experience (org_id);

-- Certificates, courses and education. link is private to the freelancer and MPI.
create table public.provider_credentials (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.provider_profiles (org_id) on delete cascade,
  kind       text not null check (kind in ('certification', 'course', 'education')),
  title      text not null check (char_length(title) between 2 and 160),
  issuer     text check (issuer is null or char_length(issuer) <= 160),
  year       integer check (year is null or year between 1950 and 2100),
  link       text check (link is null or char_length(link) <= 500),
  created_at timestamptz not null default now()
);
create index provider_credentials_org_idx on public.provider_credentials (org_id);

-- Fixed-price service packages ("Logo + brand kit, 3 revisions, 7 days").
create table public.provider_packages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.provider_profiles (org_id) on delete cascade,
  category_id     uuid not null references public.catalogue_categories (id),
  title           text not null check (char_length(title) between 3 and 120),
  deliverables    text[] not null default '{}',
  exclusions      text[] not null default '{}',
  price           numeric(14,2) not null check (price > 0),
  revision_rounds integer not null default 2 check (revision_rounds between 0 and 10),
  turnaround_days integer not null check (turnaround_days between 1 and 365),
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index provider_packages_org_idx on public.provider_packages (org_id);

-- Identity, business, bank and credential checks. The freelancer adds a
-- check with a reference to the evidence; MPI decides.
create table public.provider_verifications (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.provider_profiles (org_id) on delete cascade,
  kind         text not null check (kind in ('identity_pan', 'gst', 'udyam', 'bank', 'credential')),
  status       text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'expired')),
  evidence_ref text check (evidence_ref is null or char_length(evidence_ref) <= 500),
  note         text,
  reviewed_by  uuid references public.profiles (id),
  verified_at  timestamptz,
  expires_at   date,
  created_at   timestamptz not null default now()
);
create index provider_verifications_org_idx on public.provider_verifications (org_id);

-- ----------------------------------------------------------------------------
-- 3. Skills list (sample, MPI can edit)
-- ----------------------------------------------------------------------------
insert into public.skills (category_id, slug, name, sort_order)
select c.id, v.slug, v.name, v.n
  from (values
    ('packaging-and-printing', 'packaging-design',     'Packaging design', 1),
    ('packaging-and-printing', 'label-design',         'Label design', 2),
    ('packaging-and-printing', 'dieline-artwork',      'Dieline and print-ready artwork', 3),
    ('packaging-and-printing', 'product-3d-mockups',   '3D product mockups', 4),
    ('packaging-and-printing', 'print-production',     'Print production support', 5),
    ('packaging-and-printing', 'brand-identity',       'Logo and brand identity', 6),
    ('it-and-digital-services', 'web-development',     'Website development', 1),
    ('it-and-digital-services', 'mobile-apps',         'Mobile app development', 2),
    ('it-and-digital-services', 'ui-ux-design',        'UI/UX design', 3),
    ('it-and-digital-services', 'shopify-woocommerce', 'Shopify / WooCommerce stores', 4),
    ('it-and-digital-services', 'backend-apis',        'Backend and APIs', 5),
    ('it-and-digital-services', 'data-analytics',      'Data and analytics dashboards', 6),
    ('it-and-digital-services', 'qa-testing',          'Testing and QA', 7),
    ('it-and-digital-services', 'cloud-devops',        'Cloud and DevOps', 8),
    ('marketing-and-sales-support', 'social-media',    'Social media management', 1),
    ('marketing-and-sales-support', 'performance-ads', 'Performance ads (Meta, Google)', 2),
    ('marketing-and-sales-support', 'seo',             'SEO', 3),
    ('marketing-and-sales-support', 'content-writing', 'Content and copywriting', 4),
    ('marketing-and-sales-support', 'video-editing',   'Video editing', 5),
    ('marketing-and-sales-support', 'product-photos',  'Product photography', 6),
    ('marketing-and-sales-support', 'email-marketing', 'Email and WhatsApp marketing', 7),
    ('marketing-and-sales-support', 'influencer-outreach', 'Influencer outreach', 8)
  ) as v(cat, slug, name, n)
  join public.catalogue_categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Automatic behaviour
-- ----------------------------------------------------------------------------
create trigger touch before update on public.provider_profiles   for each row execute function app.touch_updated_at();
create trigger touch before update on public.provider_projects   for each row execute function app.touch_updated_at();
create trigger touch before update on public.provider_experience for each row execute function app.touch_updated_at();
create trigger touch before update on public.provider_packages   for each row execute function app.touch_updated_at();

-- Keep profiles a sensible size. TG_ARGV[0] = the most rows one freelancer may have.
create function app.cap_provider_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  execute format('select count(*) from public.%I where org_id = $1', tg_table_name) into v_n using new.org_id;
  if v_n >= tg_argv[0]::integer then
    raise exception 'You can add up to % of these', tg_argv[0];
  end if;
  return new;
end;
$$;
create trigger cap before insert on public.provider_skills      for each row execute function app.cap_provider_rows('25');
create trigger cap before insert on public.provider_projects    for each row execute function app.cap_provider_rows('20');
create trigger cap before insert on public.provider_experience  for each row execute function app.cap_provider_rows('20');
create trigger cap before insert on public.provider_credentials for each row execute function app.cap_provider_rows('20');
create trigger cap before insert on public.provider_packages    for each row execute function app.cap_provider_rows('10');
create trigger cap before insert on public.provider_verifications for each row execute function app.cap_provider_rows('20');

-- Freelancers can offer only categories MPI has opened to freelancers.
create function app.check_provider_category() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(new);
  v_org uuid  := coalesce(v_row ->> 'vendor_org_id', v_row ->> 'org_id')::uuid;
begin
  if exists (select 1 from public.organisations where id = v_org and provider_type = 'individual')
     and not exists (select 1 from public.catalogue_categories
                      where id = new.category_id and freelancers_allowed and is_active) then
    raise exception 'This category is not open to freelancers yet';
  end if;
  return new;
end;
$$;
create trigger check_provider_category before insert on public.vendor_categories
  for each row execute function app.check_provider_category();
create trigger check_provider_category before insert or update of category_id on public.provider_packages
  for each row execute function app.check_provider_category();

-- On sign-up: add 'freelancer' as an account type (only while the switch is on).
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_type      text := coalesce(new.raw_user_meta_data ->> 'account_type', 'startup');
  v_freelance boolean := false;
  v_org       uuid;
begin
  if v_type = 'freelancer' then
    if not coalesce((select freelancers_enabled from public.platform_settings), false) then
      raise exception 'Freelancer sign-up is not open yet';
    end if;
    v_freelance := true;
    v_type := 'vendor';
  elsif v_type not in ('startup', 'vendor') then
    v_type := 'startup';
  end if;

  insert into public.organisations (name, type, verification_status, provider_type)
  values (
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''),
             case when v_freelance then nullif(trim(new.raw_user_meta_data ->> 'full_name'), '') end,
             'My organisation'),
    v_type::public.org_type,
    case when v_freelance then 'not_required'
         when v_type = 'vendor' then 'pending'
         else 'not_required' end::public.verification_status,
    case when v_freelance then 'individual' else 'business' end
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

  if v_freelance then
    insert into public.provider_profiles (org_id, legal_name)
    values (v_org, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  end if;

  return new;
end;
$$;

-- Is the signed-in user's organisation a freelancer?
create function app.my_org_is_freelancer() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select o.provider_type = 'individual' from public.organisations o
                    where o.id = app.my_org_id()), false);
$$;

-- ----------------------------------------------------------------------------
-- 5. Actions (functions the app calls)
-- ----------------------------------------------------------------------------

-- Anyone, even before signing in: is freelancer sign-up open?
create function public.freelancers_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select freelancers_enabled from public.platform_settings), false);
$$;

-- Admin: open or close freelancer sign-up.
create function public.set_freelancers_enabled(p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  update public.platform_settings
     set freelancers_enabled = coalesce(p_on, false), updated_by = auth.uid(), updated_at = now();
  perform app.audit('settings.freelancers', 'platform_settings', null,
                    jsonb_build_object('enabled', coalesce(p_on, false)));
end;
$$;

-- Freelancer: send the profile to MPI for review.
create function public.submit_provider_profile() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.my_org_id();
  v_p   public.provider_profiles;
  v_missing text[] := '{}';
begin
  select * into v_p from public.provider_profiles where org_id = v_org;
  if v_p.org_id is null then
    raise exception 'Only freelancers have a provider profile';
  end if;
  if v_p.status not in ('draft', 'paused') then
    raise exception 'This profile is already %', replace(v_p.status, '_', ' ');
  end if;

  if coalesce(trim(v_p.headline), '') = '' then v_missing := v_missing || 'a headline'::text; end if;
  if coalesce(char_length(trim(v_p.bio)), 0) < 50 then v_missing := v_missing || 'a short bio (50+ characters)'::text; end if;
  if not exists (select 1 from public.vendor_categories where vendor_org_id = v_org) then
    v_missing := v_missing || 'at least one category'::text;
  end if;
  if not exists (select 1 from public.provider_skills where org_id = v_org) then
    v_missing := v_missing || 'at least one skill'::text;
  end if;
  if not exists (select 1 from public.provider_projects where org_id = v_org)
     and not exists (select 1 from public.provider_experience where org_id = v_org) then
    v_missing := v_missing || 'a project or past work experience'::text;
  end if;
  if not exists (select 1 from public.provider_packages where org_id = v_org and is_active) then
    v_missing := v_missing || 'at least one service package'::text;
  end if;
  if array_length(v_missing, 1) > 0 then
    raise exception 'Before sending for review, add %', array_to_string(v_missing, ', ');
  end if;

  update public.provider_profiles
     set status = 'pending_review', submitted_at = now(), status_note = null
   where org_id = v_org;

  perform app.notify_admins('provider_review', 'Freelancer profile to review',
          (select display_name from public.organisations where id = v_org) || ' sent their profile for review',
          '/admin/freelancers?p=' || v_org);
  perform app.audit('provider.submitted', 'organisation', v_org, '{}'::jsonb);
end;
$$;

-- Freelancer: pause (stop getting new work) or resume an approved profile.
create function public.set_provider_paused(p_paused boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.my_org_id();
begin
  update public.provider_profiles
     set status = case when p_paused then 'paused' else 'active' end
   where org_id = v_org
     and status = case when p_paused then 'active' else 'paused' end
     and (p_paused or reviewed_at is not null);
  if not found then
    raise exception 'Only an approved profile can be paused or resumed';
  end if;
  perform app.audit(case when p_paused then 'provider.paused' else 'provider.resumed' end,
                    'organisation', v_org, '{}'::jsonb);
end;
$$;

-- Admin: decide on a freelancer profile.
--   p_decision: 'approve' (-> active), 'changes' (-> back to draft with a note),
--               'suspend' (-> suspended).
create function public.review_provider_profile(p_org_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  v_status := case p_decision when 'approve' then 'active' when 'changes' then 'draft'
                              when 'suspend' then 'suspended' end;
  if v_status is null then
    raise exception 'Decision must be approve, changes or suspend';
  end if;
  if p_decision = 'changes' and coalesce(trim(p_note), '') = '' then
    raise exception 'Say what the freelancer should change';
  end if;

  update public.provider_profiles
     set status = v_status, status_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where org_id = p_org_id;
  if not found then
    raise exception 'Freelancer not found';
  end if;

  perform app.notify_org(p_org_id, 'provider_' || p_decision,
          case p_decision when 'approve' then 'Your freelancer profile is live'
                          when 'changes' then 'MPI asked for changes to your profile'
                          else 'Your freelancer profile is suspended' end,
          p_note, '/vendor/profile');
  perform app.audit('provider.' || p_decision, 'organisation', p_org_id,
                    jsonb_build_object('note', p_note));
end;
$$;

-- Admin: decide on one verification (identity, GST, Udyam, bank, credential).
-- A verified or rejected bank check also sets the payout status.
create function public.review_provider_verification(p_id uuid, p_status text, p_note text default null,
                                                    p_expires_at date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_v public.provider_verifications;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_status not in ('verified', 'rejected', 'expired') then
    raise exception 'Status must be verified, rejected or expired';
  end if;

  update public.provider_verifications
     set status = p_status, note = p_note, reviewed_by = auth.uid(),
         verified_at = case when p_status = 'verified' then now() else verified_at end,
         expires_at = coalesce(p_expires_at, expires_at)
   where id = p_id
  returning * into v_v;
  if v_v.id is null then
    raise exception 'Verification not found';
  end if;

  if v_v.kind = 'bank' then
    update public.provider_profiles
       set payout_status = case p_status when 'verified' then 'verified' else 'rejected' end
     where org_id = v_v.org_id;
  end if;

  perform app.notify_org(v_v.org_id, 'provider_verification_' || p_status,
          'Check ' || p_status || ': ' || replace(v_v.kind, '_', ' '), p_note, '/vendor/profile');
  perform app.audit('provider.verification', 'provider_verification', p_id,
                    jsonb_build_object('kind', v_v.kind, 'status', p_status, 'org_id', v_v.org_id));
end;
$$;

-- A new bank check puts the payout status to pending.
create function app.after_provider_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'bank' then
    update public.provider_profiles set payout_status = 'pending' where org_id = new.org_id;
  end if;
  return new;
end;
$$;
create trigger after_insert after insert on public.provider_verifications
  for each row execute function app.after_provider_verification();

revoke execute on function public.freelancers_open() from public;
revoke execute on function public.set_freelancers_enabled(boolean) from public, anon;
revoke execute on function public.submit_provider_profile() from public, anon;
revoke execute on function public.set_provider_paused(boolean) from public, anon;
revoke execute on function public.review_provider_profile(uuid, text, text) from public, anon;
revoke execute on function public.review_provider_verification(uuid, text, text, date) from public, anon;
revoke execute on function app.my_org_is_freelancer(), app.cap_provider_rows(), app.check_provider_category(),
                           app.after_provider_verification() from public;
grant execute on function public.freelancers_open() to anon, authenticated;
grant execute on function public.set_freelancers_enabled(boolean), public.submit_provider_profile(),
                          public.set_provider_paused(boolean), public.review_provider_profile(uuid, text, text),
                          public.review_provider_verification(uuid, text, text, date) to authenticated;
grant execute on function app.my_org_is_freelancer() to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Table access. Status columns are not in the update lists, so only the
--    functions above can change them.
-- ----------------------------------------------------------------------------
-- Start from nothing, whatever the project's default for new tables is.
revoke all on public.skills, public.provider_profiles, public.provider_skills, public.provider_projects,
              public.provider_experience, public.provider_credentials, public.provider_packages,
              public.provider_verifications from public, anon, authenticated;

grant select on public.skills to authenticated;
grant insert, update, delete on public.skills to authenticated;  -- admin only, by the rules below

grant select on public.provider_profiles to authenticated;
grant update (headline, bio, years_experience, languages, tools, work_mode, service_area, availability,
              max_parallel_projects, usual_delivery_days, legal_name, payout_reference)
  on public.provider_profiles to authenticated;

grant select, insert, update, delete on public.provider_skills, public.provider_projects,
  public.provider_experience, public.provider_credentials, public.provider_packages to authenticated;

grant select, delete on public.provider_verifications to authenticated;
grant insert (org_id, kind, evidence_ref) on public.provider_verifications to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Row rules
-- ----------------------------------------------------------------------------
alter table public.skills                 enable row level security;
alter table public.provider_profiles      enable row level security;
alter table public.provider_skills        enable row level security;
alter table public.provider_projects      enable row level security;
alter table public.provider_experience    enable row level security;
alter table public.provider_credentials   enable row level security;
alter table public.provider_packages      enable row level security;
alter table public.provider_verifications enable row level security;

create policy skills_select on public.skills for select to authenticated
  using (is_active or (select app.is_admin()));
create policy skills_admin_insert on public.skills for insert to authenticated with check ((select app.is_admin()));
create policy skills_admin_update on public.skills for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy skills_admin_delete on public.skills for delete to authenticated using ((select app.is_admin()));

-- The freelancer's own profile; MPI sees all. Rows are made at sign-up.
create policy pp_select on public.provider_profiles for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy pp_update on public.provider_profiles for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));

-- Skills, projects, experience, credentials, packages: the freelancer manages
-- their own; MPI sees all and can remove anything.
create policy ps_own_select on public.provider_skills for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy ps_own_insert on public.provider_skills for insert to authenticated
  with check (org_id = (select app.my_org_id()) and (select app.my_org_is_freelancer()));
create policy ps_own_update on public.provider_skills for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));
create policy ps_own_delete on public.provider_skills for delete to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));

create policy pj_select on public.provider_projects for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy pj_insert on public.provider_projects for insert to authenticated
  with check (org_id = (select app.my_org_id()) and (select app.my_org_is_freelancer()));
create policy pj_update on public.provider_projects for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));
create policy pj_delete on public.provider_projects for delete to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));

create policy px_select on public.provider_experience for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy px_insert on public.provider_experience for insert to authenticated
  with check (org_id = (select app.my_org_id()) and (select app.my_org_is_freelancer()));
create policy px_update on public.provider_experience for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));
create policy px_delete on public.provider_experience for delete to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));

create policy pc_select on public.provider_credentials for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy pc_insert on public.provider_credentials for insert to authenticated
  with check (org_id = (select app.my_org_id()) and (select app.my_org_is_freelancer()));
create policy pc_update on public.provider_credentials for update to authenticated
  using (org_id = (select app.my_org_id())) with check (org_id = (select app.my_org_id()));
create policy pc_delete on public.provider_credentials for delete to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));

create policy pk_select on public.provider_packages for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy pk_insert on public.provider_packages for insert to authenticated
  with check (org_id = (select app.my_org_id()) and (select app.my_org_is_freelancer()));
create policy pk_update on public.provider_packages for update to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()))
  with check (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy pk_delete on public.provider_packages for delete to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));

-- Verifications: the freelancer adds pending checks and can withdraw a
-- pending one; MPI decides through review_provider_verification().
create policy pv_select on public.provider_verifications for select to authenticated
  using (org_id = (select app.my_org_id()) or (select app.is_admin()));
create policy pv_insert on public.provider_verifications for insert to authenticated
  with check (org_id = (select app.my_org_id()) and (select app.my_org_is_freelancer()));
create policy pv_delete on public.provider_verifications for delete to authenticated
  using ((org_id = (select app.my_org_id()) and status = 'pending') or (select app.is_admin()));

-- ----------------------------------------------------------------------------
-- 8. What startups see: approved freelancers only, anonymously, in the same
--    demo/real world, and only while freelancers are switched on. No names,
--    PAN, bank, client or company names, or links.
-- ----------------------------------------------------------------------------
create function app.can_browse_freelancers() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and (app.is_admin()
          or (app.my_role() = 'startup'
              and coalesce((select freelancers_enabled from public.platform_settings), false)));
$$;
revoke execute on function app.can_browse_freelancers() from public;
grant execute on function app.can_browse_freelancers() to authenticated;

create view public.freelancer_directory with (security_barrier) as
select o.id,
       o.display_name,
       o.city,
       o.state,
       p.headline,
       p.bio,
       p.years_experience,
       p.languages,
       p.tools,
       p.work_mode,
       p.service_area,
       p.availability,
       p.max_parallel_projects,
       p.usual_delivery_days,
       p.reviewed_at as approved_at,
       coalesce(array(select vc.category_id from public.vendor_categories vc
                       where vc.vendor_org_id = o.id), '{}') as category_ids,
       coalesce((select jsonb_agg(jsonb_build_object('skill_id', s.id, 'name', s.name,
                                                     'category_id', s.category_id,
                                                     'level', ps.level, 'years', ps.years)
                                  order by s.sort_order, s.name)
                   from public.provider_skills ps join public.skills s on s.id = ps.skill_id
                  where ps.org_id = o.id), '[]'::jsonb) as skills,
       coalesce(array(select distinct v.kind from public.provider_verifications v
                       where v.org_id = o.id and v.status = 'verified'
                         and (v.expires_at is null or v.expires_at >= current_date)
                       order by v.kind), '{}') as verified_checks,
       (select min(pk.price) from public.provider_packages pk
         where pk.org_id = o.id and pk.is_active) as starting_price
  from public.organisations o
  join public.provider_profiles p on p.org_id = o.id
 where o.provider_type = 'individual'
   and p.status = 'active'
   and app.can_browse_freelancers()
   and (o.is_demo = coalesce(app.my_org_is_demo(), false) or app.is_admin());

create view public.freelancer_projects with (security_barrier) as
select pj.id, pj.org_id, pj.title, pj.category_id, pj.role_and_work, pj.tools, pj.result,
       pj.year, pj.client_kind, pj.sort_order
  from public.provider_projects pj
 where pj.org_id in (select id from public.freelancer_directory);

create view public.freelancer_experience with (security_barrier) as
select px.id, px.org_id, px.role_title, px.company_kind, px.started_on, px.ended_on, px.description
  from public.provider_experience px
 where px.org_id in (select id from public.freelancer_directory);

create view public.freelancer_credentials with (security_barrier) as
select pc.id, pc.org_id, pc.kind, pc.title, pc.issuer, pc.year
  from public.provider_credentials pc
 where pc.org_id in (select id from public.freelancer_directory);

create view public.freelancer_packages with (security_barrier) as
select pk.id, pk.org_id, pk.category_id, pk.title, pk.deliverables, pk.exclusions, pk.price,
       pk.revision_rounds, pk.turnaround_days, pk.sort_order
  from public.provider_packages pk
 where pk.is_active
   and pk.org_id in (select id from public.freelancer_directory);

revoke all on public.freelancer_directory, public.freelancer_projects, public.freelancer_experience,
              public.freelancer_credentials, public.freelancer_packages from public, anon;
grant select on public.freelancer_directory, public.freelancer_projects, public.freelancer_experience,
                public.freelancer_credentials, public.freelancer_packages to authenticated;

-- ============================================================================
-- End of migration
-- ============================================================================
