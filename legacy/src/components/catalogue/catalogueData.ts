import { CatalogCategory, MPI_CATALOG } from "../../lib/mpiCatalog"
import { CategoryMetadata, EnrichedCatalogProduct } from "./catalogue.types"

export const CATEGORIES_METADATA: CategoryMetadata[] = [
  {
    id: "Packaging & Printing",
    displayName: "Packaging Materials",
    subtitle: "Boxes • Labels • Printing • Custom Packaging",
    description:
      "Procurement-ready packaging solutions: custom rigid boxes, corrugated mailers, pouches, and tamper-evident labeling from audited Indian MSMEs.",
    iconName: "inventory_2",
    sampleDeliverables: [
      "Rigid Gift Boxes",
      "Corrugated Mailer Boxes",
      "Thermal Barcode Labels",
      "Eco Biodegradable Pouches",
    ],
  },
  {
    id: "Prototyping & Product Development",
    displayName: "Designing & Prototyping",
    subtitle: "CNC Machining • 3D Printing • Tooling • Enclosures",
    description:
      "Institutional rapid prototyping, SLS/SLA additive engineering, sheet metal fabrication, and die tooling with guaranteed dimensional tolerances.",
    iconName: "precision_manufacturing",
    sampleDeliverables: [
      "SLS Nylon Enclosures",
      "CNC Milled 6061 Aluminium",
      "Sheet Metal Bending",
      "Silicone Vacuum Casting",
    ],
  },
  {
    id: "IT & Digital Services",
    displayName: "IT & Digital Services",
    subtitle: "Cloud Infrastructure • Custom ERP • App Dev • Security",
    description:
      "Full-stack software engineering, enterprise cloud architecture, custom ERP inventory integrations, and SOC-2 audit preparations.",
    iconName: "code",
    sampleDeliverables: [
      "Custom ERP Integrations",
      "Cloud Infrastructure Migration",
      "API & Middleware Dev",
      "Penetration Testing Audit",
    ],
  },
  {
    id: "Compliance & Legal Support",
    displayName: "Legal & Compliance",
    subtitle: "DPIIT • BIS • FSSAI • Patents & Trademark",
    description:
      "End-to-end statutory filings, trademark & patent registration, FSSAI/BIS licensing, and institutional startup contractual drafting.",
    iconName: "gavel",
    sampleDeliverables: [
      "DPIIT Recognition Filing",
      "Trademark & IPR Portfolio",
      "BIS & Quality Certification",
      "Founders & Vendor Agreements",
    ],
  },
  {
    id: "Marketing & Sales Support",
    displayName: "Marketing & Branding Services",
    subtitle: "B2B Lead Gen • Performance Ads • Collateral • Growth",
    description:
      "Institutional brand identity systems, high-converting 3D CGI product renders, performance marketing funnels, and enterprise sales development.",
    iconName: "campaign",
    sampleDeliverables: [
      "3D Packaging Renders",
      "B2B Enterprise Lead Engine",
      "Brand Guidelines & Identity",
      "Corporate Deck & Collateral",
    ],
  },
  {
    id: "Business & Finance Services",
    displayName: "Business & Financial Services",
    subtitle: "Auditing • Virtual CFO • Tax Filings • Valuations",
    description:
      "Virtual CFO leadership, reverse-margin cost auditing, statutory GST/ROC compliance, and 409A startup valuation modeling.",
    iconName: "account_balance",
    sampleDeliverables: [
      "Virtual CFO Advisory",
      "Reverse Margin Procurement Audit",
      "GST & ROC Statutory Filings",
      "Investor Valuation Report",
    ],
  },
  {
    id: "Specialized Startup Support",
    displayName: "Government Schemes & Support",
    subtitle: "Incubation • Grant Assistance • Reverse Margin Vetting",
    description:
      "Government scheme grant matching (ZED, PMKVY, CGTMSE), incubation readiness, and specialized startup supply chain onboarding.",
    iconName: "verified",
    sampleDeliverables: [
      "ZED Certification Grant",
      "CGTMSE Collateral-Free Loans",
      "DPIIT Seed Fund Matching",
      "MSME Incubation Readiness",
    ],
  },
]

// Curated high-resolution Unsplash procurement images for crisp, Apple-like visual presentation
const IMAGE_MAPPINGS: Record<string, string> = {
  // Packaging
  "svc-custom-cartons": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80",
  "svc-corrugated-boxes": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80",
  "svc-folding-cartons": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80",
  "svc-rigid-boxes": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
  "svc-product-labels": "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80",
  "svc-barcode-stickers": "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80",
  "svc-tamper-evident-seals": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
  "svc-pouches-and-sachets": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
  "svc-blister-packaging": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",
  "svc-shrink-wrapping": "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80",
  "svc-glass-bottles-and-jars": "https://images.unsplash.com/photo-1608248597359-0a56e2978a59?auto=format&fit=crop&w=800&q=80",
  "svc-plastic-containers": "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80",
  "svc-eco-friendly-packaging": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80",
  "svc-mailer-bags": "https://images.unsplash.com/photo-1589710751893-f9a6770ad71b?auto=format&fit=crop&w=800&q=80",
  "svc-packaging-tapes": "https://images.unsplash.com/photo-1572985025746-d67568851b4a?auto=format&fit=crop&w=800&q=80",
  "svc-protective-foam-inserts": "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=800&q=80",

  // Prototyping
  "svc-3d-printing-sls": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
  "svc-cnc-machining": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80",
  "svc-sheet-metal-prototyping": "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80",
  "svc-pcb-prototyping": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  "svc-silicone-molding": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80",
  "svc-laser-cutting": "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=800&q=80",

  // IT & Digital Services
  "svc-custom-erp-development": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
  "svc-cloud-infrastructure-setup": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
  "svc-mobile-app-development": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80",
  "svc-cybersecurity-audit": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",

  // Legal & Compliance
  "svc-dpiit-startup-registration": "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80",
  "svc-trademark-filing": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
  "svc-bis-certification": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",

  // Marketing
  "svc-3d-product-rendering": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
  "svc-b2b-lead-generation": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",

  // Business & Finance
  "svc-virtual-cfo-services": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
  "svc-reverse-margin-auditing": "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80",

  // Specialized Startup
  "svc-zed-scheme-certification": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
  "svc-seed-fund-grant-matching": "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80",
}

// Generate enriched metadata for all 76 items in MPI_CATALOG
export const ENRICHED_CATALOG_PRODUCTS: EnrichedCatalogProduct[] = MPI_CATALOG.map(
  (item, index) => {
    // Curated high quality procurement details based on category
    let moq = "250 units"
    let leadTime = "5–7 Days"
    let startingPrice = "From ₹14/unit"
    let specs = ["ISO 9001 Certified MSME", "Sample Approval Guaranteed", "Reverse-Margin Audited"]
    let badge = index % 3 === 0 ? "✨ Top Requested" : index % 5 === 0 ? "🏆 MSME Gold" : "Verified"

    if (item.category === "Packaging & Printing") {
      moq = item.name.toLowerCase().includes("rigid") ? "200 units" : "500 units"
      leadTime = "5–8 Business Days"
      startingPrice = item.name.toLowerCase().includes("box")
        ? "From ₹18/unit"
        : item.name.toLowerCase().includes("label")
        ? "From ₹1.80/label"
        : "From ₹12/unit"
      specs = [
        "FSC / Recycled Board Options",
        "High-Precision Pantone UV Print",
        "Die-Line & Structural CAD Free",
        "Export-Grade Edge Crush Resistance",
      ]
    } else if (item.category === "Prototyping & Product Development") {
      moq = "1–5 units (Pilot Run)"
      leadTime = "3–6 Business Days"
      startingPrice = "From ₹2,500/run"
      specs = [
        "Tolerance ±0.05mm Guaranteed",
        "PA12 Nylon / 6061-T6 Aluminium",
        "3D STEP / IGES Inspection Report",
        "Surface Anodizing & Bead Blast",
      ]
    } else if (item.category === "IT & Digital Services") {
      moq = "Scope-Based SOW"
      leadTime = "2–4 Weeks"
      startingPrice = "From ₹35,000"
      specs = [
        "Full IP & Code Ownership",
        "Enterprise Cloud Architecture",
        "Enterprise SLA Guarantee",
        "Dedicated Engineering PM",
      ]
    } else if (item.category === "Compliance & Legal Support") {
      moq = "1 Dossier / Retainer"
      leadTime = "7–14 Days"
      startingPrice = "From ₹8,500"
      specs = [
        "Government Filing Fee Transparency",
        "Advocate / CA Verified Sign-Off",
        "Zero-Rework Application Warranty",
        "DPIIT & MSME Scheme Compliant",
      ]
    } else if (item.category === "Marketing & Sales Support") {
      moq = "Campaign Sprint"
      leadTime = "5–10 Days"
      startingPrice = "From ₹18,000"
      specs = [
        "High-Fidelity 4K Asset Delivery",
        "D2C & B2B Conversion Audited",
        "Multi-Platform Ready Formats",
        "Rapid Iteration Within 48h",
      ]
    } else if (item.category === "Business & Finance Services") {
      moq = "Monthly / Engagement"
      leadTime = "Immediate Onboarding"
      startingPrice = "From ₹25,000"
      specs = [
        "Big-4 Trained CA Advisory",
        "Statutory GST / ROC Defense",
        "Investor-Ready MIS Reporting",
        "Cost Arbitrage Guarantee",
      ]
    } else {
      moq = "Startup Milestone"
      leadTime = "10–20 Days"
      startingPrice = "Scheme Subsidized"
      specs = [
        "Up to 80% Government Grant Subsidy",
        "ZED / PMKVY / CGTMSE Mapped",
        "Institutional Sourcing Escrow",
        "DPIIT Incubator Endorsed",
      ]
    }

    const highRes = IMAGE_MAPPINGS[item.id] || item.image

    return {
      ...item,
      moq,
      leadTime,
      startingPrice,
      specifications: specs,
      supplierBadge: "MPI Verified Supplier",
      badge,
      highResImage: highRes,
      subsidiesEligible: ["Eligible for ZED Certification Grant", "100% Reverse Margin Audited"],
    }
  },
)

export function getProductsByCategory(category: CatalogCategory): EnrichedCatalogProduct[] {
  return ENRICHED_CATALOG_PRODUCTS.filter((p) => p.category === category)
}
