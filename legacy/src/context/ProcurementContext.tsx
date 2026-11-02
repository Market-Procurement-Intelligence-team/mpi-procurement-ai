import React, { createContext, useContext, useState, useMemo, useEffect } from "react"
import { CatalogCategory, CATALOG_CATEGORIES } from "../lib/mpiCatalog"
import { extractProcurementSpecsWithAI, type ExtractedProcurementSpecs } from "../services/aiService"
import {
  MpiScheme,
  MPI_GOV_SCHEMES,
  SchemeMatcherProfile,
  SchemeMatchResult,
  matchSchemesForProfile,
} from "../data/mpiSchemesData"
import {
  checkDatabaseHealth,
  persistRFQToSupabase,
  persistQuoteToSupabase,
  fetchQuotesForRFQFromSupabase,
  fetchDispatchedRFQsFromSupabase,
  fetchBuyerActiveRFQFromSupabase,
  type BackendSyncState,
} from "../services/procurementDatabaseService"
import { getActiveUser } from "../lib/mockAuth"
import { trackTelemetryEvent } from "../services/telemetryService"

// ----------------------------------------------------------------------------
// Business Onboarding Profile Models
// ----------------------------------------------------------------------------
export interface StartupBusinessProfile {
  founderName: string
  startupName: string
  email: string
  phone?: string
  city: string
  state: string
  stage: "Idea" | "Prototype" | "MVP" | "Early Revenue" | "Traction" | "Growth" | "Scaling"
  productsSold: string
  industry: string
  procurementCategories: CatalogCategory[]
  procurementSubcategories: string[]
  procurementDescription: string
  annualProcurementBudget: number
  turnaroundPriority: "Standard" | "Urgent (<10 days)" | "Cost Priority"
  fundingStage: "Bootstrapped" | "Angel / Pre-Seed" | "Seed" | "Series A+"
  hasDpiit: boolean
  dpiitNumber?: string
  teamSize: string
  governmentInterests: string[]
  createdAt: string
}

export interface MSMEBusinessProfile {
  enterpriseName: string
  contactPerson: string
  email: string
  phone: string
  city: string
  state: string
  enterpriseType: "Micro" | "Small" | "Medium"
  udyamNumber: string
  gstNumber: string
  panNumber: string
  factoryAddress: string
  supplyCategories: CatalogCategory[]
  primaryMachinery: string[]
  monthlyCapacity: string
  capacityUtilization: number // percentage
  certifications: string[] // ISO 9001, ZED Gold, etc.
  moqStandard: number
  standardPaymentTerms: string
  qualityTestingFacilities: string[]
  leadTimeDays: number
  panIndiaDispatch: boolean
  schemesUtilized: string[]
  verificationStatus: "Pending Audit" | "Verified" | "Under Review"
  createdAt: string
}

// ----------------------------------------------------------------------------
// Supplier Sample Request Workflow Models (8 Lifecycle States)
// ----------------------------------------------------------------------------
export type SampleLifecycleStatus = "Requested" | "Accepted" | "Preparing" | "Dispatched" | "Delivered" | "Under Review" | "Approved" | "Rejected"

export interface SampleRequest {
  id: string // e.g. 'SMP-2026-001'
  supplierId: string // e.g. 'SUP-001'
  supplierDisplayName: string // 'MPI Verified Supplier #001'
  productTitle: string
  category: CatalogCategory
  sampleQuantity: number // 1 to 5 units
  specifications: string
  targetDeliveryDate: string
  shippingAddress: string
  contactPhone: string
  status: SampleLifecycleStatus
  sampleCost: number // e.g. 0 (Free) or nominal refundable deposit
  trackingNumber?: string
  carrierName?: string
  dispatchedDate?: string
  deliveredDate?: string
  qualityRating?: number // 1 to 5
  dimensionPass?: boolean
  finishPass?: boolean
  durabilityPass?: boolean
  evaluationNotes?: string
  decisionReason?: string
  createdAt: string
  convertedToRfqId?: string
}

// ----------------------------------------------------------------------------
// Repeat Customer Intelligence Model for MSME Quotation Builder
// ----------------------------------------------------------------------------
export interface RepeatCustomerProfile {
  buyerId: string
  displayName: string // 'MPI Verified Buyer #042'
  tier: "Gold Preferred Buyer" | "Platinum Institutional Buyer" | "Silver Verified Buyer"
  ordersCompleted: number
  totalOrderValue: number
  onTimePaymentRate: number
  disputeCount: number
  lastOrderDate: string
  favoriteCategory: CatalogCategory
  recommendedDiscountPercent: number
}

// ----------------------------------------------------------------------------
// Full Internal Supplier Model (used by Admin & Supplier Portal)
// ----------------------------------------------------------------------------
export interface MatchedSupplier {
  id: string // e.g. 'SUP-001'
  name: string // Real registered name (Admin/MSME only)
  category: CatalogCategory
  state: string
  city: string
  matchScore: number
  verificationStatus: "Verified" | "Under Review" | "Pending" | "Rejected" | "Needs Information"
  udyamNumber: string
  gstNumber: string
  leadTime: string
  priceRating: "₹" | "₹₹" | "₹₹₹"
  unitPriceEstimate: number
  moq: number
  certifications: string[]
  capabilities: string[]
  machinery: string[]
  capacityPerMonth: string
  verifiedBadgeDate: string
  contactPerson: string
  phone: string
  email: string
}

// ----------------------------------------------------------------------------
// Public Supplier Projection for Startups (Strict Privacy Protocol)
// Company name, phone, email, and private contact are strictly stripped.
// ----------------------------------------------------------------------------
export interface PublicStartupSupplier {
  id: string // 'SUP-001'
  displayName: string // 'MPI Verified Supplier #001'
  category: CatalogCategory
  city: string
  state: string
  matchScore: number
  verificationStatus: "Verified" | "Under Review" | "Pending" | "Rejected"
  moq: string
  leadTime: string
  priceRating: "₹" | "₹₹" | "₹₹₹"
  unitPriceEstimate: number
  certifications: string[]
  capabilities: string[]
  machinery: string[]
  capacityPerMonth: string
  verifiedBadgeDate: string
}

export interface SupplierQuote {
  id: string
  supplierId: string
  supplierName: string // Internal name
  totalAmount: number
  breakdown: {
    baseToolingOrSetup: number
    unitManufacturing: number
    qualityTesting: number
    logisticsAndPackaging: number
    gstAmount: number
  }
  deliveryDays: number
  terms: string
  schemeSubsidyApplied: number
  finalLandedCost: number
  scoreBreakdown: {
    priceCompetitiveness: number // 0-100
    qualityAssurance: number // 0-100
    leadTimeFeasibility: number // 0-100
    complianceScore: number // 0-100
  }
  recommendationReason: string
}

// ----------------------------------------------------------------------------
// Public Startup Quote with Defined Baseline & Landed Savings
// ----------------------------------------------------------------------------
export interface PublicStartupQuote {
  id: string
  supplierId: string
  supplierDisplayName: string // 'MPI Verified Supplier #001'
  quotedTotal: number
  baselineCost: number // Clearly defined market baseline: ₹85,000
  totalSavings: number // baselineCost - finalLandedCost
  savingsPercent: number // % saved against baseline
  estimatedTimeSaved: string // e.g. '8 business days' / '16 hours'
  unitPrice: number
  moq: number
  breakdown: {
    baseToolingOrSetup: number
    unitManufacturing: number
    qualityTesting: number
    logisticsAndPackaging: number
    gstAmount: number
  }
  deliveryDays: number
  terms: string
  schemeSubsidyApplied: number
  finalLandedCost: number
  qualityScore: number
  certifications: string[]
  quoteValidity: string
  badges: Array<"Lowest Price" | "Best Value" | "Fastest Delivery" | "Highest Savings" | "Standard QA">
  recommendationReason: string
}

// ----------------------------------------------------------------------------
// MSME-Facing RFQ with Buyer Privacy
// Startup name is strictly anonymized to 'MPI Verified Buyer'
// ----------------------------------------------------------------------------
export interface PublicMSMERFQ {
  id: string
  title: string
  buyerDisplayName: string // 'MPI Verified Buyer' or 'MPI Verified Buyer #042'
  category: CatalogCategory
  quantity: number
  targetBudget: number
  deliveryDate: string
  specs: string
  status: "Open for Bidding" | "Under Review" | "Quoted" | "PO Issued"
  postedTime: string
  matchScore: number
}

export interface RFQDetails {
  id: string
  title: string
  category: CatalogCategory
  quantity: number
  targetBudget: number
  deliveryDate: string
  specifications: string[]
  dispatchedToSupplierIds: string[]
  createdDate: string
  status: "Draft" | "Dispatched" | "Quotes Received" | "Evaluation Complete" | "PO Issued"
}

export interface GovScheme {
  id: string
  title: string
  ministry: string
  subsidyPercentage: number
  maxBenefit: string
  eligibility: string
  applicableCategories: CatalogCategory[]
  applicationStatus: "Eligible" | "Applied" | "Approved" | "Disbursed"
}

// ----------------------------------------------------------------------------
// Demo Management Models for Admin Operations Center
// ----------------------------------------------------------------------------
export interface DemoStartupRecord {
  id: string
  name: string
  industry: string
  city: string
  state: string
  stage: "Seed" | "Pre-Series A" | "Series A" | "Series B" | "Bootstrapped"
  registrationStatus: "DPIIT Registered" | "Under Verification" | "Pending"
  rfqsCount: number
  ordersCount: number
  procurementValue: number
  auditStatus: "Verified" | "Pending Audit" | "Under Review" | "Needs Information"
  joinedDate: string
}

export interface DemoMSMERecord {
  id: string
  name: string
  category: CatalogCategory
  city: string
  state: string
  udyamNumber: string
  verificationStatus: "Verified" | "Pending Audit" | "Under Review" | "Needs Information" | "Suspended"
  rfqsCount: number
  quotesCount: number
  ordersCount: number
  fulfillmentRate: number
  revenue: number
  auditStatus: "Verified" | "Pending Audit" | "Under Review" | "Needs Information" | "Suspended"
}

export interface SourcingHistoryEvent {
  id: string
  request: string
  category: CatalogCategory
  date: string
  rfqStatus: "Completed" | "PO Issued" | "In Progress" | "Closed"
  quotesCount: number
  savingsAmount: number
  timeSaved: string
  orderStatus: "Delivered" | "In Production" | "QC Inspection" | "Settled"
  supplierDisplayName: string // 'MPI Verified Supplier #001'
  insights: {
    costInsight: string
    savingsNote: string
    quoteSpread: string
    supplierCompetition: string
    categoryInsight: string
    procurementRecommendation: string
  }
}

export interface OrderItem {
  id: string
  requirement: string
  category: CatalogCategory
  supplierDisplayName: string // 'MPI Verified Supplier #001'
  realSupplierName?: string // Admin only
  buyerDisplayName?: string // MSME only
  orderValue: number
  status: "In Production" | "QC Pass" | "In Transit" | "Delivered" | "Pending PO"
  createdDate: string
  expectedDelivery: string
  savings: number
}

export interface ProcurementContextType {
  // Requirement intake & specs
  requirementText: string
  setRequirementText: (text: string) => void
  selectedCategory: CatalogCategory
  setSelectedCategory: (cat: CatalogCategory) => void
  quantity: number
  setQuantity: (qty: number) => void
  targetBudget: number
  setTargetBudget: (budget: number) => void
  deliveryLocation: string
  setDeliveryLocation: (loc: string) => void
  deadlineDate: string
  setDeadlineDate: (date: string) => void
  specifications: string[]
  setSpecifications: (specs: string[]) => void
  addSpecification: (spec: string) => void
  removeSpecification: (index: number) => void

  // AI Extraction & Sourcing
  isExtractingSpecs: boolean
  runAIExtraction: (customText?: string) => Promise<ExtractedProcurementSpecs | null>
  aiConfidenceScore: number
  aiSuggestedKeywords: string[]

  // Suppliers & Privacy Projections
  matchedSuppliers: MatchedSupplier[]
  publicStartupSuppliers: PublicStartupSupplier[]
  shortlistedSupplierIds: string[]
  toggleShortlistSupplier: (id: string) => void
  activeRFQ: RFQDetails | null
  createAndDispatchRFQ: (supplierIds?: string[]) => void

  // Quotes & Comparison Matrix
  receivedQuotes: SupplierQuote[]
  publicStartupQuotes: PublicStartupQuote[]
  selectedQuoteId: string | null
  selectQuote: (quoteId: string) => void
  submitMSMEQuote: (quote: SupplierQuote, targetRfqId?: string) => void
  loadDemoQuotes: () => void

  // Backend Database Synchronization Status
  backendSyncState: BackendSyncState
  refreshBackendSync: () => Promise<void>
  rfqPersistenceStatus: "idle" | "saving" | "saved_to_supabase" | "saved_locally"
  rfqPersistenceError?: string
  quotePersistenceStatus: "idle" | "saving" | "saved_to_supabase" | "saved_locally"
  quotePersistenceError?: string

  // Order Lifecycle
  currentMilestone: number
  advanceMilestone: () => void
  setMilestone: (index: number) => void

  // Government Schemes Intelligence
  schemes: GovScheme[]
  mpiSchemes: MpiScheme[]
  matchSchemes: (profile: SchemeMatcherProfile) => SchemeMatchResult[]
  getSchemeById: (id: string) => MpiScheme | undefined

  // Business Onboarding Profiles
  startupProfile: StartupBusinessProfile
  updateStartupProfile: (profile: Partial<StartupBusinessProfile>) => void
  msmeProfile: MSMEBusinessProfile
  updateMSMEProfile: (profile: Partial<MSMEBusinessProfile>) => void

  // Supplier Sample Request Workflow (8 Lifecycle States)
  sampleRequests: SampleRequest[]
  requestSample: (
    req: Omit<SampleRequest, "id" | "createdAt" | "status">,
  ) => SampleRequest
  updateSampleStatus: (
    id: string,
    status: SampleLifecycleStatus,
    extra?: Partial<SampleRequest>,
  ) => void
  approveSampleAndProceedToRFQ: (sampleId: string) => void

  // Repeat Customer Intelligence for MSME Quotation Builder
  repeatCustomerData: RepeatCustomerProfile

  // History & Orders
  sourcingHistory: SourcingHistoryEvent[]
  ordersList: OrderItem[]
  MARKET_BASELINE_COST: number

  // MSME RFQs with Buyer Privacy
  msmeRFQs: PublicMSMERFQ[]

  // Admin Ecosystem Demo Data
  demoStartups: DemoStartupRecord[]
  demoMSMEs: DemoMSMERecord[]
  updateStartupAuditStatus: (
    id: string,
    status: DemoStartupRecord["auditStatus"],
  ) => void
  updateMSMEAuditStatus: (
    id: string,
    status: DemoMSMERecord["auditStatus"],
  ) => void
  updateSupplierVerificationStatus: (
    supplierId: string,
    status: MatchedSupplier["verificationStatus"],
    notes?: string,
  ) => void

  // Reset
  resetToSampleData: () => void
}

const DEFAULT_SPECS = [
  "Rigid book-style 1200 GSM kappa board construction",
  "157 GSM art paper wrap with matte scuff-free lamination",
  "Custom laser-cut EVA foam insert contoured for 3 skincare bottles",
  "FSC-certified paper stock with soy-based vegetable inks",
  "Drop-test certified ISTA-1A drop test compliant",
]

const INITIAL_SUPPLIERS: MatchedSupplier[] = [
  {
    id: "SUP-001",
    name: "Apex Precision Packaging Ltd.",
    category: "Packaging & Printing",
    state: "Maharashtra",
    city: "Pune",
    matchScore: 97,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-MH-12-0048192",
    gstNumber: "27AAACA9921B1ZM",
    leadTime: "12 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 110,
    moq: 500,
    certifications: [
      "ISO 9001:2015",
      "FSC Forest Chain of Custody",
      "ZED Gold",
    ],
    capabilities: [
      "Rigid Box Auto-Forming",
      "Hot Foil Stamping",
      "UV Spot Coater",
      "Die Cutting",
    ],
    machinery: [
      "Heidelberg 6-Color Offset Press",
      "Kolbus Automatic Box Maker",
      "Bobst Foil Stamper",
    ],
    capacityPerMonth: "85,000 units/mo (32% available)",
    verifiedBadgeDate: "12 Jan 2026",
    contactPerson: "Vikram Joshi (VP Operations)",
    phone: "+91 98220 44102",
    email: "v.joshi@apexpackaging.in",
  },
  {
    id: "SUP-002",
    name: "Suryavanshi Prints & Polymers",
    category: "Packaging & Printing",
    state: "Gujarat",
    city: "Ahmedabad",
    matchScore: 92,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-GJ-01-0031948",
    gstNumber: "24AABCS4819E1Z8",
    leadTime: "15 business days",
    priceRating: "₹",
    unitPriceEstimate: 100,
    moq: 500,
    certifications: ["ISO 9001:2015", "MSME Udyam Verified"],
    capabilities: [
      "Corrugated & Rigid Boxes",
      "Custom Inserts",
      "Silkscreen Printing",
    ],
    machinery: [
      "Komori Lithrone 5-Color",
      "Semi-automatic Rigid Box Line",
      "Zund Digital Cutter",
    ],
    capacityPerMonth: "50,000 units/mo (45% available)",
    verifiedBadgeDate: "04 Feb 2026",
    contactPerson: "Mehul Patel (Director)",
    phone: "+91 97140 22390",
    email: "mpatel@suryavanshiprints.com",
  },
  {
    id: "SUP-003",
    name: "Kaizen Prototyping & Pack Hub",
    category: "Packaging & Printing",
    state: "Karnataka",
    city: "Bengaluru",
    matchScore: 88,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-KR-03-0092147",
    gstNumber: "29AACCK1829L1ZW",
    leadTime: "8 business days",
    priceRating: "₹₹₹",
    unitPriceEstimate: 124,
    moq: 200,
    certifications: ["ISO 9001:2015", "ISO 14001", "EcoVadis Bronze"],
    capabilities: [
      "High-speed Box Folding",
      "Eco-friendly Kraft & Pulp",
      "Rapid Mockups",
    ],
    machinery: ["HP Indigo 12000 Digital Press", "Emmeci Automatic Rigid Line"],
    capacityPerMonth: "120,000 units/mo (18% available)",
    verifiedBadgeDate: "18 Nov 2025",
    contactPerson: "Ananya Rao (Procurement Lead)",
    phone: "+91 98450 11982",
    email: "ananya@kaizenpack.co",
  },
  {
    id: "SUP-004",
    name: "Delta Craft Containers",
    category: "Packaging & Printing",
    state: "Tamil Nadu",
    city: "Coimbatore",
    matchScore: 81,
    verificationStatus: "Under Review",
    udyamNumber: "UDYAM-TN-02-0056112",
    gstNumber: "33AABCD9012F1ZZ",
    leadTime: "18 business days",
    priceRating: "₹",
    unitPriceEstimate: 95,
    moq: 1000,
    certifications: ["MSME Udyam Verified"],
    capabilities: [
      "Corrugated Cartons",
      "Mono-carton printing",
      "Offset Lamination",
    ],
    machinery: ["Manroland 4-Color", "Rotary Die Cutters"],
    capacityPerMonth: "40,000 units/mo (60% available)",
    verifiedBadgeDate: "Pending Audit",
    contactPerson: "Senthil Kumar (Factory Mgr)",
    phone: "+91 94430 88219",
    email: "senthil@deltacraft.in",
  },
  {
    id: "SUP-005",
    name: "Bharat Tech Innovators Labs",
    category: "Prototyping & Product Development",
    state: "Karnataka",
    city: "Bengaluru",
    matchScore: 95,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-KR-03-0182390",
    gstNumber: "29AABCB1092Q1ZV",
    leadTime: "7 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 3200,
    moq: 10,
    certifications: ["ISO 9001:2015", "ZED Diamond"],
    capabilities: [
      "SLS & SLA 3D Printing",
      "5-Axis CNC Milling",
      "PCB Quick Turn",
    ],
    machinery: ["EOS Formiga P110", "Haas VF-2SS CNC", "Manncorp SMT Line"],
    capacityPerMonth: "800 prototyping runs/mo",
    verifiedBadgeDate: "09 Jan 2026",
    contactPerson: "Rahul Sen (CTO)",
    phone: "+91 98451 90021",
    email: "rahul@bharattechinnovators.com",
  },
  {
    id: "SUP-006",
    name: "LexCorp Legal & Compliance Tech",
    category: "Compliance & Legal Support",
    state: "Delhi NCR",
    city: "Gurugram",
    matchScore: 98,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-HR-04-0019284",
    gstNumber: "06AACCL9102K1ZP",
    leadTime: "3 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 12000,
    moq: 1,
    certifications: ["Bar Council of India Verified", "ISO 27001 Security"],
    capabilities: [
      "ROC Filings",
      "Patent Drafting",
      "Udyam & MSME Structuring",
      "GST Audits",
    ],
    machinery: ["Proprietary AI Compliance Engine"],
    capacityPerMonth: "250 client audits/mo",
    verifiedBadgeDate: "15 Dec 2025",
    contactPerson: "Adv. Neha Sharma",
    phone: "+91 98110 55192",
    email: "neha@lexcorplegal.in",
  },
  {
    id: "SUP-007",
    name: "CloudMatrix Enterprise Solutions",
    category: "IT & Digital Services",
    state: "Karnataka",
    city: "Bengaluru",
    matchScore: 98,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-KR-03-0294819",
    gstNumber: "29AABCC4819M1ZS",
    leadTime: "10 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 45000,
    moq: 1,
    certifications: ["ISO 27001:2022", "SOC2 Type II", "CMMI Level 3"],
    capabilities: [
      "Next.js 15 & TypeScript Web Engineering",
      "Enterprise Cloud Database Architecture with RLS",
      "Custom ERP & Inventory Pipeline Deployment",
      "Secure REST / GraphQL API Gateways",
    ],
    machinery: ["Multi-Zone High-Availability Cloud Infrastructure", "Automated CI/CD DevOps Pipeline"],
    capacityPerMonth: "40 software sprint deployments/mo",
    verifiedBadgeDate: "14 Jan 2026",
    contactPerson: "Arjun Nambiar (VP Technology)",
    phone: "+91 98860 14920",
    email: "arjun@cloudmatrix.dev",
  },
  {
    id: "SUP-008",
    name: "CodeSprint Enterprise Labs",
    category: "IT & Digital Services",
    state: "Telangana",
    city: "Hyderabad",
    matchScore: 94,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-TS-09-0018471",
    gstNumber: "36AACCS1920D1ZR",
    leadTime: "14 business days",
    priceRating: "₹",
    unitPriceEstimate: 38000,
    moq: 1,
    certifications: ["ISO 9001:2015", "DPIIT Recognized Startup Partner"],
    capabilities: [
      "Custom Dashboard & Portal Development",
      "Payment Gateway Integration (Razorpay Escrow)",
      "Database Schema Migration & Tuning",
      "Cross-Platform Flutter & React Native",
    ],
    machinery: ["Dedicated Cloud Staging Clusters", "SonarQube Automated Security Scanner"],
    capacityPerMonth: "25 client sprint cycles/mo",
    verifiedBadgeDate: "20 Jan 2026",
    contactPerson: "Priya Varma (Head of Delivery)",
    phone: "+91 97010 33819",
    email: "priya@codesprintlabs.io",
  },
  {
    id: "SUP-009",
    name: "GrowthCraft Digital & Performance Media",
    category: "Marketing & Sales Support",
    state: "Maharashtra",
    city: "Mumbai",
    matchScore: 96,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-MH-19-0038192",
    gstNumber: "27AABCG8192A1ZL",
    leadTime: "7 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 25000,
    moq: 1,
    certifications: ["Google Premier Partner", "Meta Certified Media Agency", "MSME Udyam Verified"],
    capabilities: [
      "D2C Performance Marketing & RoAS Scale",
      "Brand Positioning & Product Packaging Design",
      "Omnichannel Amazon & Quick Commerce Listing",
      "Performance Creative Video Production",
    ],
    machinery: ["In-House 4K Studio & Lighting Rig", "Predictive Analytics Ad Ledger"],
    capacityPerMonth: "60 brand campaigns/mo",
    verifiedBadgeDate: "10 Feb 2026",
    contactPerson: "Kunal Mehra (Managing Director)",
    phone: "+91 98200 77192",
    email: "kunal@growthcraftmedia.in",
  },
  {
    id: "SUP-010",
    name: "Apex Creative & Omnichannel Agency",
    category: "Marketing & Sales Support",
    state: "Delhi NCR",
    city: "Gurugram",
    matchScore: 91,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-HR-04-0029184",
    gstNumber: "06AACCA1092F1ZK",
    leadTime: "10 business days",
    priceRating: "₹",
    unitPriceEstimate: 18000,
    moq: 1,
    certifications: ["ISO 9001:2015", "MSME Udyam Verified"],
    capabilities: [
      "Brand Collateral & High-Conversion Copy",
      "Packaging Artwork & Die-Line Finalization",
      "Market Research & Buyer Persona Audits",
      "Social Media Growth Strategy",
    ],
    machinery: ["Adobe Enterprise Cloud Suite", "Color Calibrated Proofing Monitors"],
    capacityPerMonth: "45 creative mandates/mo",
    verifiedBadgeDate: "28 Jan 2026",
    contactPerson: "Rohit Bansal (Creative Director)",
    phone: "+91 98100 22910",
    email: "rohit@apexcreative.agency",
  },
  {
    id: "SUP-011",
    name: "FinVenture Advisory & Chartered Accountants",
    category: "Business & Finance Services",
    state: "Karnataka",
    city: "Bengaluru",
    matchScore: 97,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-KR-03-0091823",
    gstNumber: "29AABCF9182C1ZF",
    leadTime: "5 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 35000,
    moq: 1,
    certifications: ["ICAI Chartered Accountant Practice", "Peer Reviewed Firm", "ISO 27001"],
    capabilities: [
      "Fractional CFO & 5-Year Financial Modeling",
      "Institutional Investor Due Diligence Readiness",
      "Statutory Valuation (DCF & Net Asset Value)",
      "Cap Table & ESOP Trust Structuring",
    ],
    machinery: ["Proprietary Valuation & Waterfall Engine", "Encrypted Document Vault"],
    capacityPerMonth: "50 corporate advisory mandates/mo",
    verifiedBadgeDate: "05 Jan 2026",
    contactPerson: "CA Deepak Singhal (Senior Partner)",
    phone: "+91 98450 66291",
    email: "deepak@finventureadvisory.com",
  },
  {
    id: "SUP-012",
    name: "Bharat Tax & Audit Partners",
    category: "Business & Finance Services",
    state: "Gujarat",
    city: "Ahmedabad",
    matchScore: 92,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-GJ-01-0081928",
    gstNumber: "24AABCB8192G1ZM",
    leadTime: "7 business days",
    priceRating: "₹",
    unitPriceEstimate: 22000,
    moq: 1,
    certifications: ["ICAI Member Firm", "MSME Samadhaan Facilitator"],
    capabilities: [
      "MSME 45-Day Payment Recovery (Samadhaan)",
      "GST Multi-State Input Tax Credit Reconciliation",
      "Corporate Income Tax & Transfer Pricing",
      "Internal Controls & Anti-Fraud Financial Audit",
    ],
    machinery: ["Automated Tally Prime / SAP Connectors", "GST E-Invoice Reconciliation System"],
    capacityPerMonth: "80 business compliance filings/mo",
    verifiedBadgeDate: "19 Jan 2026",
    contactPerson: "CA Bhavin Shah (Managing Partner)",
    phone: "+91 98250 44910",
    email: "bhavin@bharattaxpartners.in",
  },
  {
    id: "SUP-013",
    name: "StartupCatalyst Incubator & Scale Hub",
    category: "Specialized Startup Support",
    state: "Delhi NCR",
    city: "Noida",
    matchScore: 98,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-UP-28-0029182",
    gstNumber: "09AABCS9182H1ZY",
    leadTime: "4 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 30000,
    moq: 1,
    certifications: ["DPIIT Recognized Incubator Network", "MSME Innovation Scheme Partner"],
    capabilities: [
      "DPIIT Tax Exemption (80-IAC) & IMB Clearance",
      "SISFS Seed Fund Grant Application Strategy (up to ₹20L)",
      "Corporate Pilot Validation & POC Structuring",
      "Government Procurement (GeM Portal) Onboarding",
    ],
    machinery: ["Central GeM & DPIIT Fast-Track Gateway"],
    capacityPerMonth: "35 startup scale cohorts/mo",
    verifiedBadgeDate: "11 Jan 2026",
    contactPerson: "Dr. Sandeep Kulkarni (Program Director)",
    phone: "+91 98180 33819",
    email: "sandeep@startupcatalyst.org.in",
  },
  {
    id: "SUP-014",
    name: "Vector Dynamics Precision Engineering",
    category: "Prototyping & Product Development",
    state: "Maharashtra",
    city: "Pune",
    matchScore: 96,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-MH-26-0048192",
    gstNumber: "27AABCV8192M1ZQ",
    leadTime: "6 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 4500,
    moq: 5,
    certifications: ["ISO 9001:2015", "AS9100D Aerospace Certified", "ZED Gold"],
    capabilities: [
      "5-Axis CNC Milling (6061-T6 Aluminum, Stainless Steel)",
      "CMM Coordinate Measuring Machine (±0.005mm Tolerance)",
      "Anodizing, Bead Blasting & Hard Coating",
      "Drone Chassis & Drone Gimbal Prototype Assemblies",
    ],
    machinery: ["DMG MORI 5-Axis Machining Center", "Zeiss CMM Inspection Unit"],
    capacityPerMonth: "1,200 precision machined components/mo",
    verifiedBadgeDate: "02 Feb 2026",
    contactPerson: "Ajay Kulkarni (Lead Metallurgist)",
    phone: "+91 98220 88192",
    email: "ajay@vectordynamics.co.in",
  },
  {
    id: "SUP-015",
    name: "JurisTrust Corporate Attorneys",
    category: "Compliance & Legal Support",
    state: "Delhi NCR",
    city: "New Delhi",
    matchScore: 97,
    verificationStatus: "Verified",
    udyamNumber: "UDYAM-DL-08-0019283",
    gstNumber: "07AABCJ9182L1ZV",
    leadTime: "3 business days",
    priceRating: "₹₹",
    unitPriceEstimate: 20000,
    moq: 1,
    certifications: ["Bar Council of India Recognized", "Registered Patent Agent (IN/PA)"],
    capabilities: [
      "Provisional & Complete Patent Specification Drafting",
      "Dual-Class Trademark Registration & Cease-and-Desist Defense",
      "Founders Agreement & IP Assignment Schedules",
      "Vendor Sourcing & Milestone Escrow Legal Agreements",
    ],
    machinery: ["Global Patent Prior-Art Search Terminals"],
    capacityPerMonth: "120 IP filings & corporate agreements/mo",
    verifiedBadgeDate: "22 Jan 2026",
    contactPerson: "Adv. Sunita Rao (Managing Counsel)",
    phone: "+91 98110 99481",
    email: "sunita@juristrustlegal.com",
  },
]

// Baseline Market Benchmark Cost: ₹85,000 for 500 custom rigid printed boxes
export const MARKET_BASELINE_COST = 85000

const INITIAL_QUOTES: SupplierQuote[] = [
  {
    id: "QTE-001",
    supplierId: "SUP-001",
    supplierName: "Apex Precision Packaging Ltd.",
    totalAmount: 72500,
    breakdown: {
      baseToolingOrSetup: 6000,
      unitManufacturing: 55000, // 500 units * ₹110
      qualityTesting: 2500,
      logisticsAndPackaging: 3500,
      gstAmount: 5500,
    },
    deliveryDays: 12,
    terms:
      "30% Advance, 70% against delivery dispatch inspection. 100% Quality Replacement guarantee.",
    schemeSubsidyApplied: 7250, // Distinct ZED Gold MSME packaging subsidy eligibility assessment
    finalLandedCost: 72500, // Payable commercial invoice (not reduced by grant)
    scoreBreakdown: {
      priceCompetitiveness: 94,
      qualityAssurance: 98,
      leadTimeFeasibility: 96,
      complianceScore: 99,
    },
    recommendationReason:
      "Good Tier: Balanced standard specification fabrication with solid quality score (98%) and certified FSC paper.",
  },
  {
    id: "QTE-002",
    supplierId: "SUP-002",
    supplierName: "Suryavanshi Prints & Polymers",
    totalAmount: 65000,
    breakdown: {
      baseToolingOrSetup: 4500,
      unitManufacturing: 50000, // 500 units * ₹100
      qualityTesting: 2000,
      logisticsAndPackaging: 4000,
      gstAmount: 4500,
    },
    deliveryDays: 14,
    terms:
      "40% Advance, 60% on Bill of Lading. Includes free sample batch run.",
    schemeSubsidyApplied: 3250,
    finalLandedCost: 65000,
    scoreBreakdown: {
      priceCompetitiveness: 99,
      qualityAssurance: 92,
      leadTimeFeasibility: 88,
      complianceScore: 92,
    },
    recommendationReason:
      "Better Tier (Recommended): Optimal price-to-performance sweet spot with direct factory pricing, high value yield and full statutory compliance.",
  },
  {
    id: "QTE-003",
    supplierId: "SUP-003",
    supplierName: "Kaizen Prototyping & Pack Hub",
    totalAmount: 82500,
    breakdown: {
      baseToolingOrSetup: 7500,
      unitManufacturing: 62000,
      qualityTesting: 4000,
      logisticsAndPackaging: 3000,
      gstAmount: 6000,
    },
    deliveryDays: 6,
    terms: "50% Advance, 50% post-delivery 15 days credit period.",
    schemeSubsidyApplied: 4125,
    finalLandedCost: 82500,
    scoreBreakdown: {
      priceCompetitiveness: 82,
      qualityAssurance: 99,
      leadTimeFeasibility: 99,
      complianceScore: 97,
    },
    recommendationReason:
      "Best Tier: Premium rapid turnaround (6 business days) with dedicated project engineering and expedited fulfillment.",
  },
  {
    id: "QTE-004",
    supplierId: "SUP-004",
    supplierName: "Delta Craft Containers",
    totalAmount: 61000,
    breakdown: {
      baseToolingOrSetup: 3500,
      unitManufacturing: 47500,
      qualityTesting: 1500,
      logisticsAndPackaging: 5000,
      gstAmount: 3500,
    },
    deliveryDays: 18,
    terms: "50% Advance, 50% prior to dispatch.",
    schemeSubsidyApplied: 0,
    finalLandedCost: 61000,
    scoreBreakdown: {
      priceCompetitiveness: 98,
      qualityAssurance: 78,
      leadTimeFeasibility: 75,
      complianceScore: 79,
    },
    recommendationReason:
      "Low price candidate, but supplier audit is currently Under Review with unverified drop-test certifications.",
  },
]

const INITIAL_SCHEMES: GovScheme[] = [
  {
    id: "SCH-01",
    title: "ZED Certification Quality Reimbursement",
    ministry: "Ministry of MSME, Govt. of India",
    subsidyPercentage: 80,
    maxBenefit: "Up to ₹5,00,000 per manufacturing facility",
    eligibility:
      "Udyam-registered startups and MSMEs adopting Zero Defect Zero Effect manufacturing",
    applicableCategories: [
      "Packaging & Printing",
      "Prototyping & Product Development",
    ],
    applicationStatus: "Eligible",
  },
  {
    id: "SCH-02",
    title: "Design Clinic Sourcing Assistance Scheme",
    ministry: "Ministry of Micro, Small and Medium Enterprises",
    subsidyPercentage: 60,
    maxBenefit: "Up to ₹9,00,000 for product design & packaging redesigns",
    eligibility:
      "Startups hiring verified MSME design toolrooms and prototyping vendors",
    applicableCategories: [
      "Prototyping & Product Development",
      "Specialized Startup Support",
      "Packaging & Printing",
    ],
    applicationStatus: "Eligible",
  },
  {
    id: "SCH-03",
    title: "Credit Linked Capital Subsidy (CLCSS)",
    ministry: "Ministry of Commerce & Industry",
    subsidyPercentage: 15,
    maxBenefit: "Up to ₹15,00,000 capital subsidy on machinery and tooling",
    eligibility:
      "Startups & MSMEs investing in state-of-the-art technological manufacturing",
    applicableCategories: [
      "Prototyping & Product Development",
      "IT & Digital Services",
    ],
    applicationStatus: "Applied",
  },
  {
    id: "SCH-04",
    title: "Startup India Seed Fund (SISFS) Procurement Grant",
    ministry: "DPIIT, Ministry of Commerce",
    subsidyPercentage: 100,
    maxBenefit:
      "Up to ₹20,00,000 for proof-of-concept and prototype manufacturing",
    eligibility:
      "DPIIT-recognized startups incorporated within the last 2 years",
    applicableCategories: [
      "Packaging & Printing",
      "Prototyping & Product Development",
      "Compliance & Legal Support",
    ],
    applicationStatus: "Eligible",
  },
]

// Generate 55 Demo Startup Records for Admin Management
function generateDemoStartups(): DemoStartupRecord[] {
  const cities = [
    "Bengaluru",
    "Mumbai",
    "Pune",
    "Delhi NCR",
    "Hyderabad",
    "Chennai",
    "Jaipur",
    "Ahmedabad",
  ]
  const industries = [
    "Hardware & IoT",
    "D2C Skincare & Beauty",
    "EV & Mobility",
    "HealthTech Devices",
    "AgriTech Automation",
    "CleanTech & Solar",
    "Food & FMCG",
  ]
  const stages: DemoStartupRecord["stage"][] = [
    "Seed",
    "Pre-Series A",
    "Series A",
    "Series B",
    "Bootstrapped",
  ]
  const audits: DemoStartupRecord["auditStatus"][] = [
    "Verified",
    "Verified",
    "Under Review",
    "Pending Audit",
    "Needs Information",
  ]

  const results: DemoStartupRecord[] = []
  for (let i = 1; i <= 55; i++) {
    const pad = i.toString().padStart(3, "0")
    const city = cities[i % cities.length]
    const ind = industries[i % industries.length]
    const stg = stages[i % stages.length]
    const aud = audits[i % audits.length]
    const val = 120000 + i * 47500

    results.push({
      id: `STU-2026-${pad}`,
      name:
        i === 1
          ? "TechNova Innovations Pvt Ltd"
          : `VentureForge ${ind.split(" ")[0]} Labs #${pad}`,
      industry: ind,
      city: city,
      state:
        city === "Bengaluru"
          ? "Karnataka"
          : city === "Mumbai" || city === "Pune"
            ? "Maharashtra"
            : "India",
      stage: stg,
      registrationStatus: i % 4 === 0 ? "Pending" : "DPIIT Registered",
      rfqsCount: 1 + (i % 7),
      ordersCount: i % 5,
      procurementValue: val,
      auditStatus: aud,
      joinedDate: `2026-0${1 + (i % 8)}-${10 + (i % 18)}`,
    })
  }
  return results
}

// Generate 55 Demo MSME Records for Admin Management
function generateDemoMSMEs(): DemoMSMERecord[] {
  const categories = CATALOG_CATEGORIES
  const cities = [
    "Pune",
    "Ahmedabad",
    "Bengaluru",
    "Coimbatore",
    "Noida",
    "Gurugram",
    "Surat",
    "Hyderabad",
  ]
  const statuses: DemoMSMERecord["verificationStatus"][] = [
    "Verified",
    "Verified",
    "Under Review",
    "Pending Audit",
    "Needs Information",
  ]

  const results: DemoMSMERecord[] = []
  for (let i = 1; i <= 55; i++) {
    const pad = i.toString().padStart(3, "0")
    const cat = categories[i % categories.length]
    const city = cities[i % cities.length]
    const stat = statuses[i % statuses.length]
    const rev = 450000 + i * 92000

    results.push({
      id: `MSME-IND-${pad}`,
      name:
        i === 1
          ? "Apex Precision Packaging Ltd"
          : i === 2
            ? "Suryavanshi Prints & Polymers"
            : `Bharat Toolroom & ${cat.split(" ")[0]} #${pad}`,
      category: cat,
      city: city,
      state:
        city === "Pune"
          ? "Maharashtra"
          : city === "Ahmedabad"
            ? "Gujarat"
            : "India",
      udyamNumber: `UDYAM-IN-${10 + (i % 25)}-00${pad}982`,
      verificationStatus: stat,
      rfqsCount: 4 + (i % 12),
      quotesCount: 3 + (i % 10),
      ordersCount: 2 + (i % 6),
      fulfillmentRate: 92 + (i % 8),
      revenue: rev,
      auditStatus: stat,
    })
  }
  return results
}

const INITIAL_SOURCING_HISTORY: SourcingHistoryEvent[] = [
  {
    id: "REQ-2026-0891",
    request: "500x Custom Rigid Skincare Packaging Boxes",
    category: "Packaging & Printing",
    date: "Sep 22, 2026",
    rfqStatus: "Completed",
    quotesCount: 4,
    savingsAmount: 19750,
    timeSaved: "8 business days",
    orderStatus: "In Production",
    supplierDisplayName: "MPI Verified Supplier #001",
    insights: {
      costInsight:
        "Saved ₹19,750 (23.2%) against baseline benchmark through Reverse Margin AI optimization.",
      savingsNote:
        "Included ₹7,250 direct government subsidy pass-through via ZED Gold certification.",
      quoteSpread:
        "Quote spread ranged from ₹61,750 to ₹78,375 across 4 verified bids.",
      supplierCompetition:
        "4 audited MSMEs competed, compressing unit manufacturing from ₹145 to ₹110.",
      categoryInsight:
        "Packaging & Printing currently yields the highest procurement savings in Western India.",
      procurementRecommendation:
        "Standardize rigid box dieline to lock in bulk tooling amortisation for next batch.",
    },
  },
  {
    id: "REQ-2026-0742",
    request: "50x SLS Nylon Enclosure Prototypes",
    category: "Prototyping & Product Development",
    date: "Aug 15, 2026",
    rfqStatus: "Completed",
    quotesCount: 3,
    savingsAmount: 14200,
    timeSaved: "6 business days",
    orderStatus: "Delivered",
    supplierDisplayName: "MPI Verified Supplier #005",
    insights: {
      costInsight:
        "Saved ₹14,200 (18%) compared to private quote broker rates.",
      savingsNote:
        "Utilized Design Clinic prototyping assistance subsidy for 3D tooling.",
      quoteSpread:
        "Received bids from Bengaluru and Pune toolrooms within 48 hours.",
      supplierCompetition:
        "3 ISO 9001 certified prototyping labs participated.",
      categoryInsight:
        "Prototyping turnaround was compressed from 21 days to 7 days.",
      procurementRecommendation:
        "Transition from SLS Nylon to injection molding once batch volume crosses 1,000 pcs.",
    },
  },
  {
    id: "REQ-2026-0610",
    request: "ISO 9001:2015 & ZED Gold Statutory Audit",
    category: "Compliance & Legal Support",
    date: "Jul 04, 2026",
    rfqStatus: "Completed",
    quotesCount: 2,
    savingsAmount: 8500,
    timeSaved: "12 business days",
    orderStatus: "Settled",
    supplierDisplayName: "MPI Verified Supplier #006",
    insights: {
      costInsight:
        "Saved ₹8,500 by leveraging pre-vetted legal auditor directory.",
      savingsNote:
        "Zero defect documentation passed on first submission to Quality Council of India.",
      quoteSpread: "Bids ranged between ₹42,000 and ₹50,500.",
      supplierCompetition:
        "Pre-negotiated institutional rates for DPIIT startups.",
      categoryInsight:
        "Compliance audits completed 40% faster with automated document indexing.",
      procurementRecommendation:
        "Schedule annual surveillance audit renewal 60 days before expiration.",
    },
  },
]

const INITIAL_ORDERS_LIST: OrderItem[] = [
  {
    id: "ORD-2026-901",
    requirement: "500x Custom Rigid Skincare Packaging Boxes",
    category: "Packaging & Printing",
    supplierDisplayName: "MPI Verified Supplier #001",
    realSupplierName: "Apex Precision Packaging Ltd.",
    buyerDisplayName: "MPI Verified Buyer #042",
    orderValue: 65250,
    status: "In Production",
    createdDate: "2026-09-22",
    expectedDelivery: "2026-10-18",
    savings: 19750,
  },
  {
    id: "ORD-2026-844",
    requirement: "2,000x Corrugated Outer Shipping Cartons",
    category: "Packaging & Printing",
    supplierDisplayName: "MPI Verified Supplier #002",
    realSupplierName: "Suryavanshi Prints & Polymers",
    buyerDisplayName: "MPI Verified Buyer #019",
    orderValue: 48500,
    status: "In Transit",
    createdDate: "2026-09-14",
    expectedDelivery: "2026-09-28",
    savings: 12000,
  },
  {
    id: "ORD-2026-782",
    requirement: "50x SLS Nylon Enclosure Prototypes",
    category: "Prototyping & Product Development",
    supplierDisplayName: "MPI Verified Supplier #005",
    realSupplierName: "Bharat Tech Innovators Labs",
    buyerDisplayName: "MPI Verified Buyer #042",
    orderValue: 64800,
    status: "Delivered",
    createdDate: "2026-08-15",
    expectedDelivery: "2026-08-25",
    savings: 14200,
  },
]

const INITIAL_SAMPLE_REQUESTS: SampleRequest[] = [
  {
    id: "SMP-2026-081",
    supplierId: "SUP-001",
    supplierDisplayName: "MPI Verified Supplier #001",
    productTitle: "Custom Rigid Skincare Presentation Box",
    category: "Packaging & Printing",
    sampleQuantity: 2,
    specifications:
      "1200 GSM Kappa board, matte scuff-free lamination, laser-cut EVA foam fitment for 30ml bottles, gold hot foil logo on lid",
    targetDeliveryDate: "2026-09-28",
    shippingAddress:
      "AuraVeda Labs, 4th Floor, Indiranagar 100ft Road, Bengaluru, Karnataka 560038",
    contactPhone: "+91 98450 12890",
    status: "Under Review",
    sampleCost: 0,
    trackingNumber: "DELHIVERY-SMP-890124",
    carrierName: "Delhivery Express Surface",
    dispatchedDate: "2026-09-21",
    deliveredDate: "2026-09-23",
    qualityRating: 5,
    dimensionPass: true,
    finishPass: true,
    durabilityPass: true,
    evaluationNotes:
      "Exceptional structural rigidity. EVA foam cavity holds bottles securely without rattles. Matte finish resists thumbprints.",
    createdAt: "2026-09-18",
  },
  {
    id: "SMP-2026-064",
    supplierId: "SUP-005",
    supplierDisplayName: "MPI Verified Supplier #005",
    productTitle: "SLS Nylon PA12 Device Enclosure Mockup",
    category: "Prototyping & Product Development",
    sampleQuantity: 1,
    specifications:
      "SLS Nylon PA12, 100 micron layer resolution, vapor smoothed finish with brass threaded M3 heat-set inserts",
    targetDeliveryDate: "2026-09-15",
    shippingAddress: "AuraVeda Labs, Bengaluru",
    contactPhone: "+91 98450 12890",
    status: "Approved",
    sampleCost: 1200,
    trackingNumber: "BLUEDART-EXP-441290",
    carrierName: "BlueDart Air",
    dispatchedDate: "2026-09-10",
    deliveredDate: "2026-09-12",
    qualityRating: 5,
    dimensionPass: true,
    finishPass: true,
    durabilityPass: true,
    evaluationNotes:
      "Tolerances verified on CMM within +/- 0.08mm. Threaded inserts torque tested to 2.5 Nm without pull-out.",
    decisionReason: "Approved for production batch tooling.",
    createdAt: "2026-09-08",
    convertedToRfqId: "RFQ-2026-0742",
  },
  {
    id: "SMP-2026-092",
    supplierId: "SUP-002",
    supplierDisplayName: "MPI Verified Supplier #002",
    productTitle: "Frosted Amber Dropper Bottle 30ml with Screenprint",
    category: "Packaging & Printing",
    sampleQuantity: 3,
    specifications:
      "Type III glass, frosted amber coating, 18/410 aluminum dropper collar with glass pipette, white UV silkscreen print",
    targetDeliveryDate: "2026-09-30",
    shippingAddress: "AuraVeda Labs, Bengaluru",
    contactPhone: "+91 98450 12890",
    status: "Dispatched",
    sampleCost: 0,
    trackingNumber: "DTDC-PRM-981203",
    carrierName: "DTDC Priority Air",
    dispatchedDate: "2026-09-23",
    createdAt: "2026-09-20",
  },
]

const INITIAL_STARTUP_PROFILE: StartupBusinessProfile = {
  founderName: "Aarav Mehta",
  startupName: "TechNova Innovations (AuraVeda)",
  email: "aarav@technovainnovations.com",
  phone: "+91 98450 12890",
  city: "Bengaluru",
  state: "Karnataka",
  stage: "MVP",
  productsSold:
    "Connected wellness devices and premium organic skincare formulation",
  industry: "D2C Skincare & Hardware",
  procurementCategories: [
    "Packaging & Printing",
    "Prototyping & Product Development",
  ],
  procurementSubcategories: [
    "Rigid Gift Boxes",
    "Custom Glass Droppers",
    "Laser Cut Foam Inserts",
  ],
  procurementDescription:
    "Custom rigid luxury boxes with magnetic closure and soft-touch lamination, batch size 500-2,000 units",
  annualProcurementBudget: 1200000,
  turnaroundPriority: "Standard",
  fundingStage: "Seed",
  hasDpiit: true,
  dpiitNumber: "DPIIT-STP-2024-88412",
  teamSize: "5-15 employees",
  governmentInterests: [
    "ZED Quality Certification Subsidy",
    "Design Clinic Packaging Grant",
    "Startup India Seed Fund (SISFS)",
  ],
  createdAt: "2026-09-01",
}

const INITIAL_MSME_PROFILE: MSMEBusinessProfile = {
  enterpriseName: "Apex Precision Packaging Ltd.",
  contactPerson: "Vikram Joshi (VP Operations)",
  email: "v.joshi@apexpackaging.in",
  phone: "+91 98220 44102",
  city: "Pune",
  state: "Maharashtra",
  enterpriseType: "Small",
  udyamNumber: "UDYAM-MH-12-0048192",
  gstNumber: "27AAACA9921B1ZM",
  panNumber: "AAACA9921B",
  factoryAddress:
    "Plot 42, Bhosari MIDC Industrial Estate, Pune, Maharashtra 411026",
  supplyCategories: [
    "Packaging & Printing",
    "Prototyping & Product Development",
  ],
  primaryMachinery: [
    "Heidelberg 6-Color Offset Press (CD 102)",
    "Kolbus Automatic Rigid Box Former",
    "Bobst BMA High-Precision Foil Stamper",
  ],
  monthlyCapacity: "85,000 units/mo",
  capacityUtilization: 68,
  certifications: ["ISO 9001:2015", "FSC Forest Chain of Custody", "ZED Gold"],
  moqStandard: 500,
  standardPaymentTerms:
    "30% Advance Escrow, 70% against delivery dispatch inspection.",
  qualityTestingFacilities: [
    "In-house Spectrophotometer",
    "ISTA-1A Drop Tester",
    "Bursting Strength Tester",
  ],
  leadTimeDays: 12,
  panIndiaDispatch: true,
  schemesUtilized: [
    "ZED Certification Subsidy",
    "CLCSS Technology Upgradation",
  ],
  verificationStatus: "Verified",
  createdAt: "2025-08-15",
}

const INITIAL_REPEAT_CUSTOMER: RepeatCustomerProfile = {
  buyerId: "BUY-042",
  displayName: "MPI Verified Buyer #042",
  tier: "Gold Preferred Buyer",
  ordersCompleted: 8,
  totalOrderValue: 780000,
  onTimePaymentRate: 100,
  disputeCount: 0,
  lastOrderDate: "Aug 28, 2026",
  favoriteCategory: "Packaging & Printing",
  recommendedDiscountPercent: 2,
}

const ProcurementContext = createContext<ProcurementContextType | undefined>(
  undefined,
)

export const ProcurementProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Requirement state
  const [requirementText, setRequirementText] = useState(
    "Need 500 custom rigid printed boxes for our D2C organic skincare launch by next month, budget under ₹80k",
  )
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory>(
    "Packaging & Printing",
  )

  const handleSetSelectedCategory = (cat: CatalogCategory) => {
    setSelectedCategory(cat)
    setMatchedSuppliers((prev) => {
      const match = prev.filter((s) => s.category === cat)
      const rest = prev.filter((s) => s.category !== cat)
      return [...match, ...rest]
    })
  }
  const [quantity, setQuantity] = useState<number>(500)
  const [targetBudget, setTargetBudget] = useState<number>(75000)
  const [deliveryLocation, setDeliveryLocation] = useState<string>(
    "Bengaluru, Karnataka",
  )
  const [deadlineDate, setDeadlineDate] = useState<string>("2026-10-25")
  const [specifications, setSpecifications] = useState<string[]>(DEFAULT_SPECS)
  const [isExtractingSpecs, setIsExtractingSpecs] = useState(false)
  const [aiConfidenceScore, setAiConfidenceScore] = useState<number>(96)
  const [aiSuggestedKeywords, setAiSuggestedKeywords] = useState<string[]>([
    "Rigid Box",
    "1200 GSM Kappa",
    "Skincare Packaging",
    "FSC Certified",
    "Spot UV",
    "Custom Foam Insert",
  ])

  // Suppliers & RFQ
  const [matchedSuppliers, setMatchedSuppliers] =
    useState<MatchedSupplier[]>(INITIAL_SUPPLIERS)
  const [shortlistedSupplierIds, setShortlistedSupplierIds] =
    useState<string[]>(["SUP-001", "SUP-002", "SUP-003"])
  const [activeRFQ, setActiveRFQ] = useState<RFQDetails | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mpi_active_rfq")
        if (stored) return JSON.parse(stored)
      } catch {}
    }
    return {
      id: "RFQ-2026-0891",
      title: "500x Custom Rigid Skincare Packaging Boxes",
      category: "Packaging & Printing",
      quantity: 500,
      targetBudget: 75000,
      deliveryDate: "2026-10-25",
      specifications: DEFAULT_SPECS,
      dispatchedToSupplierIds: ["SUP-001", "SUP-002", "SUP-003", "SUP-004"],
      createdDate: "2026-09-22",
      status: "Quotes Received",
    }
  })

  // Quotes & Comparison
  const [receivedQuotes, setReceivedQuotes] = useState<SupplierQuote[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mpi_submitted_quotes")
        if (stored) return JSON.parse(stored)
      } catch {}
    }
    return INITIAL_QUOTES
  })
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(
    "QTE-002",
  )

  // Milestone Lifecycle
  const [currentMilestone, setCurrentMilestone] = useState<number>(4)

  // Schemes
  const [schemes, setSchemes] = useState<GovScheme[]>(INITIAL_SCHEMES)

  // Sourcing History & Orders
  const [sourcingHistory, setSourcingHistory] =
    useState<SourcingHistoryEvent[]>(INITIAL_SOURCING_HISTORY)
  const [ordersList, setOrdersList] = useState<OrderItem[]>(INITIAL_ORDERS_LIST)

  // Admin Demo Ecosystem Records
  const [demoStartups, setDemoStartups] = useState<DemoStartupRecord[]>(
    generateDemoStartups(),
  )
  const [demoMSMEs, setDemoMSMEs] = useState<DemoMSMERecord[]>(
    generateDemoMSMEs(),
  )

  // Business Profiles
  const [startupProfile, setStartupProfile] = useState<StartupBusinessProfile>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mpi_startup_profile")
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && parsed.startupName) return parsed
        }
      } catch {}
    }
    return INITIAL_STARTUP_PROFILE
  })
  const [msmeProfile, setMSMEProfile] =
    useState<MSMEBusinessProfile>(INITIAL_MSME_PROFILE)

  // Supplier Sample Workflow (8 Lifecycle States)
  const [sampleRequests, setSampleRequests] = useState<SampleRequest[]>(
    INITIAL_SAMPLE_REQUESTS,
  )

  // Repeat Customer Intelligence
  const [repeatCustomerData, setRepeatCustomerData] =
    useState<RepeatCustomerProfile>(INITIAL_REPEAT_CUSTOMER)

  // Backend Database Synchronization Status
  const [backendSyncState, setBackendSyncState] = useState<BackendSyncState>({
    isConnected: false,
    isTableExposed: false,
    backendUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
    lastChecked: 0,
    statusMessage: "Checking cloud service connection...",
    pendingMigration: false,
  })

  const refreshBackendSync = async () => {
    try {
      const health = await checkDatabaseHealth()
      setBackendSyncState(health)
    } catch (err) {
      console.error("Supabase health check error:", err)
    }
  }

  useEffect(() => {
    refreshBackendSync()
  }, [])

  // Explicit Record-Level Persistence Status
  const [rfqPersistenceStatus, setRfqPersistenceStatus] = useState<
    "idle" | "saving" | "saved_to_supabase" | "saved_locally"
  >("idle")
  const [rfqPersistenceError, setRfqPersistenceError] = useState<string | undefined>()

  const [quotePersistenceStatus, setQuotePersistenceStatus] = useState<
    "idle" | "saving" | "saved_to_supabase" | "saved_locally"
  >("idle")
  const [quotePersistenceError, setQuotePersistenceError] = useState<string | undefined>()

  const [remoteDispatchedRFQs, setRemoteDispatchedRFQs] = useState<PublicMSMERFQ[]>([])

  // Authoritative data loading from Supabase
  useEffect(() => {
    if (!backendSyncState.isTableExposed) return

    // 1. Restore authoritative active RFQ for logged-in buyer
    fetchBuyerActiveRFQFromSupabase().then((res) => {
      if (res.fromDatabase && res.rfq) {
        setActiveRFQ(res.rfq)
        setRfqPersistenceStatus("saved_to_supabase")
        try {
          localStorage.setItem("mpi_active_rfq", JSON.stringify(res.rfq))
        } catch {}
      }
    })

    // 2. Fetch dispatched RFQs for MSME suppliers
    fetchDispatchedRFQsFromSupabase().then((res) => {
      if (res.fromDatabase && res.rfqs.length > 0) {
        setRemoteDispatchedRFQs(res.rfqs)
      }
    })
  }, [backendSyncState.isTableExposed])

  // Sync quotes from Supabase when database tables are exposed
  useEffect(() => {
    if (backendSyncState.isTableExposed && activeRFQ?.id) {
      fetchQuotesForRFQFromSupabase(activeRFQ.id).then((res) => {
        if (res.fromDatabase && res.quotes.length > 0) {
          setReceivedQuotes((prev) => {
            const map = new Map<string, SupplierQuote>()
            prev.forEach((q) => map.set(q.supplierId, q))
            res.quotes.forEach((q) => map.set(q.supplierId, q))
            const merged = Array.from(map.values())
            try {
              localStorage.setItem("mpi_submitted_quotes", JSON.stringify(merged))
            } catch {}
            return merged
          })
          setQuotePersistenceStatus("saved_to_supabase")
        }
      })
    }
  }, [backendSyncState.isTableExposed, activeRFQ?.id])

  // --------------------------------------------------------------------------
  // Public Projection for Startups (Strict Supplier Privacy Enforcement)
  // Strictly enforce: 1 requirement = Maximum 5 Top MPI Verified Supplier Matches
  // --------------------------------------------------------------------------
  const publicStartupSuppliers = useMemo<PublicStartupSupplier[]>(() => {
    const matching = matchedSuppliers.filter((s) => s.category === selectedCategory)
    const others = matchedSuppliers.filter((s) => s.category !== selectedCategory)
    const prioritized = [
      ...matching.sort((a, b) => b.matchScore - a.matchScore),
      ...others.sort((a, b) => b.matchScore - a.matchScore),
    ]

    return prioritized
      .slice(0, 5)
      .map((sup) => {
        const supNumber = sup.id.replace("SUP-", "")
        return {
          id: sup.id,
          displayName: `MPI Verified Partner #${supNumber}`,
          category: sup.category,
          city: sup.city,
          state: sup.state,
          matchScore: sup.matchScore,
          verificationStatus:
            sup.verificationStatus === "Verified" ? "Verified" : "Under Review",
          moq: `${sup.moq} units`,
          leadTime: sup.leadTime,
          priceRating: sup.priceRating,
          unitPriceEstimate: sup.unitPriceEstimate,
          certifications: sup.certifications,
          capabilities: sup.capabilities,
          machinery: sup.machinery,
          capacityPerMonth: sup.capacityPerMonth,
          verifiedBadgeDate: sup.verifiedBadgeDate,
        }
      })
  }, [matchedSuppliers, selectedCategory])

  // --------------------------------------------------------------------------
  // Public Quotes Projection with Defined Baseline & Total Savings
  // --------------------------------------------------------------------------
  const publicStartupQuotes = useMemo<PublicStartupQuote[]>(() => {
    return receivedQuotes.map((q, idx) => {
      const supIdx = matchedSuppliers.findIndex((s) => s.id === q.supplierId)
      const padNum = (supIdx >= 0 ? supIdx + 1 : idx + 1)
        .toString()
        .padStart(3, "0")
      const baselineCost = Math.max(Math.round(targetBudget * 1.15), q.finalLandedCost + 4000)
      const totalSavings = Math.max(0, baselineCost - q.finalLandedCost)
      const savingsPercent =
        Math.round((totalSavings / baselineCost) * 1000) / 10

      // Assign badges based on metrics
      const badges: PublicStartupQuote["badges"] = []
      if (idx === 0) badges.push("Highest Savings", "Standard QA")
      if (idx === 1) badges.push("Lowest Price", "Best Value")
      if (idx === 2) badges.push("Fastest Delivery")

      return {
        id: q.id,
        supplierId: q.supplierId,
        supplierDisplayName: `MPI Verified Supplier #${padNum}`,
        quotedTotal: q.totalAmount,
        baselineCost: baselineCost,
        totalSavings: totalSavings,
        savingsPercent: savingsPercent,
        estimatedTimeSaved: `${Math.max(1, 18 - q.deliveryDays)} business days (${Math.max(1, 18 - q.deliveryDays) * 2} hours)`,
        unitPrice: Math.round(
          q.breakdown.unitManufacturing / (quantity || 1),
        ),
        moq: Math.min(quantity || 100, 500),
        breakdown: q.breakdown,
        deliveryDays: q.deliveryDays,
        terms: q.terms,
        schemeSubsidyApplied: q.schemeSubsidyApplied,
        finalLandedCost: q.finalLandedCost,
        qualityScore: q.scoreBreakdown.qualityAssurance,
        certifications: ["ISO 9001:2015", "MSME Udyam Verified"],
        quoteValidity: "30 Calendar Days",
        badges: badges,
        recommendationReason: q.recommendationReason,
      }
    })
  }, [receivedQuotes, matchedSuppliers, quantity, targetBudget])

  // --------------------------------------------------------------------------
  // Public MSME RFQs with Buyer Anonymity
  // --------------------------------------------------------------------------
  const msmeRFQs = useMemo<PublicMSMERFQ[]>(() => {
    // If Supabase has dispatched RFQs from live database, prioritize them
    if (remoteDispatchedRFQs.length > 0) {
      return remoteDispatchedRFQs
    }

    return [
      {
        id: activeRFQ?.id || "RFQ-2026-0891",
        title: activeRFQ?.title || "500x Custom Rigid Skincare Packaging Boxes",
        buyerDisplayName: "MPI Verified Buyer #042",
        category: activeRFQ?.category || "Packaging & Printing",
        quantity: activeRFQ?.quantity || 500,
        unit: "units",
        targetBudget: activeRFQ?.targetBudget || 75000,
        deliveryDate: activeRFQ?.deliveryDate || "2026-10-25",
        specs: specifications.slice(0, 3).join(" • "),
        status: "Open for Bidding",
        postedTime: "2 hours ago",
        matchScore: 97,
      },
      {
        id: "RFQ-2026-0895",
        title: "2,000x Corrugated Outer Shipping Cartons",
        buyerDisplayName: "MPI Verified Buyer #019",
        category: "Packaging & Printing",
        quantity: 2000,
        unit: "boxes",
        targetBudget: 55000,
        deliveryDate: "2026-10-30",
        specs:
          "5-ply corrugated board, flexo print 2-color, burst test 14 kg/cm²",
        status: "Open for Bidding",
        postedTime: "1 day ago",
        matchScore: 93,
      },
      {
        id: "RFQ-2026-0902",
        title: "100x Rapid Prototype Samples with Hot Foil Stamping",
        buyerDisplayName: "MPI Verified Buyer #088",
        category: "Packaging & Printing",
        quantity: 100,
        unit: "units",
        targetBudget: 22000,
        deliveryDate: "2026-10-15",
        specs: "Sample run with micro-embossing and gold foil finish",
        status: "Quoted",
        postedTime: "2 days ago",
        matchScore: 89,
      },
    ]
  }, [remoteDispatchedRFQs, activeRFQ, specifications])

  const addSpecification = (spec: string) => {
    if (spec.trim()) {
      setSpecifications((prev) => [...prev, spec.trim()])
    }
  }

  const removeSpecification = (index: number) => {
    setSpecifications((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleShortlistSupplier = (id: string) => {
    setShortlistedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const runAIExtraction = async (customText?: string): Promise<ExtractedProcurementSpecs | null> => {
    const textToProcess = customText || requirementText
    setIsExtractingSpecs(true)

    try {
      const extracted = await extractProcurementSpecsWithAI(textToProcess)
      if (!extracted.isGreetingOrInsufficient) {
        setSelectedCategory(extracted.category)
        setQuantity(extracted.quantity)
        setTargetBudget(extracted.targetBudget)
        setSpecifications(extracted.specifications)
        setAiSuggestedKeywords(extracted.suggestedKeywords)
        setAiConfidenceScore(extracted.confidenceScore)
        setMatchedSuppliers((prev) => {
          const match = prev.filter((s) => s.category === extracted.category)
          const rest = prev.filter((s) => s.category !== extracted.category)
          return [...match, ...rest]
        })
      }
      return extracted
    } catch (err) {
      console.error("AI Extraction failed:", err)
      return null
    } finally {
      setIsExtractingSpecs(false)
    }
  }

  const createAndDispatchRFQ = (supplierIds?: string[]) => {
    const targetIds =
      supplierIds && supplierIds.length > 0
        ? supplierIds
        : shortlistedSupplierIds
    const isGoods =
      selectedCategory === "Packaging & Printing" ||
      selectedCategory === "Prototyping & Product Development"
    const newRFQ: RFQDetails = {
      id: `RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      title: isGoods
        ? `${quantity.toLocaleString("en-IN")}x ${selectedCategory} Sourcing Request`
        : `${selectedCategory} Procurement Mandate`,
      category: selectedCategory,
      quantity,
      targetBudget,
      deliveryDate: deadlineDate,
      specifications,
      dispatchedToSupplierIds: targetIds,
      createdDate: new Date().toISOString().split("T")[0],
      status: "Dispatched",
    }
    setActiveRFQ(newRFQ)
    try {
      localStorage.setItem("mpi_active_rfq", JSON.stringify(newRFQ))
      localStorage.setItem("mpi_rfq_dispatched", "true")
      localStorage.removeItem("mpi_submitted_quotes")
    } catch {}

    // In a live RFQ workflow, do not synthesize fake quotes.
    // Quotations must be transmitted by real MSMEs via the MSME portal.
    setReceivedQuotes([])
    setSelectedQuoteId(null)
    setRfqPersistenceStatus("saving")
    setRfqPersistenceError(undefined)

    // Synchronize with Supabase PostgreSQL (if tables exist)
    const currentUser = getActiveUser()
    persistRFQToSupabase(newRFQ, currentUser)
      .then((res) => {
        if (res.fromDatabase) {
          console.info("[Supabase] RFQ persisted authoritatively to public.rfqs:", newRFQ.id)
          setRfqPersistenceStatus("saved_to_supabase")
          setRfqPersistenceError(undefined)
          // Refresh MSME feed with real dispatched RFQ
          fetchDispatchedRFQsFromSupabase().then((rfqRes) => {
            if (rfqRes.fromDatabase && rfqRes.rfqs.length > 0) {
              setRemoteDispatchedRFQs(rfqRes.rfqs)
            }
          })
        } else {
          setRfqPersistenceStatus("saved_locally")
          setRfqPersistenceError(res.error)
          console.warn("[Supabase] RFQ local fallback:", res.error)
        }
      })
      .catch((err) => {
        setRfqPersistenceStatus("saved_locally")
        setRfqPersistenceError(err instanceof Error ? err.message : "Sync error")
        console.warn("[Supabase] Async RFQ persist error:", err)
      })
  }

  const submitMSMEQuote = (quote: SupplierQuote, targetRfqId?: string) => {
    setReceivedQuotes((prev) => {
      const existing = prev.findIndex((q) => q.supplierId === quote.supplierId)
      let updated: SupplierQuote[]
      if (existing >= 0) {
        updated = [...prev]
        updated[existing] = quote
      } else {
        updated = [quote, ...prev]
      }
      try {
        localStorage.setItem("mpi_submitted_quotes", JSON.stringify(updated))
      } catch {}
      return updated
    })

    setSelectedQuoteId((current) => current || quote.id)

    // Automatically transition RFQ status to Quotes Received
    setActiveRFQ((prev) => {
      if (!prev) return null
      const updated: RFQDetails = {
        ...prev,
        status: "Quotes Received",
      }
      try {
        localStorage.setItem("mpi_active_rfq", JSON.stringify(updated))
      } catch {}
      return updated
    })

    setQuotePersistenceStatus("saving")
    setQuotePersistenceError(undefined)

    // Synchronize with Supabase PostgreSQL (if tables exist)
    const currentRfqId = targetRfqId || activeRFQ?.id || "RFQ-2026-0891"
    const currentUser = getActiveUser()

    // Track MSME Quote Submission conversion funnel telemetry
    trackTelemetryEvent("msme_quote_submitted", {
      quoteId: quote.id,
      supplierId: quote.supplierId,
      rfqId: currentRfqId,
      totalAmount: quote.totalAmount || quote.finalLandedCost || 0,
      deliveryDays: quote.deliveryDays,
    })

    persistQuoteToSupabase(quote, currentRfqId, currentUser)
      .then((res) => {
        if (res.fromDatabase) {
          console.info("[Supabase] Quote persisted authoritatively to public.quotes:", quote.id)
          setQuotePersistenceStatus("saved_to_supabase")
          setQuotePersistenceError(undefined)
        } else {
          setQuotePersistenceStatus("saved_locally")
          setQuotePersistenceError(res.error)
          console.warn("[Supabase] Quote local fallback:", res.error)
        }
      })
      .catch((err) => {
        setQuotePersistenceStatus("saved_locally")
        setQuotePersistenceError(err instanceof Error ? err.message : "Sync error")
        console.warn("[Supabase] Async quote persist error:", err)
      })
  }

  const loadDemoQuotes = () => {
    setReceivedQuotes(INITIAL_QUOTES)
    setSelectedQuoteId("QTE-002")
    try {
      localStorage.setItem("mpi_submitted_quotes", JSON.stringify(INITIAL_QUOTES))
    } catch {}
  }

  const selectQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId)
  }

  const advanceMilestone = () => {
    setCurrentMilestone((prev) => Math.min(prev + 1, 10))
  }

  const setMilestone = (index: number) => {
    setCurrentMilestone(Math.max(1, Math.min(index, 10)))
  }

  const updateSupplierVerificationStatus = (
    supplierId: string,
    status: MatchedSupplier["verificationStatus"],
    _notes?: string,
  ) => {
    setMatchedSuppliers((prev) =>
      prev.map((sup) =>
        sup.id === supplierId ? { ...sup, verificationStatus: status } : sup,
      ),
    )
  }

  const updateStartupAuditStatus = (
    id: string,
    status: DemoStartupRecord["auditStatus"],
  ) => {
    setDemoStartups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, auditStatus: status } : s)),
    )
  }

  const updateMSMEAuditStatus = (
    id: string,
    status: DemoMSMERecord["auditStatus"],
  ) => {
    setDemoMSMEs((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, auditStatus: status, verificationStatus: status }
          : m,
      ),
    )
  }

  const matchSchemes = (profile: SchemeMatcherProfile): SchemeMatchResult[] => {
    return matchSchemesForProfile(profile, MPI_GOV_SCHEMES)
  }

  const getSchemeById = (id: string): MpiScheme | undefined => {
    return MPI_GOV_SCHEMES.find((s) => s.id === id)
  }

  const updateStartupProfile = (profile: Partial<StartupBusinessProfile>) => {
    setStartupProfile((prev) => {
      const next = { ...prev, ...profile }
      try {
        localStorage.setItem("mpi_startup_profile", JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const updateMSMEProfile = (profile: Partial<MSMEBusinessProfile>) => {
    setMSMEProfile((prev) => ({ ...prev, ...profile }))
  }

  const requestSample = (
    req: Omit<SampleRequest, "id" | "createdAt" | "status">,
  ): SampleRequest => {
    const newId = `SMP-2026-${Math.floor(100 + Math.random() * 900)}`
    const newSample: SampleRequest = {
      ...req,
      id: newId,
      status: "Requested",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setSampleRequests((prev) => [newSample, ...prev])
    return newSample
  }

  const updateSampleStatus = (
    id: string,
    status: SampleLifecycleStatus,
    extra?: Partial<SampleRequest>,
  ) => {
    setSampleRequests((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, ...(extra || {}) } : s)),
    )
  }

  const approveSampleAndProceedToRFQ = (sampleId: string) => {
    const sample = sampleRequests.find((s) => s.id === sampleId)
    if (!sample) return

    // 1. Mark sample as approved
    updateSampleStatus(sampleId, "Approved", {
      decisionReason:
        "Sample verified against dimensional and quality criteria. Approved for bulk production.",
      convertedToRfqId: `RFQ-BULK-${sample.id}`,
    })

    // 2. Automatically generate and dispatch bulk RFQ based on approved sample specifications
    setRequirementText(
      `Bulk order: 500x ${sample.productTitle} (Calibrated from Approved Sample #${sample.id})`,
    )
    setSelectedCategory(sample.category)
    setQuantity(500)
    setSpecifications([
      sample.specifications,
      `Standardized based on Approved Pre-Production Sample #${sample.id}`,
      "Must match approved sample color, dimensions, and material density exactly",
      "Zero defect guarantee under MSME ZED Quality Protocol",
    ])

    createAndDispatchRFQ([sample.supplierId])
  }

  const resetToSampleData = () => {
    setRequirementText(
      "Need 500 custom rigid printed boxes for our D2C organic skincare launch by next month, budget under ₹80k",
    )
    setSelectedCategory("Packaging & Printing")
    setQuantity(500)
    setTargetBudget(75000)
    setDeliveryLocation("Bengaluru, Karnataka")
    setDeadlineDate("2026-10-25")
    setSpecifications(DEFAULT_SPECS)
    setMatchedSuppliers(INITIAL_SUPPLIERS)
    setShortlistedSupplierIds(["SUP-001", "SUP-002", "SUP-003"])
    setReceivedQuotes(INITIAL_QUOTES)
    setSelectedQuoteId("QTE-001")
    setCurrentMilestone(4)
    setSchemes(INITIAL_SCHEMES)
    setSourcingHistory(INITIAL_SOURCING_HISTORY)
    setOrdersList(INITIAL_ORDERS_LIST)
    setStartupProfile(INITIAL_STARTUP_PROFILE)
    setMSMEProfile(INITIAL_MSME_PROFILE)
    setSampleRequests(INITIAL_SAMPLE_REQUESTS)
    setRepeatCustomerData(INITIAL_REPEAT_CUSTOMER)
  }

  return (
    <ProcurementContext.Provider
      value={{
        requirementText,
        setRequirementText,
        selectedCategory,
        setSelectedCategory: handleSetSelectedCategory,
        quantity,
        setQuantity,
        targetBudget,
        setTargetBudget,
        deliveryLocation,
        setDeliveryLocation,
        deadlineDate,
        setDeadlineDate,
        specifications,
        setSpecifications,
        addSpecification,
        removeSpecification,
        isExtractingSpecs,
        runAIExtraction,
        aiConfidenceScore,
        aiSuggestedKeywords,
        matchedSuppliers,
        publicStartupSuppliers,
        shortlistedSupplierIds,
        toggleShortlistSupplier,
        activeRFQ,
        createAndDispatchRFQ,
        receivedQuotes,
        publicStartupQuotes,
        selectedQuoteId,
        selectQuote,
        submitMSMEQuote,
        loadDemoQuotes,
        backendSyncState,
        refreshBackendSync,
        rfqPersistenceStatus,
        rfqPersistenceError,
        quotePersistenceStatus,
        quotePersistenceError,
        currentMilestone,
        advanceMilestone,
        setMilestone,
        schemes,
        mpiSchemes: MPI_GOV_SCHEMES,
        matchSchemes,
        getSchemeById,
        startupProfile,
        updateStartupProfile,
        msmeProfile,
        updateMSMEProfile,
        sampleRequests,
        requestSample,
        updateSampleStatus,
        approveSampleAndProceedToRFQ,
        repeatCustomerData,
        sourcingHistory,
        ordersList,
        MARKET_BASELINE_COST,
        msmeRFQs,
        demoStartups,
        demoMSMEs,
        updateStartupAuditStatus,
        updateMSMEAuditStatus,
        updateSupplierVerificationStatus,
        resetToSampleData,
      }}
    >
      {children}
    </ProcurementContext.Provider>
  )
}

export const useProcurement = (): ProcurementContextType => {
  const context = useContext(ProcurementContext)
  if (!context) {
    throw new Error("useProcurement must be used within a ProcurementProvider")
  }
  return context
}
