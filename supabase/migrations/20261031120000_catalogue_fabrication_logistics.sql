-- ============================================================================
-- MPI · Migration 20261031120000 · Catalogue: Fabrication & Logistics
--
-- Completes the 100-item MPI catalogue from the client's products and
-- services list. Adds the two missing groups (25 items):
--   - Fabrication & Hardware (15 items, physical, samples allowed)
--   - Logistics & Operations (10 items, services done on the ground)
-- and puts all 9 groups in the client's list order.
--
-- Logistics is a service, but its requests always name a delivery place,
-- so matching still scores suppliers by location (only services with no
-- delivery place are treated as remote work).
--
-- No images yet (image_url empty): screens show a plain icon instead.
-- No demo supplier serves these groups yet; the demo history step adds one.
--
-- Safe to run more than once: rows that already exist are skipped.
-- Run after 20261028150000_supplier_price_guide.sql.
-- ============================================================================

-- 1. The two new groups
insert into public.catalogue_categories (slug, name, is_tangible, sort_order) values
  ('fabrication-and-hardware', 'Fabrication & Hardware', true, 2),
  ('logistics-and-operations', 'Logistics & Operations', false, 6)
on conflict (slug) do nothing;

-- 2. All 9 groups in the client's order
update public.catalogue_categories c
   set sort_order = v.sort_order
  from (values
    ('packaging-and-printing', 1),
    ('fabrication-and-hardware', 2),
    ('prototyping-and-product-development', 3),
    ('it-and-digital-services', 4),
    ('compliance-and-legal-support', 5),
    ('logistics-and-operations', 6),
    ('marketing-and-sales-support', 7),
    ('business-and-finance-services', 8),
    ('specialized-startup-support', 9)
  ) as v (slug, sort_order)
 where c.slug = v.slug;

-- 3. Items
insert into public.catalogue_items (category_id, name, is_tangible)
select c.id, v.name, v.is_tangible
  from (values
    -- Fabrication & Hardware
    ('fabrication-and-hardware', 'Laser cutting', true),
    ('fabrication-and-hardware', 'CNC cutting', true),
    ('fabrication-and-hardware', 'Sheet metal fabrication', true),
    ('fabrication-and-hardware', 'Welding services', true),
    ('fabrication-and-hardware', 'Powder coating', true),
    ('fabrication-and-hardware', 'Plastic injection molding', true),
    ('fabrication-and-hardware', 'Vacuum forming', true),
    ('fabrication-and-hardware', 'Die making', true),
    ('fabrication-and-hardware', 'Mold tooling', true),
    ('fabrication-and-hardware', 'Jigs and fixtures', true),
    ('fabrication-and-hardware', 'Acrylic fabrication', true),
    ('fabrication-and-hardware', 'Wood fabrication', true),
    ('fabrication-and-hardware', 'Product assembly', true),
    ('fabrication-and-hardware', 'Prototype enclosures', true),
    ('fabrication-and-hardware', 'Industrial finishing', true),
    -- Logistics & Operations
    ('logistics-and-operations', 'Local transportation', false),
    ('logistics-and-operations', 'Courier services', false),
    ('logistics-and-operations', 'Warehouse rental', false),
    ('logistics-and-operations', 'Packaging fulfillment', false),
    ('logistics-and-operations', 'Last-mile delivery', false),
    ('logistics-and-operations', 'Inventory management', false),
    ('logistics-and-operations', 'Order tracking setup', false),
    ('logistics-and-operations', 'Reverse logistics', false),
    ('logistics-and-operations', 'Loading and unloading', false),
    ('logistics-and-operations', 'Cold-chain handling', false)
  ) as v (category_slug, name, is_tangible)
  join public.catalogue_categories c on c.slug = v.category_slug
 where not exists (
   select 1 from public.catalogue_items i
    where i.category_id = c.id and i.name = v.name
 );

-- 4. Check: should show 9 groups in this order, 100 items in total
--    (15, 15, 10, 10, 10, 10, 10, 10, 10).
select c.sort_order, c.name as category, count(i.id) as items
  from public.catalogue_categories c
  left join public.catalogue_items i on i.category_id = c.id
 group by c.name, c.sort_order
 order by c.sort_order;
