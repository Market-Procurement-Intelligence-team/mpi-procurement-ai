import { CatalogCategory } from "../lib/mpiCatalog"

export interface MpiScheme {
  id: string
  name: string
  shortName: string
  ministry: string
  department: string
  description: string
  natureOfAssistance: string
  assistanceAmountMax: string
  subsidyPercentMax?: number
  whoCanApply: string[]
  eligibilityCriteria: string[]
  howToApply: string[]
  documentsRequired: string[]
  targetBeneficiaries: ("startup" | "msme")[]
  categories: CatalogCategory[]
  industryKeywords: string[]
  stageKeywords: string[] // e.g. 'Idea', 'Prototype', 'MVP', 'Early Revenue', 'Traction', 'Growth', 'Scaling', 'Micro', 'Small', 'Medium'
  procurementTriggers: string[] // e.g. 'Packaging', 'Tooling', 'Prototyping', 'Quality Testing', 'Certifications', 'Machinery', 'Patents', 'Cloud', 'Raw Material'
  officialUrl: string
  sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf"
  sourceChapter: string
  verificationStatus: "Source Verified - Verify Current Portal"
  contactOffice: string
  keyBenefits: string[]
}

export interface SchemeMatcherProfile {
  businessType: "startup" | "msme"
  companyName?: string
  stage?: "Idea" | "Prototype" | "MVP" | "Early Revenue" | "Traction" | "Growth" | "Scaling"
  enterpriseType?: "Micro" | "Small" | "Medium"
  industry?: string
  categories: CatalogCategory[]
  procurementNeeds?: string
  annualTurnover?: string
  locationState?: string
  hasUdyam?: boolean
  hasDpiit?: boolean
  isWomenOrScSt?: boolean
  targetInterests?: string[]
}

export interface SchemeMatchResult {
  scheme: MpiScheme
  relevanceScore: number // 0 to 100
  matchTier: "Exceptional Fit" | "High Fit" | "Moderate Fit" | "Potential Match"
  matchReasons: string[]
  procurementSavingsPotential: string
  recommendedAction: string
}

export const MPI_GOV_SCHEMES: MpiScheme[] = [
  // ── 1. Ministry of MSME / DC-MSME ──────────────────────────────────────────
  {
    id: "SCH-ZED-01",
    name: "Financial Support to MSMEs in ZED Certification Scheme (Zero Defect Zero Effect)",
    shortName: "ZED Certification Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Enables manufacturing MSMEs to manufacture defect-free goods with minimal environmental footprint through structured Bronze, Silver, and Gold quality certifications.",
    natureOfAssistance:
      "Subsidy on certification cost: 80% for Micro, 60% for Small, 50% for Medium enterprises. Additional 10% subsidy for Women/SC/ST entrepreneurs or units in NER/Hilly/Island regions. Handholding support up to ₹5,00,000.",
    assistanceAmountMax:
      "Up to ₹5,00,000 handholding + up to 80% certification cost reimbursement",
    subsidyPercentMax: 80,
    whoCanApply: [
      "All manufacturing micro, small and medium enterprises with valid Udyam Registration",
      "Startups manufacturing physical goods or hardware",
      "Units seeking domestic and global supplier credentialing",
    ],
    eligibilityCriteria: [
      "Active Udyam Registration Certificate",
      "Manufacturing unit physically operational in India",
      "Undertaking to adhere to Zero Defect Zero Effect environmental standards",
    ],
    howToApply: [
      "Register on the official ZED portal (zed.msme.gov.in) using Udyam number",
      "Complete online self-assessment based on ZED parameters",
      "Select Desktop Assessment or On-site Assessment agency",
      "Apply through MPI Scheme Concierge to bundle with your current RFQ testing requirements",
    ],
    documentsRequired: [
      "Udyam Registration Certificate",
      "PAN and GSTIN registration proofs",
      "Factory/Workshop electricity bill or lease deed",
      "Internal quality inspection records or calibration test reports",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Packaging & Printing",
      "Prototyping & Product Development",
      "Compliance & Legal Support",
    ],
    industryKeywords: [
      "Manufacturing",
      "Electronics",
      "Packaging",
      "Plastics",
      "Machining",
      "Hardware",
      "D2C",
    ],
    stageKeywords: [
      "Prototype",
      "MVP",
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Micro",
      "Small",
      "Medium",
    ],
    procurementTriggers: [
      "Quality Testing",
      "Certifications",
      "Tooling",
      "Packaging",
      "Inspection",
    ],
    officialUrl: "https://zed.msme.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - Technology & Quality Upgradation",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "National Monitoring & Implementing Unit (QCI), New Delhi / DC-MSME",
    keyBenefits: [
      "80% subsidy on certification fees for Micro enterprises",
      "Pre-requisite preference for PSU procurement tenders",
      "Up to ₹5 Lakhs financial support for implementing corrective actions",
      "Concession on bank processing fees and interest subvention",
    ],
  },
  {
    id: "SCH-DESIGN-02",
    name: "Design Clinic Scheme for Design Expertise to MSMEs",
    shortName: "Design Clinic Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Promotes design thinking, value engineering, ergonomic enhancement, and sustainable packaging design among MSMEs and hardware startups.",
    natureOfAssistance:
      "Financial assistance of 60% of total project cost up to ₹9 Lakhs for MSMEs (or ₹15-40 Lakhs for mini-clusters). Student design project funding up to ₹1.5 Lakhs to ₹3 Lakhs (75% govt contribution).",
    assistanceAmountMax:
      "Up to ₹9,00,000 per individual enterprise project / ₹40 Lakhs mini-cluster",
    subsidyPercentMax: 60,
    whoCanApply: [
      "Micro, Small, and Medium enterprises with manufacturing setups",
      "Hardware startups requiring industrial design, enclosure styling, or custom packaging tooling",
      "MSME clusters and industry designer consortiums",
    ],
    eligibilityCriteria: [
      "Udyam-registered enterprise with defined product line",
      "Design project handled by empaneled design consultants or institutions (NID, IITs, IISc)",
      "Matching 40% enterprise contribution commitment",
    ],
    howToApply: [
      "Submit project proposal through Design Clinic portal (designclinicsmsme.org)",
      "Attach technical design requirements, 3D CAD/mockup specs, and designer quotations",
      "Project screening committee reviews commercial viability",
      "Grants disbursed in milestones against design deliverables",
    ],
    documentsRequired: [
      "Udyam Registration Certificate",
      "Detailed Project Proposal (DPR) detailing industrial design or packaging change",
      "Empaneled designer credentials and quotation breakdown",
      "Bank statement and audited financials of the previous financial year",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Packaging & Printing",
      "Prototyping & Product Development",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "Design",
      "Packaging",
      "Consumer Goods",
      "Electronics",
      "Appliances",
      "FMCG",
    ],
    stageKeywords: [
      "Idea",
      "Prototype",
      "MVP",
      "Early Revenue",
      "Traction",
      "Micro",
      "Small",
    ],
    procurementTriggers: [
      "Packaging",
      "Tooling",
      "Prototyping",
      "3D Printing",
      "CAD Design",
    ],
    officialUrl: "https://designclinicsmsme.org",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter:
      "Ministry of MSME - National Manufacturing Competitiveness Programme",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "National Institute of Design (NID) / DC-MSME Nirman Bhawan",
    keyBenefits: [
      "60% grant on industrial design fees and prototyping tooling",
      "Access to top national design institutes (NID, IIT Design cells)",
      "Subsidizes product packaging redesign and box structural development",
    ],
  },
  {
    id: "SCH-CGTMSE-03",
    name: "Credit Guarantee Fund Trust for Micro and Small Enterprises (CGTMSE)",
    shortName: "CGTMSE Collateral-Free Loans",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "SIDBI & Ministry of MSME Joint Trust",
    description:
      "Provides collateral-free credit (term loans and working capital) to micro and small enterprises through scheduled commercial banks and financial institutions.",
    natureOfAssistance:
      "Guarantee cover up to 85% of the sanctioned credit facility up to ₹5 Crore (expanded from ₹2 Crore). Concessional annual guarantee fee starting at 0.37%.",
    assistanceAmountMax:
      "Credit guarantee cover up to ₹5,00,00,000 (₹5 Crore) without physical collateral",
    subsidyPercentMax: 85,
    whoCanApply: [
      "New and existing Micro and Small Enterprises in manufacturing and service sectors",
      "DPIIT-registered startups needing working capital or capital expenditure loans",
      "Women-owned businesses and SC/ST enterprises receive higher guarantee coverage (85%)",
    ],
    eligibilityCriteria: [
      "Micro or Small Enterprise status under MSMED Act with Udyam registration",
      "Project financially viable as per Member Lending Institution (MLI) credit appraisal",
      "No third-party guarantee or collateral security demanded by the lending bank",
    ],
    howToApply: [
      "Prepare project report / detailed procurement purchase schedule",
      "Approach any scheduled commercial bank or participating NBFC",
      "Bank sanctions loan under CGTMSE guarantee without collateral requirement",
      "Guarantee fee paid directly through the bank to the trust",
    ],
    documentsRequired: [
      "Udyam Registration Certificate & DPIIT recognition (if applicable)",
      "Detailed Project Report (DPR) including capital goods and inventory estimates",
      "Last 2 years financial statements or projected cash flows",
      "KYC of promoters and GST returns",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Business & Finance Services",
      "Prototyping & Product Development",
      "Packaging & Printing",
    ],
    industryKeywords: [
      "Financing",
      "Working Capital",
      "Machinery",
      "Capex",
      "Expansion",
      "Debt",
    ],
    stageKeywords: [
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Micro",
      "Small",
    ],
    procurementTriggers: [
      "Tooling",
      "Machinery",
      "Raw Material",
      "Capex",
      "Working Capital",
    ],
    officialUrl: "https://www.cgtmse.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - Credit & Financial Support",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "CGTMSE Trust Office, SIDBI, Mumbai / Member Lending Banks",
    keyBenefits: [
      "No property collateral or third-party guarantee required",
      "Credit limit accessible up to ₹500 Lakhs",
      "85% guarantee cover for women-led startups and micro enterprises",
      "Reduced interest rates due to sovereign backed risk mitigation",
    ],
  },
  {
    id: "SCH-CLCSS-04",
    name: "Credit Linked Capital Subsidy Scheme (CLCSS) for Technology Upgradation",
    shortName: "CLCSS Tech Upgradation",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Facilitates technology upgradation by providing upfront capital subsidy to MSEs for induction of well-established and improved technologies in approved sub-sectors.",
    natureOfAssistance:
      "15% upfront capital subsidy on institutional finance availed for purchase of plant & machinery up to ₹1 Crore investment (maximum subsidy of ₹15 Lakhs).",
    assistanceAmountMax:
      "Up to ₹15,00,000 (15% capital subsidy on plant & machinery up to ₹1 Crore)",
    subsidyPercentMax: 15,
    whoCanApply: [
      "Micro and Small Enterprises in 51 specified sub-sectors including plastics, packaging, electronics, food processing",
      "Sole proprietorships, partnerships, and private limited companies upgrading plant technology",
    ],
    eligibilityCriteria: [
      "Valid Udyam registration in eligible manufacturing sectors",
      "Machinery sourced from authorized manufacturers / verified suppliers",
      "Term loan sanctioned by primary lending institutions (SIDBI, SBI, PNB, etc.)",
    ],
    howToApply: [
      "Apply to lending bank while seeking term loan for plant and machinery",
      "Bank uploads online claim on the DC-MSME CLCSS portal",
      "Subsidy released to lending institution and credited to borrower loan account after installation",
    ],
    documentsRequired: [
      "Udyam Registration Certificate",
      "Techno-economic feasibility report for machinery acquisition",
      "Commercial invoice and proof of machinery commissioning",
      "Sanction letter of term loan from nodal agency/bank",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: ["Prototyping & Product Development", "Packaging & Printing"],
    industryKeywords: [
      "Machinery",
      "Tooling",
      "Automation",
      "Printing",
      "Plastics",
      "Molding",
      "Assembly",
    ],
    stageKeywords: [
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Micro",
      "Small",
    ],
    procurementTriggers: ["Machinery", "Tooling", "Automation", "Capex"],
    officialUrl: "https://clcss.dcmsme.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - Technology & Quality Upgradation",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "Nodal Agencies (SIDBI / NABARD) & Office of DC-MSME, New Delhi",
    keyBenefits: [
      "Direct 15% non-dilutive capital subsidy credited to loan principal",
      "Lowers capital debt burden for purchasing CNC, offset, or molding machinery",
      "Faster loan repayment timeline and improved DSCR",
    ],
  },
  {
    id: "SCH-IPR-05",
    name: "Building Awareness on Intellectual Property Rights (IPR) Scheme",
    shortName: "MSME IPR & Patent Subsidy",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Provides financial assistance for patent registration, geographical indications, and trademarks to encourage innovation culture in MSMEs.",
    natureOfAssistance:
      "Reimbursement of up to ₹1,00,000 for domestic patent registration, up to ₹5,00,000 for international patent registration, and up to ₹10,000 for trademark registration.",
    assistanceAmountMax:
      "Up to ₹5,00,000 for foreign patent / ₹1,00,000 for Indian patent / ₹10,000 for trademark",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Udyam-registered Micro, Small and Medium Enterprises",
      "Startups with granted or filed patents / trademarks",
    ],
    eligibilityCriteria: [
      "Active Udyam registration number",
      "Patent granted or trademark registered through official Indian Patent Office / WIPO PCT",
      "Claim submitted within 1 year of grant / publication",
    ],
    howToApply: [
      "File application on DC-MSME e-IPR portal",
      "Submit patent grant certificate, official fee receipts, and attorney invoices",
      "Scrutiny by Project Screening Committee and direct bank transfer via PFMS",
    ],
    documentsRequired: [
      "Udyam Certificate",
      "Patent / Trademark grant certificate from Controller General of Patents",
      "Official fee receipts and attorney invoices with bank payment proofs",
      "Cancelled cheque and mandate form",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: ["Compliance & Legal Support", "Specialized Startup Support"],
    industryKeywords: [
      "Patents",
      "Intellectual Property",
      "Trademarks",
      "Invention",
      "Hardware",
      "Software",
    ],
    stageKeywords: [
      "Idea",
      "Prototype",
      "MVP",
      "Early Revenue",
      "Traction",
      "Growth",
      "Micro",
      "Small",
      "Medium",
    ],
    procurementTriggers: ["Patents", "Certifications", "Legal"],
    officialUrl: "https://my.msme.gov.in/inc/IPR.aspx",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - IPR Promotion",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "IPR Cell, O/o DC-MSME, Nirman Bhawan, New Delhi",
    keyBenefits: [
      "Reimburses 100% of statutory patent fees and patent attorney costs",
      "Global patent filing support up to ₹5 Lakhs under PCT route",
      "Protects startup IP assets prior to institutional venture capital rounds",
    ],
  },
  {
    id: "SCH-BARCODE-06",
    name: "Financial Assistance for Bar Code Registration (NMCP)",
    shortName: "GS1 Barcode Reimbursement Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Encourages MSEs to adopt international bar-coding standards (GS1) for automated inventory tracking, retail store placement, and global export packaging.",
    natureOfAssistance:
      "Reimbursement of 75% of one-time registration fee and 75% of annual recurring fees for the first three years paid to GS1 India.",
    assistanceAmountMax:
      "75% reimbursement of GS1 India one-time and annual fees (up to ₹30,000+)",
    subsidyPercentMax: 75,
    whoCanApply: [
      "Micro and Small manufacturing enterprises producing consumer packaged goods",
      "D2C startups launching packaging into retail chains, supermarkets, and international exports",
    ],
    eligibilityCriteria: [
      "Valid Udyam Registration Certificate",
      "Registration with GS1 India for bar code allocation",
      "Enterprise must be in operational production",
    ],
    howToApply: [
      "Obtain GS1 barcode prefix allotment from GS1 India",
      "Submit online claim on DC-MSME Barcode portal with GS1 fee receipt and product packaging photos",
      "Field MSME Development Institute (MSME-DI) verifies and disburses subsidy",
    ],
    documentsRequired: [
      "Udyam Registration Certificate",
      "GS1 India registration certificate and fee receipt",
      "Product packaging proofs showing printed GS1 barcode",
      "Bank details with cancelled cheque",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: ["Packaging & Printing", "Compliance & Legal Support"],
    industryKeywords: [
      "Packaging",
      "Retail",
      "FMCG",
      "D2C",
      "Export",
      "Barcodes",
      "Logistics",
    ],
    stageKeywords: [
      "MVP",
      "Early Revenue",
      "Traction",
      "Growth",
      "Micro",
      "Small",
    ],
    procurementTriggers: ["Packaging", "Barcodes", "Certifications"],
    officialUrl: "https://dcmsme.gov.in/schemes/bar_code.htm",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter:
      "Ministry of MSME - National Manufacturing Competitiveness Programme",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "Local MSME Development Institute (MSME-DFO) / GS1 India",
    keyBenefits: [
      "75% immediate reimbursement of GS1 registration fees",
      "Mandatory qualification for retail distribution (Blinkit, Zepto, Reliance, DMart)",
      "Subsidizes recurring barcode renewal costs for 3 continuous years",
    ],
  },
  {
    id: "SCH-PMEGP-07",
    name: "Prime Minister's Employment Generation Programme (PMEGP)",
    shortName: "PMEGP Subsidy Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "Khadi and Village Industries Commission (KVIC)",
    description:
      "Credit-linked subsidy program aimed at generating self-employment opportunities through establishment of micro-enterprises in non-farm sector.",
    natureOfAssistance:
      "Margin money subsidy of 15% to 35% of project cost (up to ₹50 Lakhs for manufacturing units, ₹20 Lakhs for service units). Beneficiary contribution only 5% to 10%.",
    assistanceAmountMax:
      "Up to ₹17,50,000 margin money subsidy (35% on ₹50 Lakh project cost)",
    subsidyPercentMax: 35,
    whoCanApply: [
      "Any individual above 18 years of age (minimum VIII pass for projects above ₹10L in manufacturing)",
      "Self Help Groups, Production Co-operatives, and charitable trusts",
      "New micro enterprises set up in rural or urban areas",
    ],
    eligibilityCriteria: [
      "Project cost up to ₹50 Lakhs for manufacturing / ₹20 Lakhs for services",
      "Only new projects eligible (no existing units for initial subsidy)",
      "Bank sanctions 90-95% of project cost with KVIC margin subsidy held in 3-year term deposit",
    ],
    howToApply: [
      "Apply online on KVIC PMEGP e-Portal (kviconline.gov.in/pmegpeportal)",
      "Submit detailed project report, Aadhaar, caste/special category certificate if claiming 35%",
      "District Level Task Force Committee (DLTFC) evaluates and forwards to financing bank",
    ],
    documentsRequired: [
      "Detailed Project Profile with machinery and quotation details",
      "Educational qualification certificate (VIII pass or higher)",
      "Aadhaar card, PAN card, and domicile proof",
      "Special category certificate (Women, SC/ST, Ex-servicemen, PwD, Rural)",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Prototyping & Product Development",
      "Packaging & Printing",
      "Business & Finance Services",
    ],
    industryKeywords: [
      "Manufacturing",
      "Food Processing",
      "Textiles",
      "Engineering",
      "Workshop",
      "Rural",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue", "Micro"],
    procurementTriggers: ["Machinery", "Tooling", "Capex", "Working Capital"],
    officialUrl: "https://www.kviconline.gov.in/pmegpeportal",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - Employment Generation & Subsidies",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "KVIC / State KVIB / District Industries Centre (DIC)",
    keyBenefits: [
      "Up to 35% non-refundable government margin subsidy",
      "Covers both plant machinery procurement and working capital",
      "Low promoter margin equity requirement (only 5% for special categories)",
    ],
  },
  {
    id: "SCH-NSIC-SPRS-08",
    name: "NSIC Single Point Registration Scheme (SPRS) for Government Tenders",
    shortName: "NSIC SPRS Public Procurement",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "National Small Industries Corporation (NSIC)",
    description:
      "Enables MSEs to participate in Central and State Government purchases under the Public Procurement Policy without paying Earnest Money Deposits.",
    natureOfAssistance:
      "Free tender sets, complete exemption from Earnest Money Deposit (EMD), and waiver of security deposit up to monetary limit. Price preference in tenders: MSEs quoting within L1+15% allowed to supply up to 25% of tender volume at L1 price.",
    assistanceAmountMax:
      "100% EMD waiver + 25% mandatory purchase preference in Government & PSU tenders",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Micro and Small manufacturing and service enterprises with commercial production",
      "Startups with commercial production seeking Railway, Defense, CPSE, and GeM procurement",
    ],
    eligibilityCriteria: [
      "Valid Udyam Registration Certificate",
      "Manufacturing setup inspected and validated by RITES / NSIC technical officers",
      "Financial soundness verified by chartered accountant",
    ],
    howToApply: [
      "Apply online on NSIC SPRS portal (nsicspronline.com)",
      "Submit machinery inventory list, production capabilities, and test equipment list",
      "Inspection by designated inspecting agency (RITES / CQAE / NSIC)",
      "Issuance of NSIC SPRS Certificate with quantitative capacity endorsement",
    ],
    documentsRequired: [
      "Udyam Registration Certificate",
      "Machinery list with purchase invoices and installed electrical capacity",
      "Audited balance sheets of last three years (or provisional for startups)",
      "Testing facility equipment documentation and quality certificates",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: [
      "Compliance & Legal Support",
      "Specialized Startup Support",
      "Prototyping & Product Development",
    ],
    industryKeywords: [
      "Government Tenders",
      "GeM",
      "PSU Procurement",
      "Defense",
      "Railways",
      "B2G",
    ],
    stageKeywords: [
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Micro",
      "Small",
    ],
    procurementTriggers: [
      "Certifications",
      "Inspection",
      "Tooling",
      "Compliance",
    ],
    officialUrl: "https://www.nsicspronline.com",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "NSIC Schemes - Marketing Support",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "National Small Industries Corporation (NSIC) Branch Offices",
    keyBenefits: [
      "Complete exemption from submitting Earnest Money Deposit (EMD)",
      "Tender documents provided free of cost by all Central Ministries and PSUs",
      "25% reserved purchase allocation under Public Procurement Policy for MSEs",
    ],
  },
  {
    id: "SCH-NSIC-RMA-09",
    name: "NSIC Raw Material Assistance Scheme (RMA)",
    shortName: "NSIC Raw Material Assistance",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "National Small Industries Corporation (NSIC)",
    description:
      "Finances the procurement of indigenous and imported raw materials for manufacturing MSEs against bank guarantees at concessional interest rates.",
    natureOfAssistance:
      "Financial assistance against bank guarantee for 90 to 180 days to purchase scarce and bulk raw materials (steel, polymers, paper, metals, chemicals) directly from primary producers.",
    assistanceAmountMax:
      "Up to ₹5,00,00,000 (₹5 Crore) raw material financing against Bank Guarantee",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Micro and Small manufacturing units requiring bulk raw material supply",
      "Hardware and packaging manufacturing MSMEs with seasonal raw material needs",
    ],
    eligibilityCriteria: [
      "Udyam-registered manufacturing MSE",
      "Provision of acceptable Bank Guarantee from scheduled commercial bank",
      "Firm procurement orders from institutional buyers or steady manufacturing cycle",
    ],
    howToApply: [
      "Submit application to nearest NSIC branch along with raw material purchase invoices",
      "Provide Bank Guarantee from approved bank",
      "NSIC places order directly with primary producers (SAIL, IOCL, NALCO, paper mills) and releases payment",
    ],
    documentsRequired: [
      "Udyam Certificate & PAN/GSTIN",
      "Proforma invoice / quotation of raw material from primary manufacturer",
      "Original Bank Guarantee in NSIC prescribed format",
      "Audited financial statements and sanction letter",
    ],
    targetBeneficiaries: ["msme"],
    categories: [
      "Packaging & Printing",
      "Prototyping & Product Development",
      "Business & Finance Services",
    ],
    industryKeywords: [
      "Raw Materials",
      "Polymers",
      "Steel",
      "Paper Board",
      "Bulk Sourcing",
      "Working Capital",
    ],
    stageKeywords: [
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Micro",
      "Small",
    ],
    procurementTriggers: [
      "Raw Material",
      "Packaging",
      "Tooling",
      "Working Capital",
    ],
    officialUrl: "https://www.nsic.co.in/Schemes/Raw-Material-Assistance",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "NSIC Schemes - Raw Material Assistance",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "NSIC Regional and Branch Offices across India",
    keyBenefits: [
      "Enables bulk procurement discounts from primary producers (SAIL, Reliance, IOCL)",
      "90-180 days credit tenure with low interest rate (starting 8.5% - 9.5%)",
      "Prevents production shutdowns caused by raw material supply shortages",
    ],
  },
  {
    id: "SCH-LEAN-10",
    name: "Lean Manufacturing Competitiveness Scheme (LMCS)",
    shortName: "Lean Manufacturing Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Implements Lean manufacturing techniques (5S, Kaizen, Kanban, TPM, Poka-Yoke, Value Stream Mapping) to reduce manufacturing cycle time, eliminate waste, and boost productivity.",
    natureOfAssistance:
      "Government pays 80% of total Lean consultant fees up to ₹36 Lakhs per mini-cluster of 6-10 units (MSME units share remaining 20% collectively).",
    assistanceAmountMax:
      "Up to ₹36,00,000 per cluster (80% government grant for Lean consultant fees)",
    subsidyPercentMax: 80,
    whoCanApply: [
      "Groups of 6 to 10 MSME manufacturing units forming a Mini-Cluster",
      "Suppliers in packaging, plastics, precision engineering, tooling, and electronics",
    ],
    eligibilityCriteria: [
      "All units must have Udyam registration",
      "Units situated in geographic proximity within industrial area / estate",
      "Commitment to 18-month phased lean transformation",
    ],
    howToApply: [
      "Form Special Purpose Vehicle (SPV) / Mini Cluster with fellow MSMEs",
      "Submit application on National Lean Portal or through National Productivity Council (NPC) / QCI",
      "Select empaneled Lean Manufacturing Consultant",
      "DC-MSME approves and releases 80% consultant fees across milestone stages",
    ],
    documentsRequired: [
      "Udyam certificates of all constituent member units",
      "Mini Cluster Memorandum of Understanding (MOU)",
      "Baseline operational performance report (waste percentage, cycle time, rejection rate)",
      "Empaneled Lean Consultant proposal",
    ],
    targetBeneficiaries: ["msme"],
    categories: [
      "Prototyping & Product Development",
      "Specialized Startup Support",
      "Compliance & Legal Support",
    ],
    industryKeywords: [
      "Lean",
      "Productivity",
      "Kaizen",
      "Waste Reduction",
      "Efficiency",
      "Manufacturing",
    ],
    stageKeywords: [
      "Traction",
      "Growth",
      "Scaling",
      "Micro",
      "Small",
      "Medium",
    ],
    procurementTriggers: ["Tooling", "Inspection", "Certifications"],
    officialUrl: "https://dcmsme.gov.in/schemes/Lean_Manufacturing.htm",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter:
      "Ministry of MSME - National Manufacturing Competitiveness Programme",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "National Productivity Council (NPC) / Quality Council of India (QCI) / DC-MSME",
    keyBenefits: [
      "80% non-refundable grant for professional Lean consultant coaching",
      "Average 20-30% reduction in manufacturing floor cycle time and scrap waste",
      "Dramatically improves supplier delivery reliability for startup purchase orders",
    ],
  },
  {
    id: "SCH-INCUBATION-11",
    name: "Support for Entrepreneurial and Managerial Development of SMEs through Incubators",
    shortName: "MSME Idea Incubation Grant",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Supports emerging ideas and innovative concepts from technical innovators, startups, and MSMEs through designated Host Institutes (IITs, NITs, engineering colleges).",
    natureOfAssistance:
      "Financial assistance up to ₹15 Lakhs per approved idea for developing prototype/proof of concept. Up to ₹1 Crore for Host Institute machinery and testing lab infrastructure.",
    assistanceAmountMax:
      "Up to ₹15,00,000 grant per idea / ₹1 Crore for incubation testing lab",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Innovators, entrepreneurs, early-stage startups, and micro/small enterprises",
      "Engineering and technology founders developing novel hardware, packaging, or tech solutions",
    ],
    eligibilityCriteria: [
      "Novel product or process innovation with commercialization potential",
      "Affiliation with a recognized Host Institute (HI) approved by DC-MSME",
      "Project duration up to 12 months for prototype development",
    ],
    howToApply: [
      "Submit innovation proposal through the MSME Hackathon / Ideas portal (my.msme.gov.in)",
      "Select nearest approved Host Institute / University incubation cell",
      "Host Institute evaluates idea and presents to National Project Monitoring Committee (NPMC)",
      "Funds disbursed directly to Host Institute to cover prototype tooling, testing, and component purchases",
    ],
    documentsRequired: [
      "Concept note detailing problem statement, technical novelty, and bill of materials",
      "Identity and address proofs of founder / Udyam certificate if registered",
      "Prototype cost estimate breakdown (machinery, raw materials, testing fees)",
      "Host Institute recommendation letter",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Prototyping & Product Development",
      "Specialized Startup Support",
      "IT & Digital Services",
    ],
    industryKeywords: [
      "Incubation",
      "Prototyping",
      "Hardware",
      "CleanTech",
      "AgriTech",
      "DeepTech",
      "IoT",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue", "Micro"],
    procurementTriggers: [
      "Prototyping",
      "3D Printing",
      "Tooling",
      "Quality Testing",
      "Raw Material",
    ],
    officialUrl: "https://my.msme.gov.in/inc",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - Incubation & Innovation",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "Host Institutes (IITs, NITs) & Incubation Cell, O/o DC-MSME, New Delhi",
    keyBenefits: [
      "100% grant funding up to ₹15 Lakhs without equity dilution",
      "Direct access to advanced university CNC, testing, and prototyping toolrooms",
      "Mentorship from technical professors and industry experts",
    ],
  },

  // ── 2. Ministry of Communications & IT (DeitY / MeitY) ──────────────────────
  {
    id: "SCH-MEITY-TIDE-12",
    name: "Technology Incubation and Development of Entrepreneurs (TIDE 2.0)",
    shortName: "MeitY TIDE 2.0 Scheme",
    ministry: "Ministry of Electronics and Information Technology (MeitY)",
    department: "Innovation & IPR Division, MeitY",
    description:
      "Promotes tech entrepreneurship by providing financial and technical support to incubators supporting ICT startups using emerging technologies (IoT, AI, Blockchain, Robotics).",
    natureOfAssistance:
      "Entrepreneur-in-Residence (EIR) fellowship up to ₹4 Lakhs (₹30,000/mo for 12 months) + Grant-in-aid up to ₹7 Lakhs for Proof-of-Concept + up to ₹40 Lakhs Scale-up fund.",
    assistanceAmountMax:
      "Up to ₹7,00,000 Grant-in-aid (PoC) + up to ₹40,00,000 Scale-up investment",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Tech startups in electronics, IoT, software, health informatics, AI, and cybersecurity",
      "Individual innovators transitioning idea to working hardware/software prototype",
    ],
    eligibilityCriteria: [
      "Indian entity with majority Indian shareholding (>51%)",
      "Utilizing emerging digital technologies in ICT domain",
      "Incubated at an authorized TIDE 2.0 incubation center (IITs, IIITs, NITs, STPI)",
    ],
    howToApply: [
      "Apply directly through TIDE 2.0 partner incubators (over 50 incubators across India)",
      "Submit pitch deck and procurement expenditure forecast for prototyping",
      "Incubator Investment Committee screens and disburses milestone-based grant",
    ],
    documentsRequired: [
      "Company incorporation certificate & DPIIT recognition certificate",
      "Pitch deck and technical architecture specification",
      "Detailed budget plan for prototype components, cloud infrastructure, and tool sourcing",
      "Founders resume and equity cap table",
    ],
    targetBeneficiaries: ["startup"],
    categories: [
      "IT & Digital Services",
      "Prototyping & Product Development",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "IoT",
      "AI",
      "Electronics",
      "ICT",
      "Robotics",
      "Software",
      "Sensors",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue"],
    procurementTriggers: [
      "Prototyping",
      "Cloud",
      "Tooling",
      "Quality Testing",
      "3D Printing",
    ],
    officialUrl: "https://meitystartuphub.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Communications & IT - TIDE Scheme",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "MeitY Startup Hub (MSH), Electronics Niketan, CGO Complex, New Delhi",
    keyBenefits: [
      "Non-dilutive prototype grant of ₹7 Lakhs",
      "Follow-on scale up equity/debt fund up to ₹40 Lakhs",
      "Free lab testing facilities and cloud infrastructure credits",
    ],
  },
  {
    id: "SCH-MEITY-SIPEIT-13",
    name: "Support for International Patent Protection in Electronics & IT (SIP-EIT)",
    shortName: "SIP-EIT International Patent Grant",
    ministry: "Ministry of Electronics and Information Technology (MeitY)",
    department: "Cyber Laws and Data Governance / IPR Division",
    description:
      "Encourages innovation and recognizes the value of international IPR in Electronics, Information Technology, and Telecom by providing financial reimbursement for international patent filing.",
    natureOfAssistance:
      "Reimbursement of up to 50% of the total expenses incurred in filing patent applications abroad, subject to a maximum ceiling of ₹15 Lakhs per invention.",
    assistanceAmountMax:
      "Up to ₹15,00,000 per invention (50% reimbursement of international patent expenses)",
    subsidyPercentMax: 50,
    whoCanApply: [
      "MSMEs and registered tech startups in ICT, Electronics, Telecommunications, and Software",
      "Inventions having an international patent filing through PCT or Paris Convention route",
    ],
    eligibilityCriteria: [
      "Registered Indian MSME with Udyam Certificate or DPIIT recognized startup",
      "Invention must belong to Electronics / ICT domain",
      "Application filed within 24 months of earliest priority date",
    ],
    howToApply: [
      "Submit application online on SIP-EIT portal (sbeit.meity.gov.in)",
      "Upload copy of patent application, international search report (ISR), and official fee vouchers",
      "MeitY Technical Scrutiny Committee evaluates patentability and commercial significance",
      "Direct reimbursement credited to company account",
    ],
    documentsRequired: [
      "Udyam registration or DPIIT Startup certificate",
      "Complete specification as filed with Indian Patent Office / WIPO",
      "PCT search report and Written Opinion of International Searching Authority (ISA)",
      "Original invoices from international patent attorneys and official patent office receipts",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Compliance & Legal Support",
      "IT & Digital Services",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "International Patents",
      "Electronics",
      "IT",
      "Software",
      "Semiconductors",
      "IPR",
    ],
    stageKeywords: [
      "Prototype",
      "MVP",
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
    ],
    procurementTriggers: ["Patents", "Legal", "Certifications"],
    officialUrl: "https://www.meity.gov.in/content/sip-eit",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Communications & IT - SIP-EIT",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "IPR Division, MeitY, New Delhi",
    keyBenefits: [
      "Reimburses up to ₹15 Lakhs per foreign patent jurisdiction (US, Europe, Japan, etc.)",
      "Covers both statutory fees and registered patent attorney fees",
      "Substantially mitigates the high cost of global IP enforcement",
    ],
  },

  // ── 3. Ministry of Science & Technology (DST / DBT / BIRAC) ────────────────
  {
    id: "SCH-BIRAC-BIG-14",
    name: "Biotechnology Ignition Grant (BIG - BIRAC)",
    shortName: "BIRAC BIG Grant",
    ministry: "Ministry of Science and Technology",
    department: "Biotechnology Industry Research Assistance Council (BIRAC)",
    description:
      "Enables biotechnologists, medical device innovators, and diagnostics startups to establish proof of concept and generate preliminary validation data.",
    natureOfAssistance:
      "Grant-in-aid up to ₹50 Lakhs for a period of up to 18 months. Completely non-dilutive and milestone-governed.",
    assistanceAmountMax:
      "Up to ₹50,00,000 (100% non-dilutive grant-in-aid for 18 months)",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Individual entrepreneurs, research scientists, and registered startups (< 5 years old)",
      "Projects in MedTech, Diagnostics, Bio-pharma, Agri-biotech, Industrial biotech, Clean energy",
    ],
    eligibilityCriteria: [
      "Indian startup with >51% Indian promoter equity holding",
      "Clear scientific proof-of-concept requiring experimental validation",
      "Innovator must not be a full-time employee of government / academic institution during grant execution",
    ],
    howToApply: [
      "Apply online on BIRAC portal during twice-a-year call for proposals (January & July)",
      "Select designated BIG Partner (C-CAMP, FITT, Venture Center, KIIT-TBI, IKP, etc.)",
      "Two-tier evaluation: Online review followed by presentation before Technical Expert Committee (TEC)",
      "Milestone-based fund release into project bank escrow",
    ],
    documentsRequired: [
      "Incorporation certificate, DPIIT certificate, and MOA/AOA",
      "Detailed scientific experimental protocol and milestone Gantt chart",
      "Budget quotations for reagents, equipment, clinical testing, and prototype fabrication",
      "CV of team and scientific advisory board members",
    ],
    targetBeneficiaries: ["startup"],
    categories: [
      "Prototyping & Product Development",
      "Specialized Startup Support",
      "Compliance & Legal Support",
    ],
    industryKeywords: [
      "MedTech",
      "Biotechnology",
      "Healthcare",
      "Diagnostics",
      "Biofuels",
      "AgriBiotech",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP"],
    procurementTriggers: [
      "Prototyping",
      "Quality Testing",
      "Tooling",
      "Inspection",
      "Certifications",
    ],
    officialUrl: "https://birac.nic.in/big.php",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Science & Technology - DBT / BIRAC Schemes",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "BIRAC, 1st Floor MTNL Building, CGO Complex, Lodhi Road, New Delhi",
    keyBenefits: [
      "₹50 Lakhs non-dilutive grant without surrendering founder equity",
      "Access to top national biosafety level labs and analytical facilities",
      "Credible scientific validation attracting follow-on Series A venture capital",
    ],
  },
  {
    id: "SCH-DST-PRAYAS-15",
    name: "National Initiative for Developing and Harnessing Innovations (NIDHI-PRAYAS)",
    shortName: "NIDHI-PRAYAS Prototype Grant",
    ministry: "Ministry of Science and Technology",
    department: "Department of Science and Technology (DST)",
    description:
      "Supports technology-based innovators with prototyping grant-in-aid to convert an innovative idea into a physical working prototype within 18 months.",
    natureOfAssistance:
      "Prototype grant up to ₹10 Lakhs to innovators/startups. Provides access to PRAYAS Fab-Lab makerspaces equipped with 3D printers, laser cutters, and testing equipment.",
    assistanceAmountMax:
      "Up to ₹10,00,000 prototype fabrication grant + FabLab access",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Individual innovators, student innovators, and early-stage technology startups",
      "Hardware, IoT, Robotics, Renewable Energy, and Smart Manufacturing founders",
    ],
    eligibilityCriteria: [
      "Indian citizen innovator or Indian startup incorporated < 3 years",
      "Physical prototype requirement in mechanical, electrical, electronics, or biomedical fields",
      "Must be incubated or affiliated with a designated PRAYAS Centre (PC)",
    ],
    howToApply: [
      "Submit application to nearest NIDHI-PRAYAS Centre incubator (over 40 across India)",
      "Present prototype bill of materials, engineering schematics, and testing plans",
      "PRAYAS Monitoring Committee conducts pitch review and sanctions budget directly for prototype execution",
    ],
    documentsRequired: [
      "Concept CAD design, block diagrams, and technical specification sheet",
      "Procurement quotation for raw materials, CNC machining, PCB fabrication, and sensors",
      "Aadhaar / Passport and startup incorporation certificate",
      "Declaration of no concurrent prototype grant for the same concept",
    ],
    targetBeneficiaries: ["startup"],
    categories: [
      "Prototyping & Product Development",
      "Packaging & Printing",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "Hardware",
      "Robotics",
      "IoT",
      "EV",
      "Smart Devices",
      "Prototyping",
      "Electronics",
    ],
    stageKeywords: ["Idea", "Prototype"],
    procurementTriggers: [
      "Prototyping",
      "3D Printing",
      "Tooling",
      "Machinery",
      "Quality Testing",
    ],
    officialUrl: "https://www.nidhi-prayas.org",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Science & Technology - DST NIDHI",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "National Science & Technology Entrepreneurship Development Board (NSTEDB), DST",
    keyBenefits: [
      "₹10 Lakhs grant specifically earmarked for hardware prototype fabrication",
      "Free utilization of specialized industrial 3D printing and PCB testing equipment",
      "Eliminates early personal financial burden for physical hardware product development",
    ],
  },
  {
    id: "SCH-BIRAC-BIPP-16",
    name: "Biotechnology Industry Partnership Programme (BIPP)",
    shortName: "BIRAC BIPP High-Tech Grant",
    ministry: "Ministry of Science and Technology",
    department: "BIRAC / Department of Biotechnology (DBT)",
    description:
      "A government-industry partnership scheme for high-risk, transformative technology development in biosciences and medical hardware.",
    natureOfAssistance:
      "Cost-sharing grant-in-aid up to 50% of the project cost for large-scale clinical trials, pilot manufacturing lines, and advanced medical hardware validation.",
    assistanceAmountMax:
      "Up to ₹2,00,00,000 (₹2 Crore) matching grant for pilot manufacturing & validation",
    subsidyPercentMax: 50,
    whoCanApply: [
      "Biotech, MedTech, and Healthcare device manufacturing enterprises",
      "Startups and MSMEs with in-house DSIR-recognized R&D units or university tie-ups",
    ],
    eligibilityCriteria: [
      "Registered Indian company with minimum 51% Indian shareholding",
      "In-house R&D capability or joint research partnership with national labs",
      "Proof-of-concept already demonstrated, transitioning to clinical validation / pilot tooling",
    ],
    howToApply: [
      "Apply online on BIRAC portal during periodic national calls for proposal",
      "Submit detailed project report detailing pilot production and clinical trial procurement",
      "Peer review by Technical Advisory Committee and joint site visit",
    ],
    documentsRequired: [
      "DSIR R&D recognition certificate or equivalent academic joint venture MOU",
      "Proof of concept data and intellectual property registration proofs",
      "Audited balance sheets of last 3 years and detailed procurement quotes",
      "Company incorporation certificate and board resolution",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Prototyping & Product Development",
      "Specialized Startup Support",
      "Compliance & Legal Support",
    ],
    industryKeywords: [
      "MedTech",
      "Biotech",
      "Clinical Validation",
      "Medical Devices",
      "Pharma",
    ],
    stageKeywords: [
      "MVP",
      "Early Revenue",
      "Traction",
      "Growth",
      "Small",
      "Medium",
    ],
    procurementTriggers: [
      "Prototyping",
      "Quality Testing",
      "Tooling",
      "Certifications",
      "Inspection",
    ],
    officialUrl: "https://birac.nic.in/desc_new.php?id=82",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Science & Technology - DBT / BIRAC Schemes",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "BIRAC BIPP Management Cell, New Delhi",
    keyBenefits: [
      "Substantial non-dilutive capital (up to ₹2 Crore) for capital-intensive pilot manufacturing",
      "Accelerates regulatory certifications (CDSCO, FDA, CE-IVD) for medical hardware",
      "Subsidizes high-end tooling and cleanroom facility setup",
    ],
  },

  // ── 4. Ministry of Commerce & Industry (DPIIT) ─────────────────────────────
  {
    id: "SCH-DPIIT-SISFS-17",
    name: "Startup India Seed Fund Scheme (SISFS)",
    shortName: "Startup India Seed Fund",
    ministry: "Ministry of Commerce and Industry",
    department:
      "Department for Promotion of Industry and Internal Trade (DPIIT)",
    description:
      "Provides financial assistance to startups for proof of concept, prototype development, product trials, market entry, and commercialization.",
    natureOfAssistance:
      "Up to ₹20 Lakhs as grant for validation of Proof of Concept, or prototype development, or product trials. Up to ₹50 Lakhs of investment for market entry, commercialization, or scaling up through convertible debentures or debt-linked instruments.",
    assistanceAmountMax:
      "Up to ₹20,00,000 prototype grant / Up to ₹50,00,000 debt/convertible funding",
    subsidyPercentMax: 100,
    whoCanApply: [
      "DPIIT-recognized startups incorporated within 2 years of the application date",
      "Startups with business ideas having a clear technology/product angle",
      "Founders who have not received more than ₹10 Lakhs of monetary support under other government schemes",
    ],
    eligibilityCriteria: [
      "Active DPIIT Recognition Certificate",
      "Incorporation age not exceeding 2 years",
      "Should have a viable product concept ready for prototype tooling, sample trials, or pilot release",
      "Indian promoters must hold at least 51% shareholding in the company",
    ],
    howToApply: [
      "Log into the Startup India portal (seedfund.startupindia.gov.in)",
      "Select up to 3 approved incubators in order of preference",
      "Submit pitch deck and procurement expenditure plan (tooling, samples, certifications)",
      "Incubator Seed Management Committee evaluates and sanctions funds in milestones",
    ],
    documentsRequired: [
      "DPIIT Recognition Certificate & Certificate of Incorporation",
      "Pitch deck detailing product novelty, target market, and team",
      "Itemized procurement expenditure projection for prototype and initial batch production",
      "Bank statement and GST registration (if applicable)",
    ],
    targetBeneficiaries: ["startup"],
    categories: [
      "Prototyping & Product Development",
      "Packaging & Printing",
      "Specialized Startup Support",
      "IT & Digital Services",
    ],
    industryKeywords: [
      "Startup",
      "DPIIT",
      "Seed Stage",
      "Hardware",
      "D2C",
      "Tech",
      "SaaS",
      "Prototyping",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue"],
    procurementTriggers: [
      "Prototyping",
      "Tooling",
      "Packaging",
      "Quality Testing",
      "Cloud",
      "3D Printing",
    ],
    officialUrl: "https://seedfund.startupindia.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Commerce & Industry - Startup India",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "Startup India Hub, DPIIT, Udyog Bhawan, New Delhi",
    keyBenefits: [
      "₹20 Lakhs non-dilutive grant for proof-of-concept fabrication and tooling",
      "Up to ₹50 Lakhs convertible debt on entrepreneur-friendly terms for initial inventory",
      "No collateral requirement or personal guarantees demanded",
    ],
  },
  {
    id: "SCH-DPIIT-SIPP-18",
    name: "Scheme for Facilitating Start-Ups Intellectual Property Protection (SIPP)",
    shortName: "Startup India IP Protection (SIPP)",
    ministry: "Ministry of Commerce and Industry",
    department:
      "Controller General of Patents, Designs & Trade Marks (CGPDTM) / DPIIT",
    description:
      "Protects and promotes intellectual property rights of startups through fast-track examination and free legal facilitator services.",
    natureOfAssistance:
      "Government pays 100% of professional facilitator fees directly to registered patent/trademark attorneys. Startups only pay statutory government fees with 80% rebate on patent filing fees and 50% rebate on trademark fees.",
    assistanceAmountMax:
      "100% facilitator legal fees paid by Govt + 80% rebate on statutory patent fees",
    subsidyPercentMax: 80,
    whoCanApply: [
      "Any DPIIT-recognized startup seeking patent, design, or trademark protection in India",
    ],
    eligibilityCriteria: [
      "Valid DPIIT recognition certificate",
      "Invention or trademark conceived and owned by the registered startup",
    ],
    howToApply: [
      "Choose a registered Facilitator from the official list on the Indian Patent Office website (ipindia.gov.in)",
      "Facilitator drafts and files patent/trademark without charging legal drafting fees to the startup",
      "Facilitator claims fee reimbursement directly from the CGPDTM office",
    ],
    documentsRequired: [
      "DPIIT Recognition Certificate",
      "Patent provisional or complete specification document",
      "Startup undertaking and Form 1 / Form 2 / TM-A forms",
    ],
    targetBeneficiaries: ["startup"],
    categories: ["Compliance & Legal Support", "Specialized Startup Support"],
    industryKeywords: [
      "Patents",
      "Trademarks",
      "Design Registration",
      "Intellectual Property",
      "Legal",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue", "Traction"],
    procurementTriggers: ["Patents", "Legal", "Certifications"],
    officialUrl: "https://ipindia.gov.in/startups.htm",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Commerce & Industry - IPR Promotion",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "Office of CGPDTM, Mumbai / DPIIT, New Delhi",
    keyBenefits: [
      "Zero attorney drafting and filing fees (100% absorbed by Central Government)",
      "80% statutory fee discount on patent applications",
      "Fast-track expedited patent examination (granted in months rather than years)",
    ],
  },
  {
    id: "SCH-COMMERCE-MAI-19",
    name: "Market Access Initiative (MAI) Scheme for Exports",
    shortName: "Market Access Initiative (MAI)",
    ministry: "Ministry of Commerce and Industry",
    department: "Department of Commerce",
    description:
      "Catalyzes exports by supporting Indian MSMEs and startups to showcase products at international exhibitions, obtain overseas quality certifications, and enter foreign markets.",
    natureOfAssistance:
      "Financial assistance up to ₹5 Lakhs for airfare and stall charges in international trade fairs. Up to 50% reimbursement of testing, inspection, and certification costs for statutory compliance required in overseas export markets (US FDA, CE, REACH, RoHS).",
    assistanceAmountMax:
      "Up to ₹5,00,000 for trade fair participation + up to 50% overseas certification cost",
    subsidyPercentMax: 50,
    whoCanApply: [
      "Exporting MSMEs and startups with valid Importer-Exporter Code (IEC)",
      "Members of recognized Export Promotion Councils (EEPC, FIEO, CHEMEXCIL, APEDA, etc.)",
    ],
    eligibilityCriteria: [
      "Active Udyam registration and valid IEC number",
      "Membership with relevant Export Promotion Council or Commodity Board",
      "Participation in approved overseas fairs or statutory testing for international export compliance",
    ],
    howToApply: [
      "Apply through respective Export Promotion Council (EPC) or directly on DGFT portal",
      "Submit trade exhibition stall allocation invoice or overseas testing laboratory bill",
      "EPC verifies and disburses grant directly into the exporter bank account",
    ],
    documentsRequired: [
      "Udyam Registration Certificate & Importer-Exporter Code (IEC)",
      "Proof of overseas trade fair participation / exhibition stall receipt",
      "Testing lab invoices and overseas certification test reports (CE, FDA, RoHS)",
      "Air ticket invoices and boarding passes",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: [
      "Packaging & Printing",
      "Compliance & Legal Support",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "Exports",
      "International Trade",
      "Certifications",
      "CE Mark",
      "FDA",
      "Packaging",
    ],
    stageKeywords: ["Traction", "Growth", "Scaling", "Small", "Medium"],
    procurementTriggers: [
      "Certifications",
      "Packaging",
      "Inspection",
      "Quality Testing",
    ],
    officialUrl:
      "https://commerce.gov.in/schemes/market-access-initiative-mai-scheme",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Commerce & Industry - Export Promotion",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "Export Promotion Councils (FIEO, EEPC) / Department of Commerce, New Delhi",
    keyBenefits: [
      "Subsidizes 50% of expensive international compliance certifications (CE, FDA, UL)",
      "Up to ₹5 Lakhs reimbursement for showcasing products in overseas trade exhibitions",
      "Expedites global buyer customer acquisition and cross-border vendor partnerships",
    ],
  },

  // ── 5. Ministry of Finance / SIDBI ─────────────────────────────────────────
  {
    id: "SCH-SIDBI-SMILE-20",
    name: "SIDBI Make in India Soft Loan Fund for Micro, Small & Medium Enterprises (SMILE)",
    shortName: "SIDBI SMILE Soft Loan",
    ministry: "Ministry of Finance",
    department: "Small Industries Development Bank of India (SIDBI)",
    description:
      "Provides soft loans in the nature of quasi-equity and term loans on relatively soft terms to MSMEs for meeting the required debt-equity ratio for technology modernization.",
    natureOfAssistance:
      "Quasi-equity soft loan up to 10% of project cost (max ₹25 Lakhs) at attractive interest rates with moratorium up to 3 years. Term loan component with competitive interest rates up to ₹25 Crore.",
    assistanceAmountMax:
      "Up to ₹25,00,000 quasi-equity soft loan + Term loans up to ₹25 Crore",
    subsidyPercentMax: 10,
    whoCanApply: [
      "New and existing enterprises in 25 high-priority Make in India manufacturing sectors",
      "MSMEs undertaking technology expansion, precision tooling, or automation setup",
    ],
    eligibilityCriteria: [
      "Valid Udyam Registration Certificate",
      "Minimum debt-equity ratio of 3:1 on completed project",
      "Viable manufacturing proposal with established customer demand or confirmed contracts",
    ],
    howToApply: [
      "Apply online on SIDBI portal (sidbi.in) or through SIDBI branch offices",
      "Submit Detailed Project Report including machine quotations and cash flow models",
      "SIDBI appraisal committee inspects plant premises and sanctions loan facility",
    ],
    documentsRequired: [
      "Udyam Certificate & DPIIT recognition (if applicable)",
      "Detailed Project Report (DPR) with machinery supplier quotations",
      "Audited balance sheets of last 3 years (or promoters net worth statements)",
      "Factory land lease / ownership deed and statutory environmental clearances",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: [
      "Business & Finance Services",
      "Prototyping & Product Development",
      "Packaging & Printing",
    ],
    industryKeywords: [
      "Make In India",
      "Soft Loan",
      "Machinery",
      "Capex",
      "Automation",
      "Manufacturing",
    ],
    stageKeywords: [
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Small",
      "Medium",
    ],
    procurementTriggers: ["Machinery", "Tooling", "Capex", "Working Capital"],
    officialUrl: "https://www.sidbi.in/en/products/direct-lending/smile",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Finance - SIDBI Financing",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "SIDBI Regional & Branch Offices nationwide",
    keyBenefits: [
      "Subordinated debt / quasi-equity fulfills promoters equity gap for institutional loans",
      "Generous 3-year repayment moratorium during initial plant setup phase",
      "Reduced interest rates compared to private commercial NBFC rates",
    ],
  },
  {
    id: "SCH-STANDUP-21",
    name: "Stand-Up India Scheme for Women and SC/ST Entrepreneurs",
    shortName: "Stand-Up India Scheme",
    ministry: "Ministry of Finance",
    department: "Department of Financial Services (DFS) / SIDBI",
    description:
      "Facilitates bank loans between ₹10 Lakhs and ₹1 Crore to at least one Scheduled Caste (SC) or Scheduled Tribe (ST) borrower and at least one woman borrower per bank branch.",
    natureOfAssistance:
      "Composite bank loan (term loan and working capital) between ₹10 Lakhs and ₹1 Crore covering up to 85% of total project cost with concessional interest rates (lowest applicable MCLR).",
    assistanceAmountMax:
      "Bank loan from ₹10,00,000 up to ₹1,00,00,000 (₹1 Crore) with 85% project coverage",
    subsidyPercentMax: 85,
    whoCanApply: [
      "SC/ST and/or Woman entrepreneurs above 18 years of age",
      "For non-individual enterprises, 51% of shareholding and controlling stake must be held by SC/ST and/or women founders",
      "Greenfield enterprises in manufacturing, services, or trading sector",
    ],
    eligibilityCriteria: [
      "Enterprise must be a greenfield project (first-time venture in that domain)",
      "Borrower must not be in default to any bank or financial institution",
      "Promoter contribution minimum 15% of project cost",
    ],
    howToApply: [
      "Apply online through Stand-Up India portal (standupmitra.in) or visit any commercial bank branch",
      "Portal connects borrower with lead district manager and SIDBI handholding agencies",
      "Bank sanctions loan and disburses composite term loan and working capital credit",
    ],
    documentsRequired: [
      "Identity proof, Aadhaar, PAN, and SC/ST caste certificate (if applicable)",
      "Company incorporation certificate showing >51% woman/SC/ST ownership",
      "Detailed Project Profile and machinery supplier proforma invoices",
      "Lease agreement or land allotment letter for factory / workshop",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Business & Finance Services",
      "Packaging & Printing",
      "Prototyping & Product Development",
    ],
    industryKeywords: [
      "Women Founders",
      "SC/ST",
      "Greenfield",
      "Bank Loans",
      "Manufacturing",
      "Inclusive",
    ],
    stageKeywords: [
      "Idea",
      "Prototype",
      "MVP",
      "Early Revenue",
      "Micro",
      "Small",
    ],
    procurementTriggers: [
      "Machinery",
      "Tooling",
      "Capex",
      "Working Capital",
      "Raw Material",
    ],
    officialUrl: "https://www.standupmitra.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Finance - Stand Up India",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "All Scheduled Commercial Banks / SIDBI Handholding Centers",
    keyBenefits: [
      "Guaranteed institutional loan access from ₹10 Lakhs to ₹1 Crore",
      "Mandatory priority mandate across all 1.4 lakh bank branches in India",
      "Lower margin money (only 15%) can be combined with state subsidy convergence",
    ],
  },

  // ── 6. Ministry of Food Processing Industries (MoFPI) ──────────────────────
  {
    id: "SCH-MOFPI-PMFME-22",
    name: "PM Formalisation of Micro food processing Enterprises Scheme (PMFME)",
    shortName: "PMFME Food Processing Subsidy",
    ministry: "Ministry of Food Processing Industries (MoFPI)",
    department: "MoFPI Centrally Sponsored Scheme",
    description:
      "Provides financial, technical, and business support for upgradation of micro food processing enterprises, packaging standardization, and quality compliance.",
    natureOfAssistance:
      "Credit-linked capital subsidy of 35% of eligible project cost with a maximum ceiling of ₹10 Lakhs per unit. Seed capital of ₹40,000 per member for SHG working capital.",
    assistanceAmountMax:
      "Up to ₹10,00,000 credit-linked capital subsidy (35% of machinery & packaging cost)",
    subsidyPercentMax: 35,
    whoCanApply: [
      "Micro food processing enterprises, FPOs, Self Help Groups, and producer cooperatives",
      "Food & beverage startups packaging and selling value-added agricultural or culinary products",
    ],
    eligibilityCriteria: [
      "Micro enterprise with ownership of food processing unit",
      "Valid Udyam Registration and basic FSSAI registration",
      'Focus on "One District One Product" (ODOP) raw material preferred but open to all food lines',
    ],
    howToApply: [
      "Apply online on PMFME portal (pmfme.mofpi.gov.in)",
      "District Resource Person (DRP) assists with preparation of Detailed Project Report (DPR)",
      "District Level Committee verifies and forwards to financing bank for loan sanction and subsidy credit",
    ],
    documentsRequired: [
      "Udyam Certificate & FSSAI Registration",
      "Aadhaar card, PAN card, and bank passbook of promoter",
      "Quotation for food processing machinery, retort packaging, or cold storage tooling",
      "Detailed Project Report (DPR)",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Packaging & Printing",
      "Prototyping & Product Development",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "Food Processing",
      "FMCG",
      "Beverages",
      "Packaging",
      "Agro Products",
      "D2C Food",
    ],
    stageKeywords: [
      "Idea",
      "Prototype",
      "MVP",
      "Early Revenue",
      "Traction",
      "Micro",
    ],
    procurementTriggers: [
      "Packaging",
      "Machinery",
      "Tooling",
      "Quality Testing",
      "Certifications",
    ],
    officialUrl: "https://pmfme.mofpi.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Food Processing - PMFME",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "State Nodal Agency (SNA) / District Industries Centre (DIC)",
    keyBenefits: [
      "35% direct non-repayable capital subsidy for packaging machines and retort equipment",
      "Free technical handholding by District Resource Persons for DPR preparation",
      "Subsidizes FSSAI testing and nutritional shelf-life lab reports",
    ],
  },
  {
    id: "SCH-MOFPI-COLDCHAIN-23",
    name: "Pradhan Mantri Kisan SAMPADA Yojana - Cold Chain & Value Addition Infrastructure",
    shortName: "PM Kisan SAMPADA Cold Chain",
    ministry: "Ministry of Food Processing Industries (MoFPI)",
    department: "MoFPI Infrastructure Division",
    description:
      "Provides integrated cold chain, refrigerated transport, and preservation facilities from farm gate to consumer to minimize post-harvest agricultural losses.",
    natureOfAssistance:
      "Financial assistance of 35% to 50% of storage and processing infrastructure cost up to ₹10 Crore per project.",
    assistanceAmountMax:
      "Up to ₹10,00,00,000 (₹10 Crore) grant for integrated cold chain & processing",
    subsidyPercentMax: 50,
    whoCanApply: [
      "Integrated cold chain logistics operators, food tech startups, and MSME processors",
      "Consortiums setting up cold storage, blast freezers, IQF, and reefer transport lines",
    ],
    eligibilityCriteria: [
      "Minimum project cost ₹5 Crore with appraisal by commercial lending bank",
      "Term loan sanction covering at least 20% of project cost",
      "Compliance with MoFPI technical standards for cold chain equipment",
    ],
    howToApply: [
      "Submit expression of interest online on SAMPADA portal (sampada-mofpi.gov.in)",
      "Detailed Project Report (DPR) with chartered engineer certificates and bank appraisal",
      "Approval Committee reviews and releases grant in 4 milestone phases",
    ],
    documentsRequired: [
      "Udyam Certificate & Company Incorporation",
      "Bank appraisal report and sanction letter for term loan",
      "Chartered Engineer approved civil and machinery quotations",
      "Statutory environmental clearances and land ownership deeds",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: ["Packaging & Printing", "Business & Finance Services"],
    industryKeywords: [
      "Cold Chain",
      "Logistics",
      "Food Processing",
      "Refrigeration",
      "Agro",
      "Preservation",
    ],
    stageKeywords: ["Traction", "Growth", "Scaling", "Small", "Medium"],
    procurementTriggers: ["Machinery", "Capex", "Working Capital"],
    officialUrl:
      "https://mofpi.gov.in/schemes/pradhan-mantri-kisan-sampada-yojana",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Food Processing - PMKSY",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "MoFPI, Panchsheel Bhawan, August Kranti Marg, New Delhi",
    keyBenefits: [
      "Huge capital grant up to ₹10 Crore covering high-end refrigeration and automated packaging",
      "Enables end-to-end cold logistics infrastructure across supply chain routes",
      "Significant reduction in cold storage operational expenses",
    ],
  },

  // ── 7. Ministry of Textiles ────────────────────────────────────────────────
  {
    id: "SCH-TEXTILES-ATUFS-24",
    name: "Amended Technology Upgradation Fund Scheme (ATUFS) for Textile MSMEs",
    shortName: "ATUFS Textile Modernization",
    ministry: "Ministry of Textiles",
    department: "Office of the Textile Commissioner, Mumbai",
    description:
      "Provides one-time capital investment subsidy for benchmarked machinery in weaving, processing, garmenting, technical textiles, and composite textile mills.",
    natureOfAssistance:
      "Capital Investment Subsidy (CIS) of 10% to 15% on benchmarked machinery with a subsidy cap ranging from ₹10 Crore to ₹30 Crore depending on the textile manufacturing segment.",
    assistanceAmountMax:
      "Up to ₹30,00,00,000 (₹30 Crore) capital subsidy on modern textile machinery",
    subsidyPercentMax: 15,
    whoCanApply: [
      "Textile manufacturing MSMEs and apparel startups upgrading loom/weaving/finishing machinery",
      "Technical textile innovators manufacturing medical textiles, geo-textiles, or smart fabrics",
    ],
    eligibilityCriteria: [
      "Valid Udyam Registration in textile manufacturing sub-sectors",
      "Term loan availed from approved lending agency for benchmarked machinery",
      "Machinery installed and inspected physically by Textile Commissioner office",
    ],
    howToApply: [
      "Apply on i-TUFS portal (itufs.gov.in) before commissioning machinery",
      "Obtain Unique Identification Number (UID) before term loan disbursement",
      "Joint physical inspection by Textile Commissioner and lending bank upon installation",
      "Subsidy credited to loan account as Capital Investment Subsidy",
    ],
    documentsRequired: [
      "Udyam Certificate & Term loan sanction letter",
      "Machine supplier invoices, bill of lading, and custom clearances",
      "Chartered Engineer valuation and commissioning certificate",
      "Audited financial statements and pollution control board consent",
    ],
    targetBeneficiaries: ["msme"],
    categories: ["Packaging & Printing", "Prototyping & Product Development"],
    industryKeywords: [
      "Textiles",
      "Apparel",
      "Garments",
      "Weaving",
      "Technical Textiles",
      "Fabrics",
    ],
    stageKeywords: [
      "Early Revenue",
      "Traction",
      "Growth",
      "Scaling",
      "Small",
      "Medium",
    ],
    procurementTriggers: ["Machinery", "Tooling", "Capex"],
    officialUrl: "https://itufs.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Textiles - ATUFS",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "Office of the Textile Commissioner, New CGO Building, Mumbai",
    keyBenefits: [
      "Direct 10-15% cash subsidy on imported and domestic high-speed textile machinery",
      "Dramatically reduces cost of automated cutting, stitching, and printing machinery",
      "Expands export compliance and production capacity for global fashion brands",
    ],
  },

  // ── 8. Ministry of Agriculture & Farmers Welfare ───────────────────────────
  {
    id: "SCH-SFAC-VCA-25",
    name: "SFAC Venture Capital Assistance (VCA) Scheme for Agribusiness",
    shortName: "SFAC Agribusiness Venture Capital",
    ministry: "Ministry of Agriculture and Farmers Welfare",
    department: "Small Farmers’ Agribusiness Consortium (SFAC)",
    description:
      "Provides interest-free venture capital assistance to agribusiness entrepreneurs and startups to bridge financial gaps in setting up agro-processing facilities.",
    natureOfAssistance:
      "Interest-free venture capital loan up to 26% of promoter equity (or ₹50 Lakhs, whichever is lower). Up to ₹5 Lakhs reimbursement for preparation of Detailed Project Report (DPR).",
    assistanceAmountMax:
      "Up to ₹50,00,000 interest-free venture capital + up to ₹5,00,000 DPR preparation grant",
    subsidyPercentMax: 26,
    whoCanApply: [
      "Agri-tech startups, agri-entrepreneurs, farmer producer companies, and food processors",
      "Entities establishing post-harvest processing, sorting, grading, and organic packing facilities",
    ],
    eligibilityCriteria: [
      "Term loan sanctioned by primary lending bank for agribusiness project",
      "Project must provide guaranteed market linkage to local small and marginal farmers",
      "Repayment begins after term loan repayment is completed",
    ],
    howToApply: [
      "Submit application online on SFAC portal (sfacindia.com)",
      "Upload bank appraisal report, DPR, and list of farmer beneficiaries",
      "SFAC Board reviews and releases interest-free venture capital to the lending bank account",
    ],
    documentsRequired: [
      "Udyam Certificate & Company Incorporation",
      "Bank appraisal and term loan sanction letter",
      "Detailed Project Report (DPR) detailing farmer procurement linkages",
      "Bank mandate and promoter net worth statement",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: ["Business & Finance Services", "Packaging & Printing"],
    industryKeywords: [
      "Agriculture",
      "AgriTech",
      "Food Processing",
      "Organic",
      "Packaging",
      "Sorting",
    ],
    stageKeywords: ["Early Revenue", "Traction", "Growth", "Small", "Medium"],
    procurementTriggers: ["Machinery", "Packaging", "Capex", "Working Capital"],
    officialUrl: "http://sfacindia.com/VCA_Scheme.aspx",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Agriculture - SFAC",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "SFAC, NCUI Auditorium Building, Siri Institutional Area, New Delhi",
    keyBenefits: [
      "100% interest-free capital loan up to ₹50 Lakhs",
      "Subordinated repayment schedule only after bank term loan is settled",
      "Reimburses cost of hiring professional consultants for project reports",
    ],
  },

  // ── 9. Ministry of Chemicals & Fertilizers ──────────────────────────────────
  {
    id: "SCH-CHEMICALS-PLASTIC-26",
    name: "Scheme for Setting up of Plastic Parks & Tooling Centers",
    shortName: "Plastic Parks Machinery Support",
    ministry: "Ministry of Chemicals and Fertilizers",
    department: "Department of Chemicals and Petrochemicals (DCPC)",
    description:
      "Supports MSMEs and polymer packaging startups operating within designated plastic parks with shared tooling, testing, and recycling infrastructure.",
    natureOfAssistance:
      "Central government grant of up to 50% of project cost (max ₹40 Crore) for common infrastructure, tooling rooms, quality control laboratories, and effluent treatment facilities.",
    assistanceAmountMax:
      "Up to ₹40,00,00,000 (₹40 Crore) cluster assistance for shared tooling & testing",
    subsidyPercentMax: 50,
    whoCanApply: [
      "Plastic, polymer, and sustainable composite packaging manufacturing units",
      "Toolrooms and mold makers supporting startup hardware and injection molding",
    ],
    eligibilityCriteria: [
      "Unit located inside or associated with approved national Plastic Parks (e.g., MP, Odisha, Assam, Jharkhand)",
      "Valid Udyam Registration and statutory environmental consent",
    ],
    howToApply: [
      "Apply through Special Purpose Vehicle (SPV) managing the respective state Plastic Park",
      "Access subsidized rates for mold-making, drop testing, polymer melt flow index analysis",
    ],
    documentsRequired: [
      "Udyam Certificate & Factory plot allotment in Plastic Park",
      "Pollution control board consent to establish/operate",
      "Machinery acquisition list and tooling capacity declaration",
    ],
    targetBeneficiaries: ["msme"],
    categories: ["Packaging & Printing", "Prototyping & Product Development"],
    industryKeywords: [
      "Plastics",
      "Packaging",
      "Polymers",
      "Injection Molding",
      "Tooling",
      "Testing",
    ],
    stageKeywords: ["Traction", "Growth", "Scaling", "Small", "Medium"],
    procurementTriggers: [
      "Tooling",
      "Quality Testing",
      "Machinery",
      "Inspection",
    ],
    officialUrl: "https://chemicals.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Chemicals - Petrochemicals & Plastics",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "DCPC, Shastri Bhawan, New Delhi / State Industrial Development Corporations",
    keyBenefits: [
      "50% subsidized access to high-end mold testing and polymer characterization labs",
      "Common effluent treatment and recycling infrastructure lowers overhead costs",
      "Lowers prototype tooling lead times for consumer packaging runs",
    ],
  },

  // ── 10. Ministry of Culture / Tourism / Handicrafts ────────────────────────
  {
    id: "SCH-HANDICRAFTS-AHVY-27",
    name: "Ambedkar Hastshilp Vikas Yojana (AHVY) for Artisan & Design Tooling",
    shortName: "AHVY Artisan & Tooling Support",
    ministry: "Ministry of Textiles",
    department: "O/o Development Commissioner (Handicrafts)",
    description:
      "Supports artisan clusters, handicraft manufacturers, and D2C sustainable design startups with modern packaging, eco-friendly tooling, and export marketing.",
    natureOfAssistance:
      "Financial assistance of 100% up to ₹10 Lakhs for modern toolkits, packaging design workshops, and quality standardization per artisan cluster.",
    assistanceAmountMax:
      "Up to ₹10,00,000 grant per cluster for toolkits, packaging, and design workshops",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Artisan cooperatives, handicraft manufacturers, and sustainable D2C craft startups",
      "Enterprises commercializing indigenous brass, wood, pottery, or textile craftsmanship",
    ],
    eligibilityCriteria: [
      "Registered with DC (Handicrafts) / Udyam registration",
      "Employs traditional Indian artisans or sustainable natural materials (bamboo, jute, clay)",
    ],
    howToApply: [
      "Submit cluster proposal to regional Office of DC (Handicrafts)",
      "Include packaging redesign requirements and tooling upgrade schedule",
    ],
    documentsRequired: [
      "Artisan identification cards / Udyam Certificate",
      "Cluster diagnostic study report",
      "Tooling and packaging specification breakdown",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: ["Packaging & Printing", "Prototyping & Product Development"],
    industryKeywords: [
      "Handicrafts",
      "Artisans",
      "Sustainable",
      "Bamboo",
      "Jute",
      "D2C",
      "Packaging",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue", "Micro"],
    procurementTriggers: ["Packaging", "Tooling", "Raw Material"],
    officialUrl: "http://handicrafts.nic.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of Textiles - Handicrafts Support",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "Office of DC (Handicrafts), West Block 7, R.K. Puram, New Delhi",
    keyBenefits: [
      "100% grant funding for modern toolkits and ergonomic hand tools",
      "Subsidizes sustainable eco-friendly packaging development for exports",
      "Direct onboarding onto Government e-Marketplace (GeM) and international fairs",
    ],
  },

  // ── 11. Ministry of MSME - Cluster Development (MSE-CDP) ───────────────────
  {
    id: "SCH-MSECDP-28",
    name: "Micro and Small Enterprises Cluster Development Programme (MSE-CDP)",
    shortName: "MSE Cluster Development (MSE-CDP)",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Supports the creation of Common Facility Centers (CFCs) and infrastructure development in industrial estates to give MSMEs shared access to expensive machinery and testing toolrooms.",
    natureOfAssistance:
      "Central government grant of up to 70% of total project cost (up to 80% for clusters with >50% Women/SC/ST units or in NER/Aspirational districts) up to ₹30 Crore per Common Facility Center.",
    assistanceAmountMax:
      "Up to ₹30,00,00,000 (₹30 Crore) central grant for Common Testing & Tooling Centers",
    subsidyPercentMax: 80,
    whoCanApply: [
      "Special Purpose Vehicles (SPVs) formed by at least 20 micro and small enterprises",
      "Industrial associations in packaging, electronics, machine tools, auto components, and plastics",
    ],
    eligibilityCriteria: [
      "SPV registered under Companies Act with at least 20 MSE members holding shares",
      "No single unit holding more than 10% equity in the SPV",
      "Detailed Project Report (DPR) appraised by SIDBI or state development corporation",
    ],
    howToApply: [
      "Submit online proposal on MSE-CDP portal (cluster.dcmsme.gov.in)",
      "State Government forwards proposal with recommendation and commitment of state share",
      "National Steering Committee (NSC) chaired by Secretary (MSME) sanctions funding",
    ],
    documentsRequired: [
      "SPV Certificate of Incorporation & Memorandum of Association",
      "List of participating MSEs with Udyam registration certificates",
      "DPR prepared by accredited agency with technical machinery details",
      "Land title document and state government matching fund commitment",
    ],
    targetBeneficiaries: ["msme"],
    categories: [
      "Prototyping & Product Development",
      "Packaging & Printing",
      "Compliance & Legal Support",
    ],
    industryKeywords: [
      "Clusters",
      "Common Facility Center",
      "Tooling",
      "Machinery",
      "Testing Lab",
      "Shared Infrastructure",
    ],
    stageKeywords: ["Traction", "Growth", "Scaling", "Micro", "Small"],
    procurementTriggers: [
      "Machinery",
      "Tooling",
      "Quality Testing",
      "Inspection",
    ],
    officialUrl: "https://cluster.dcmsme.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - Infrastructure & Cluster Development",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "Cluster Development Division, O/o DC-MSME, Nirman Bhawan, New Delhi",
    keyBenefits: [
      "Up to 80% non-repayable grant to build world-class testing and tooling facilities",
      "Enables small enterprises to use multi-crore CNC, SMT, and testing machinery at nominal cost",
      "Transforms local industrial estates into export-ready manufacturing hubs",
    ],
  },

  // ── 12. Ministry of MSME - International Cooperation Scheme ────────────────
  {
    id: "SCH-MSME-IC-29",
    name: "International Cooperation (IC) Scheme for MSME Market Expansion",
    shortName: "MSME International Cooperation",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "IC Section, Ministry of MSME",
    description:
      "Encourages MSMEs to explore international markets, participate in international exhibitions abroad, and host international conferences in India.",
    natureOfAssistance:
      "Reimbursement of 100% economy airfare (up to ₹1.5 Lakhs per entrepreneur) + stall charges reimbursement up to ₹3 Lakhs + freight/insurance subsidy for dispatching demonstration machinery samples abroad.",
    assistanceAmountMax:
      "Up to ₹4,50,000 per MSME for foreign trade delegations, sample shipping, and booths",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Udyam-registered Micro, Small, and Medium enterprises with manufacturing or service setups",
      "Industry associations organizing buyer-seller meets abroad",
    ],
    eligibilityCriteria: [
      "Active Udyam registration and valid PAN",
      "Regular export performance or intention to export certified by association",
      "No concurrent financial assistance availed from other ministries for the same event",
    ],
    howToApply: [
      "Apply online on MSME IC portal (ic.msme.gov.in) at least 60 days before the scheduled event",
      "Submit event brochure, sample shipping quotes, and airfare quotations",
      "Screening Committee evaluates and accords in-principle approval",
      "Submit reimbursement claim within 90 days after returning with proof of business meetings",
    ],
    documentsRequired: [
      "Udyam Registration Certificate",
      "Passport copy with relevant visa and travel boarding passes",
      "Stall rental receipt from foreign trade exhibition organizers",
      "Invoice of freight and sample dispatch with shipping bill",
    ],
    targetBeneficiaries: ["msme", "startup"],
    categories: ["Packaging & Printing", "Specialized Startup Support"],
    industryKeywords: [
      "International Fairs",
      "Exports",
      "Global Markets",
      "Trade Missions",
      "Samples",
    ],
    stageKeywords: ["Traction", "Growth", "Scaling", "Small", "Medium"],
    procurementTriggers: ["Packaging", "Certifications", "Inspection"],
    officialUrl: "https://ic.msme.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - International Marketing",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice:
      "International Cooperation Division, Ministry of MSME, Udyog Bhawan, New Delhi",
    keyBenefits: [
      "100% airfare reimbursement for international buyer meetings and trade shows",
      "Direct reimbursement of foreign exhibition booth and display expenses",
      "Subsidizes air shipping of heavy product samples and prototypes to overseas buyers",
    ],
  },

  // ── 13. Ministry of MSME - ASPIRE Scheme ────────────────────────────────────
  {
    id: "SCH-ASPIRE-30",
    name: "A Scheme for Promotion of Innovation, Rural Industries and Entrepreneurship (ASPIRE)",
    shortName: "ASPIRE Rural Incubation Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    department: "O/o Development Commissioner (DC-MSME)",
    description:
      "Promotes agro-rural innovation, sets up Livelihood Business Incubators (LBIs) and Technology Business Incubators (TBIs), and creates a Fund of Funds managed by SIDBI for rural startups.",
    natureOfAssistance:
      "100% financial grant up to ₹1 Crore for government-run LBIs (up to ₹50 Lakhs for private LBIs) for plant and machinery procurement. Up to ₹1 Crore for TBIs for prototyping infrastructure.",
    assistanceAmountMax:
      "Up to ₹1,00,00,000 (₹1 Crore) grant for plant, machinery, and incubation equipment",
    subsidyPercentMax: 100,
    whoCanApply: [
      "Technical institutions, universities, state government agencies, and agro-tech enterprises",
      "Startups and innovators working on agro-based automation, processing, packaging, and rural products",
    ],
    eligibilityCriteria: [
      "Focus on rural industrialization, value-added agro-products, or employment generation",
      "Incubation infrastructure setup with dedicated training and prototyping workshops",
    ],
    howToApply: [
      "Submit proposal to Ministry of MSME through the online ASPIRE portal (aspire.msme.gov.in)",
      "Detailed Project Report demonstrating rural business model and machinery requirements",
      "Scheme Steering Committee (SSC) approves grant-in-aid in milestone tranches",
    ],
    documentsRequired: [
      "Institutional registration documents / Udyam certificate",
      "Detailed Project Report (DPR) with machinery layout and training curriculum",
      "Bank mandate and audited balance sheets",
    ],
    targetBeneficiaries: ["startup", "msme"],
    categories: [
      "Prototyping & Product Development",
      "Packaging & Printing",
      "Specialized Startup Support",
    ],
    industryKeywords: [
      "Rural Entrepreneurship",
      "AgroTech",
      "Incubation",
      "Livelihood",
      "Machinery",
      "Vocational",
    ],
    stageKeywords: ["Idea", "Prototype", "MVP", "Early Revenue", "Micro"],
    procurementTriggers: ["Machinery", "Tooling", "Prototyping", "Packaging"],
    officialUrl: "https://aspire.msme.gov.in",
    sourceDocument: "ALL-MSME-SCHEMES-DETAILS-2.pdf",
    sourceChapter: "Ministry of MSME - ASPIRE Scheme",
    verificationStatus: "Source Verified - Verify Current Portal",
    contactOffice: "ASPIRE Cell, Ministry of MSME, Udyog Bhawan, New Delhi",
    keyBenefits: [
      "100% grant for purchasing machinery for skill centers and prototyping toolrooms",
      "Seed capital fund access through SIDBI for rural innovation startups",
      "Directly links rural manufacturing clusters to national e-commerce and retail supply chains",
    ],
  },
]

// ----------------------------------------------------------------------------
// EXPLAINABLE RELEVANCE MATCHING ALGORITHM
// (Heuristic match score calibrated against official criteria)
// ----------------------------------------------------------------------------
export function matchSchemesForProfile(
  profile: SchemeMatcherProfile,
  allSchemes: MpiScheme[] = MPI_GOV_SCHEMES,
): SchemeMatchResult[] {
  const results: SchemeMatchResult[] = allSchemes.map((scheme) => {
    let score = 25 // Base consideration score
    const reasons: string[] = []

    // 1. Beneficiary Type Fit (Startup vs MSME)
    const beneficiaryMatch = scheme.targetBeneficiaries.includes(
      profile.businessType,
    )
    if (beneficiaryMatch) {
      score += 20
      reasons.push(
        `Formulated specifically for ${
          profile.businessType === "startup"
            ? "Early-Stage Startups"
            : "Manufacturing MSMEs"
        }`,
      )
    } else {
      score -= 25
    }

    // 2. Category Fit (Overlapping procurement / supply domain)
    const matchedCategories = scheme.categories.filter((c) =>
      profile.categories.includes(c),
    )
    if (matchedCategories.length > 0) {
      score += 25
      reasons.push(
        `Directly covers your requirement category: ${matchedCategories.join(", ")}`,
      )
    }

    // 3. Stage Fit
    if (profile.businessType === "startup" && profile.stage) {
      if (scheme.stageKeywords.includes(profile.stage)) {
        score += 15
        reasons.push(
          `Tailored for your current startup maturity stage (${profile.stage})`,
        )
      }
    } else if (profile.businessType === "msme" && profile.enterpriseType) {
      if (scheme.stageKeywords.includes(profile.enterpriseType)) {
        score += 15
        reasons.push(
          `Matches statutory limits for ${profile.enterpriseType} Enterprises`,
        )
      }
    }

    // 4. Procurement Need Triggers (e.g. Packaging, Tooling, Patents, Quality)
    if (profile.procurementNeeds) {
      const lowerNeeds = profile.procurementNeeds.toLowerCase()
      const matchedTriggers = scheme.procurementTriggers.filter((trig) =>
        lowerNeeds.includes(trig.toLowerCase()),
      )
      if (matchedTriggers.length > 0) {
        score += 15
        reasons.push(
          `Matches specific procurement intent for ${matchedTriggers.join(" & ")}`,
        )
      }
    }

    // 5. Statutory Credentials
    if (
      profile.hasUdyam &&
      scheme.eligibilityCriteria.some((e) => e.toLowerCase().includes("udyam"))
    ) {
      score += 5
      reasons.push("Verified against your active Udyam Registration")
    }
    if (
      profile.hasDpiit &&
      scheme.eligibilityCriteria.some((e) => e.toLowerCase().includes("dpiit"))
    ) {
      score += 8
      reasons.push(
        "Leverages your DPIIT Recognized Startup status for expedited processing",
      )
    }
    if (
      profile.isWomenOrScSt &&
      (scheme.name.includes("Stand-Up") ||
        scheme.natureOfAssistance.includes("Women") ||
        scheme.natureOfAssistance.includes("85%"))
    ) {
      score += 10
      reasons.push(
        "Unlocks special priority subsidy tiers (up to 85% coverage for Women/SC/ST enterprises)",
      )
    }

    // Clamp score
    const finalScore = Math.min(99, Math.max(15, score))

    // Determine Tier
    let matchTier: SchemeMatchResult["matchTier"] = "Potential Match"
    if (finalScore >= 85) matchTier = "Exceptional Fit"
    else if (finalScore >= 70) matchTier = "High Fit"
    else if (finalScore >= 50) matchTier = "Moderate Fit"

    // Savings estimate phrasing
    let savingsPhrasing = scheme.assistanceAmountMax
    if (scheme.subsidyPercentMax) {
      savingsPhrasing = `${scheme.subsidyPercentMax}% Subsidy (${scheme.assistanceAmountMax})`
    }

    const recommendedAction =
      finalScore >= 75
        ? "Bundle with your current MPI RFQ to claim statutory subsidy during vendor checkout"
        : "Review scheme guidelines and prepare statutory documentation for next funding batch"

    return {
      scheme,
      relevanceScore: finalScore,
      matchTier,
      matchReasons:
        reasons.length > 0
          ? reasons
          : [
              "General institutional alignment with central manufacturing guidelines",
            ],
      procurementSavingsPotential: savingsPhrasing,
      recommendedAction,
    }
  })

  // Sort descending by relevance score
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
}
