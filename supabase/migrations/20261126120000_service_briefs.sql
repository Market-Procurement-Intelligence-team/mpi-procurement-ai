-- ============================================================================
-- MPI · Migration 20261126120000 · Service briefs
--
-- A startup that needs a service (design, a website, marketing) now writes a
-- SERVICE BRIEF instead of a list of items. It is still a normal request, so
-- My requests, admin AI matches, schemes and notifications keep working.
-- A brief adds:
--   kind                 'goods' (as before) or 'service'
--   deliverables         what the startup gets, each with "done when":
--                        [{"title": "...", "done_when": "..."}], up to 10
--   skill_ids            skills needed (public.skills), used for matching later
--   revision_rounds      rounds of changes the startup wants (0 to 10)
--   provider_preference  any / business / freelancer
--   proposals_wanted     how many proposals the startup wants (1 to 3)
--   reference_links      links to examples or brand files (files come later)
--
-- Each deliverable is also saved as a request line (by the app), so service
-- businesses can keep quoting the current way until proposals arrive.
-- None of these fields is private: suppliers may read them, like the title.
-- The budget stays private as before.
--
-- Old requests become 'goods'. Run after 20261124130000. Safe to run again.
-- ============================================================================

alter table public.requests
  add column if not exists kind text not null default 'goods',
  add column if not exists deliverables jsonb not null default '[]',
  add column if not exists skill_ids uuid[] not null default '{}',
  add column if not exists revision_rounds smallint,
  add column if not exists provider_preference text not null default 'any',
  add column if not exists proposals_wanted smallint not null default 3,
  add column if not exists reference_links text[] not null default '{}';

alter table public.requests drop constraint if exists requests_kind_check;
alter table public.requests add constraint requests_kind_check check (kind in ('goods', 'service'));
alter table public.requests drop constraint if exists requests_deliverables_check;
alter table public.requests add constraint requests_deliverables_check
  check (jsonb_typeof(deliverables) = 'array' and jsonb_array_length(deliverables) <= 10);
alter table public.requests drop constraint if exists requests_revision_rounds_check;
alter table public.requests add constraint requests_revision_rounds_check
  check (revision_rounds is null or revision_rounds between 0 and 10);
alter table public.requests drop constraint if exists requests_provider_preference_check;
alter table public.requests add constraint requests_provider_preference_check
  check (provider_preference in ('any', 'business', 'freelancer'));
alter table public.requests drop constraint if exists requests_proposals_wanted_check;
alter table public.requests add constraint requests_proposals_wanted_check
  check (proposals_wanted between 1 and 3);
alter table public.requests drop constraint if exists requests_reference_links_check;
alter table public.requests add constraint requests_reference_links_check
  check (cardinality(reference_links) <= 5);

comment on column public.requests.kind is 'goods (items and quantities) or service (a brief with deliverables).';
comment on column public.requests.deliverables is 'Service brief: [{"title", "done_when"}], what the startup gets and when each counts as done.';
comment on column public.requests.skill_ids is 'Service brief: skills needed (public.skills.id).';
comment on column public.requests.provider_preference is 'Service brief: any, business or freelancer.';
comment on column public.requests.proposals_wanted is 'Service brief: how many proposals the startup wants (1 to 3).';

-- A brief can only be sent once it says what the startup gets, by when, and
-- is in a service category. Drafts may be unfinished.
create or replace function app.check_service_brief() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_d jsonb;
begin
  if new.kind <> 'service' then
    return new;
  end if;
  if new.category_id is not null
     and exists (select 1 from public.catalogue_categories c where c.id = new.category_id and c.is_tangible) then
    raise exception 'A service brief needs a service category, not a goods one';
  end if;
  for v_d in select * from jsonb_array_elements(new.deliverables) loop
    if jsonb_typeof(v_d) <> 'object' or coalesce(trim(v_d->>'title'), '') = '' then
      raise exception 'Each deliverable needs a title';
    end if;
    if char_length(v_d->>'title') > 200 or char_length(coalesce(v_d->>'done_when', '')) > 300 then
      raise exception 'Keep each deliverable short (title up to 200, done when up to 300 characters)';
    end if;
  end loop;
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    if jsonb_array_length(new.deliverables) = 0 then
      raise exception 'Add at least one deliverable before sending the brief';
    end if;
    if new.needed_by is null then
      raise exception 'Choose a deadline before sending the brief';
    end if;
    if new.category_id is null then
      raise exception 'Choose a service category before sending the brief';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists requests_service_brief on public.requests;
create trigger requests_service_brief
  before insert or update on public.requests
  for each row execute function app.check_service_brief();

-- Reading requests is granted column by column (20261028140000), so the new
-- columns need their own grant. Saving them works like the other fields.
grant select (kind, deliverables, skill_ids, revision_rounds, provider_preference, proposals_wanted, reference_links)
  on public.requests to authenticated;

-- Check: expect true, true, 'goods'.
select has_column_privilege('authenticated', 'public.requests', 'deliverables', 'select') as readable,
       has_column_privilege('authenticated', 'public.requests', 'deliverables', 'update') as startups_can_save,
       (select kind from public.requests order by created_at limit 1) as old_requests_are;

-- ============================================================================
-- End of migration
-- ============================================================================
