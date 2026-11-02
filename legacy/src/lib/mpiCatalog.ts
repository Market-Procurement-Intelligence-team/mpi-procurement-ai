// MPI marketplace catalog sourced from the approved MPI Products and Services list.
// Fabrication & Hardware, Logistics & Operations are intentionally excluded from the homepage catalog.

export interface CatalogService {
  id: string
  name: string
  category: string
  description: string
  image: string
}

export const CATALOG_CATEGORIES = [
  "Packaging & Printing",
  "Prototyping & Product Development",
  "IT & Digital Services",
  "Compliance & Legal Support",
  "Marketing & Sales Support",
  "Business & Finance Services",
  "Specialized Startup Support",
] as const

export type CatalogCategory = typeof CATALOG_CATEGORIES[number]

export const MPI_CATALOG: CatalogService[] = [
  // Packaging & Printing
  {
    id: "svc-custom-cartons",
    name: "Custom cartons",
    category: "Packaging & Printing",
    description:
      "Custom cartons services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-corrugated-boxes",
    name: "Corrugated boxes",
    category: "Packaging & Printing",
    description:
      "Corrugated boxes services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1607166452427-7e4477079cb9?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-folding-cartons",
    name: "Folding cartons",
    category: "Packaging & Printing",
    description:
      "Folding cartons services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-rigid-boxes",
    name: "Rigid boxes",
    category: "Packaging & Printing",
    description:
      "Rigid boxes services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-product-labels",
    name: "Product labels",
    category: "Packaging & Printing",
    description:
      "Product labels services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-barcode-stickers",
    name: "Barcode stickers",
    category: "Packaging & Printing",
    description:
      "Barcode stickers services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-tamper-evident-seals",
    name: "Tamper-evident seals",
    category: "Packaging & Printing",
    description:
      "Tamper-evident seals services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-pouches-and-sachets",
    name: "Pouches and sachets",
    category: "Packaging & Printing",
    description:
      "Pouches and sachets services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-blister-packaging",
    name: "Blister packaging",
    category: "Packaging & Printing",
    description:
      "Blister packaging services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-shrink-wrapping",
    name: "Shrink wrapping",
    category: "Packaging & Printing",
    description:
      "Shrink wrapping services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-stretch-film",
    name: "Stretch film",
    category: "Packaging & Printing",
    description:
      "Stretch film services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-bubble-wrap",
    name: "Bubble wrap",
    category: "Packaging & Printing",
    description:
      "Bubble wrap services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-thermal-tags",
    name: "Thermal tags",
    category: "Packaging & Printing",
    description:
      "Thermal tags services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-instruction-leaflets",
    name: "Instruction leaflets",
    category: "Packaging & Printing",
    description:
      "Instruction leaflets services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-brochures-and-catalogs",
    name: "Brochures and catalogs",
    category: "Packaging & Printing",
    description:
      "Brochures and catalogs services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
  },

  // Prototyping & Product Development
  {
    id: "svc-3d-printing",
    name: "3D printing",
    category: "Prototyping & Product Development",
    description:
      "3D printing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-rapid-prototyping",
    name: "Rapid prototyping",
    category: "Prototyping & Product Development",
    description:
      "Rapid prototyping services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-cad-design",
    name: "CAD design",
    category: "Prototyping & Product Development",
    description:
      "CAD design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-industrial-design",
    name: "Industrial design",
    category: "Prototyping & Product Development",
    description:
      "Industrial design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-model-making",
    name: "Model making",
    category: "Prototyping & Product Development",
    description:
      "Model making services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-electronics-prototyping",
    name: "Electronics prototyping",
    category: "Prototyping & Product Development",
    description:
      "Electronics prototyping services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-pcb-assembly",
    name: "PCB assembly",
    category: "Prototyping & Product Development",
    description:
      "PCB assembly services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-iot-hardware-development",
    name: "IoT hardware development",
    category: "Prototyping & Product Development",
    description:
      "IoT hardware development services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-mechanical-design",
    name: "Mechanical design",
    category: "Prototyping & Product Development",
    description:
      "Mechanical design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-testing-samples",
    name: "Testing samples",
    category: "Prototyping & Product Development",
    description:
      "Testing samples services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
  },

  // IT & Digital Services
  {
    id: "svc-website-development",
    name: "Website development",
    category: "IT & Digital Services",
    description:
      "Website development services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-mobile-app-development",
    name: "Mobile app development",
    category: "IT & Digital Services",
    description:
      "Mobile app development services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-ui-ux-design",
    name: "UI/UX design",
    category: "IT & Digital Services",
    description:
      "UI/UX design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-erp-setup",
    name: "ERP setup",
    category: "IT & Digital Services",
    description:
      "ERP setup services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-crm-setup",
    name: "CRM setup",
    category: "IT & Digital Services",
    description:
      "CRM setup services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-software-qa-testing",
    name: "Software QA testing",
    category: "IT & Digital Services",
    description:
      "Software QA testing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-cloud-hosting-setup",
    name: "Cloud hosting setup",
    category: "IT & Digital Services",
    description:
      "Cloud hosting setup services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-cybersecurity-audit",
    name: "Cybersecurity audit",
    category: "IT & Digital Services",
    description:
      "Cybersecurity audit services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-api-integration",
    name: "API integration",
    category: "IT & Digital Services",
    description:
      "API integration services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-data-entry-and-digitization",
    name: "Data entry and digitization",
    category: "IT & Digital Services",
    description:
      "Data entry and digitization services and supplier discovery through the MPI procurement ecosystem.",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
  },

  // Compliance & Legal Support
  {
    id: "svc-company-incorporation-support",
    name: "Company incorporation support",
    category: "Compliance & Legal Support",
    description:
      "Company incorporation support services and supplier discovery through the MPI procurement ecosystem.",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-udyam-registration-support",
    name: "Udyam registration support",
    category: "Compliance & Legal Support",
    description:
      "Udyam registration support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-gst-filing",
    name: "GST filing",
    category: "Compliance & Legal Support",
    description:
      "GST filing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-tds-filing",
    name: "TDS filing",
    category: "Compliance & Legal Support",
    description:
      "TDS filing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1586486855514-8c633cc6fd38?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-roc-compliance",
    name: "ROC compliance",
    category: "Compliance & Legal Support",
    description:
      "ROC compliance services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-trademark-filing",
    name: "Trademark filing",
    category: "Compliance & Legal Support",
    description:
      "Trademark filing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-copyright-filing",
    name: "Copyright filing",
    category: "Compliance & Legal Support",
    description:
      "Copyright filing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-patent-drafting-support",
    name: "Patent drafting support",
    category: "Compliance & Legal Support",
    description:
      "Patent drafting support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-iso-certification-support",
    name: "ISO certification support",
    category: "Compliance & Legal Support",
    description:
      "ISO certification support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-zed-certification-support",
    name: "ZED certification support",
    category: "Compliance & Legal Support",
    description:
      "ZED certification support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80",
  },

  // Marketing & Sales Support
  {
    id: "svc-brand-identity-design",
    name: "Brand identity design",
    category: "Marketing & Sales Support",
    description:
      "Brand identity design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1634942537034-2531766767d1?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-logo-design",
    name: "Logo design",
    category: "Marketing & Sales Support",
    description:
      "Logo design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1626785774625-ddcddc3445e9?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-social-media-management",
    name: "Social media management",
    category: "Marketing & Sales Support",
    description:
      "Social media management services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-performance-marketing",
    name: "Performance marketing",
    category: "Marketing & Sales Support",
    description:
      "Performance marketing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-product-photography",
    name: "Product photography",
    category: "Marketing & Sales Support",
    description:
      "Product photography services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-video-editing",
    name: "Video editing",
    category: "Marketing & Sales Support",
    description:
      "Video editing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-catalog-design",
    name: "Catalog design",
    category: "Marketing & Sales Support",
    description:
      "Catalog design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-sales-deck-design",
    name: "Sales deck design",
    category: "Marketing & Sales Support",
    description:
      "Sales deck design services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-market-research",
    name: "Market research",
    category: "Marketing & Sales Support",
    description:
      "Market research services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-lead-generation",
    name: "Lead generation",
    category: "Marketing & Sales Support",
    description:
      "Lead generation services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80",
  },

  // Business & Finance Services
  {
    id: "svc-accounting",
    name: "Accounting",
    category: "Business & Finance Services",
    description:
      "Accounting services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-bookkeeping",
    name: "Bookkeeping",
    category: "Business & Finance Services",
    description:
      "Bookkeeping services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-mis-reporting",
    name: "MIS reporting",
    category: "Business & Finance Services",
    description:
      "MIS reporting services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-cma-preparation",
    name: "CMA preparation",
    category: "Business & Finance Services",
    description:
      "CMA preparation services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-project-report-preparation",
    name: "Project report preparation",
    category: "Business & Finance Services",
    description:
      "Project report preparation services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-valuation-support",
    name: "Valuation support",
    category: "Business & Finance Services",
    description:
      "Valuation support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-due-diligence-support",
    name: "Due diligence support",
    category: "Business & Finance Services",
    description:
      "Due diligence support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-business-analysis",
    name: "Business analysis",
    category: "Business & Finance Services",
    description:
      "Business analysis services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-payroll-processing",
    name: "Payroll processing",
    category: "Business & Finance Services",
    description:
      "Payroll processing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-virtual-cfo-services",
    name: "Virtual CFO services",
    category: "Business & Finance Services",
    description:
      "Virtual CFO services services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80",
  },

  // Specialized Startup Support
  {
    id: "svc-lab-testing",
    name: "Lab testing",
    category: "Specialized Startup Support",
    description:
      "Lab testing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-quality-assurance",
    name: "Quality assurance",
    category: "Specialized Startup Support",
    description:
      "Quality assurance services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-certification-testing",
    name: "Certification testing",
    category: "Specialized Startup Support",
    description:
      "Certification testing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-sample-sourcing",
    name: "Sample sourcing",
    category: "Specialized Startup Support",
    description:
      "Sample sourcing services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-toolroom-support",
    name: "Toolroom support",
    category: "Specialized Startup Support",
    description:
      "Toolroom support services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-packaging-design-consultation",
    name: "Packaging design consultation",
    category: "Specialized Startup Support",
    description:
      "Packaging design consultation services and supplier discovery through the MPI procurement ecosystem.",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-procurement-advisory",
    name: "Procurement advisory",
    category: "Specialized Startup Support",
    description:
      "Procurement advisory services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-vendor-onboarding",
    name: "Vendor onboarding",
    category: "Specialized Startup Support",
    description:
      "Vendor onboarding services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-b2b-sourcing-coordination",
    name: "B2B sourcing coordination",
    category: "Specialized Startup Support",
    description:
      "B2B sourcing coordination services and supplier discovery through the MPI procurement ecosystem.",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "svc-custom-small-batch-manufacturing",
    name: "Custom small-batch manufacturing",
    category: "Specialized Startup Support",
    description:
      "Custom small-batch manufacturing services and supplier discovery through the MPI procurement ecosystem.",
    image:
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
  },
]

export function searchCatalog(
  services: CatalogService[],
  query: string,
  category: string | "All",
): CatalogService[] {
  const q = query.trim().toLowerCase()
  return services.filter((service) => {
    const matchesCategory = category === "All" || service.category === category
    const matchesQuery =
      !q ||
      service.name.toLowerCase().includes(q) ||
      service.description.toLowerCase().includes(q) ||
      service.category.toLowerCase().includes(q)
    return matchesCategory && matchesQuery
  })
}
