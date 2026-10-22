-- ============================================================================
-- MPI · Migration 20261022120000 · Catalogue seed
--
-- Loads the approved MPI catalogue (7 categories, 75 items) from the list the
-- old app used (src/lib/mpiCatalog.ts).
--
-- Physical products (samples allowed): all of Packaging & Printing and
-- Prototyping & Product Development, except CAD, industrial and mechanical
-- design (services); plus Sample sourcing and Custom small-batch
-- manufacturing from Specialized Startup Support.
--
-- Descriptions are left empty: the old list only had placeholder text.
-- Images are the Unsplash photos the old app used.
--
-- Safe to run more than once: rows that already exist are skipped.
-- Run after 20261021120000_core_schema.sql.
-- ============================================================================

-- 1. Categories
insert into public.catalogue_categories (slug, name, is_tangible, sort_order) values
  ('packaging-and-printing', 'Packaging & Printing', true, 1),
  ('prototyping-and-product-development', 'Prototyping & Product Development', true, 2),
  ('it-and-digital-services', 'IT & Digital Services', false, 3),
  ('compliance-and-legal-support', 'Compliance & Legal Support', false, 4),
  ('marketing-and-sales-support', 'Marketing & Sales Support', false, 5),
  ('business-and-finance-services', 'Business & Finance Services', false, 6),
  ('specialized-startup-support', 'Specialized Startup Support', false, 7)
on conflict (slug) do nothing;

-- 2. Items
insert into public.catalogue_items (category_id, name, is_tangible, image_url)
select c.id, v.name, v.is_tangible, v.image_url
  from (values
    -- Packaging & Printing
    ('packaging-and-printing', 'Custom cartons', true, 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Corrugated boxes', true, 'https://images.unsplash.com/photo-1607166452427-7e4477079cb9?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Folding cartons', true, 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Rigid boxes', true, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Product labels', true, 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Barcode stickers', true, 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Tamper-evident seals', true, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Pouches and sachets', true, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Blister packaging', true, 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Shrink wrapping', true, 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Stretch film', true, 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Bubble wrap', true, 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Thermal tags', true, 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Instruction leaflets', true, 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80'),
    ('packaging-and-printing', 'Brochures and catalogs', true, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'),
    -- Prototyping & Product Development
    ('prototyping-and-product-development', '3D printing', true, 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'Rapid prototyping', true, 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'CAD design', false, 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'Industrial design', false, 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'Model making', true, 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'Electronics prototyping', true, 'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'PCB assembly', true, 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'IoT hardware development', true, 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'Mechanical design', false, 'https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=800&q=80'),
    ('prototyping-and-product-development', 'Testing samples', true, 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80'),
    -- IT & Digital Services
    ('it-and-digital-services', 'Website development', false, 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'Mobile app development', false, 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'UI/UX design', false, 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'ERP setup', false, 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'CRM setup', false, 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'Software QA testing', false, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'Cloud hosting setup', false, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'Cybersecurity audit', false, 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'API integration', false, 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80'),
    ('it-and-digital-services', 'Data entry and digitization', false, 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80'),
    -- Compliance & Legal Support
    ('compliance-and-legal-support', 'Company incorporation support', false, 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'Udyam registration support', false, 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'GST filing', false, 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'TDS filing', false, 'https://images.unsplash.com/photo-1586486855514-8c633cc6fd38?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'ROC compliance', false, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'Trademark filing', false, 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'Copyright filing', false, 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'Patent drafting support', false, 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'ISO certification support', false, 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80'),
    ('compliance-and-legal-support', 'ZED certification support', false, 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80'),
    -- Marketing & Sales Support
    ('marketing-and-sales-support', 'Brand identity design', false, 'https://images.unsplash.com/photo-1634942537034-2531766767d1?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Logo design', false, 'https://images.unsplash.com/photo-1626785774625-ddcddc3445e9?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Social media management', false, 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Performance marketing', false, 'https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Product photography', false, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Video editing', false, 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Catalog design', false, 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Sales deck design', false, 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Market research', false, 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80'),
    ('marketing-and-sales-support', 'Lead generation', false, 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80'),
    -- Business & Finance Services
    ('business-and-finance-services', 'Accounting', false, 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Bookkeeping', false, 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'MIS reporting', false, 'https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'CMA preparation', false, 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Project report preparation', false, 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Valuation support', false, 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Due diligence support', false, 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Business analysis', false, 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Payroll processing', false, 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=800&q=80'),
    ('business-and-finance-services', 'Virtual CFO services', false, 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80'),
    -- Specialized Startup Support
    ('specialized-startup-support', 'Lab testing', false, 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Quality assurance', false, 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Certification testing', false, 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Sample sourcing', true, 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Toolroom support', false, 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Packaging design consultation', false, 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Procurement advisory', false, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Vendor onboarding', false, 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'B2B sourcing coordination', false, 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80'),
    ('specialized-startup-support', 'Custom small-batch manufacturing', true, 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80')
  ) as v (category_slug, name, is_tangible, image_url)
  join public.catalogue_categories c on c.slug = v.category_slug
 where not exists (
   select 1 from public.catalogue_items i
    where i.category_id = c.id and i.name = v.name
 );

-- 3. Check: should show 7 categories and 75 items in total
select c.name as category, count(i.id) as items, count(i.id) filter (where i.is_tangible) as physical
  from public.catalogue_categories c
  left join public.catalogue_items i on i.category_id = c.id
 group by c.name, c.sort_order
 order by c.sort_order;
