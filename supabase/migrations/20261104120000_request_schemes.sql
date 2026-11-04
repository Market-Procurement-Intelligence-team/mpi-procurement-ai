-- ============================================================================
-- MPI · Migration 20261104120000 · Schemes chosen on a request
--
-- At the end of a new request (Review & send), MPI suggests government
-- schemes that fit what the startup is buying. The startup can tick the
-- ones it plans to use. They are saved on the request so the MPI admin (AI
-- matches) and the invited suppliers (request and quote page) can see them,
-- and suppliers can keep the invoices and certificates those schemes need.
--
-- Not private: suppliers may read it, like the other non-budget fields.
-- Old requests get an empty list. Run after 20261103150000. Safe to run again.
-- ============================================================================

alter table public.requests
  add column if not exists scheme_ids uuid[] not null default '{}';

comment on column public.requests.scheme_ids is
  'Government schemes (government_schemes.id) the startup plans to use for this request.';

-- Reading requests is granted column by column (20261028140000), so the new
-- column needs its own grant. Saving it works like the other fields.
grant select (scheme_ids) on public.requests to authenticated;

-- Check: expect true, true.
select has_column_privilege('authenticated', 'public.requests', 'scheme_ids', 'select') as readable,
       has_column_privilege('authenticated', 'public.requests', 'scheme_ids', 'update') as startups_can_save;

-- ============================================================================
-- End of migration
-- ============================================================================
