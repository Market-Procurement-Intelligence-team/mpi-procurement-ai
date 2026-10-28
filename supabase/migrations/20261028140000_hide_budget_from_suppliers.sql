-- ============================================================================
-- MPI · Migration 20261028140000 · Suppliers never see the budget
--
-- Client rule (23 Oct): suppliers never see the startup's budget. Until now
-- an invited supplier could still read it from the request (found by the
-- end-to-end check). The same goes for the startup's own words and the AI's
-- reading of them, which often mention the budget ("budget around 2 lakh").
--
-- From now on these 4 fields can only be read by the startup that owns the
-- request and by the admin, through public.request_private_details:
--   budget_min, budget_max, requirement_text, ai_extracted
-- Everyone else who can see a request (the invited suppliers) sees all the
-- other fields as before. Startups still save these fields on the request
-- as usual. Matching and the other database functions are not affected.
--
-- Run after 20261028130000_government_schemes.sql. Safe to run again.
-- ============================================================================

-- 1. Reading requests: every field except the 4 private ones.
revoke select on public.requests from authenticated;
grant select (id, org_id, created_by, title, description, input_language, required_certifications,
              category_id, source, status, needed_by, delivery_city, delivery_state, currency,
              created_at, updated_at)
  on public.requests to authenticated;

-- 2. The private fields, for the request's own startup and the admin only.
--    (The view reads the table with its owner's rights, so the check below
--    is what decides who sees a row.)
create or replace view public.request_private_details with (security_barrier) as
select r.id as request_id,
       r.budget_min,
       r.budget_max,
       r.requirement_text,
       r.ai_extracted
  from public.requests r
 where auth.uid() is not null
   and (r.org_id = app.my_org_id() and app.my_role() = 'startup'
        or app.is_admin());

revoke all on public.request_private_details from public, anon;
grant select on public.request_private_details to authenticated;


-- ----------------------------------------------------------------------------
-- Check: who can read the budget field now (expect: nobody directly).
-- ----------------------------------------------------------------------------
select has_column_privilege('authenticated', 'public.requests', 'budget_max', 'select') as anyone_can_read_budget_directly,
       has_column_privilege('authenticated', 'public.requests', 'title', 'select')      as title_still_readable,
       has_column_privilege('authenticated', 'public.requests', 'budget_max', 'insert') as startups_can_still_save_budget;

-- ============================================================================
-- End of migration
-- ============================================================================
