import { useState } from "react"
import { NavProps } from "../../App"
import {
  useProcurement,
  MSMEBusinessProfile,
} from "../../context/ProcurementContext"
import { CATALOG_CATEGORIES, CatalogCategory } from "../../lib/mpiCatalog"
import {
  Icons,
  MPIButton,
} from "../../components/design-system/MPIDesignSystem"
import { MPILogo } from "../../components/shared"
import { mockRegister } from "../../lib/mockAuth"

export default function MSMEOnboarding({ navigate, goBack }: NavProps) {
  const { msmeProfile, updateMSMEProfile } = useProcurement()

  // Current Step (1 to 11)
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 11

  const googleUser = (() => {
    try {
      const raw = localStorage.getItem("mpi_active_user")
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  // Form State
  const [enterpriseName, setEnterpriseName] = useState(
    msmeProfile.enterpriseName || googleUser?.orgName || googleUser?.companyName || "",
  )
  const [contactPerson, setContactPerson] = useState(
    msmeProfile.contactPerson || googleUser?.name || "",
  )
  const [email, setEmail] = useState(msmeProfile.email || googleUser?.email || "")
  const [phone, setPhone] = useState(msmeProfile.phone || "")
  const [city, setCity] = useState(msmeProfile.city || "Pune")
  const [state, setState] = useState(msmeProfile.state || "Maharashtra")
  const [enterpriseType, setEnterpriseType] =
    useState<MSMEBusinessProfile["enterpriseType"]>(
      msmeProfile.enterpriseType || "Small",
    )

  const [udyamNumber, setUdyamNumber] = useState(
    msmeProfile.udyamNumber || "UDYAM-MH-12-0048192",
  )
  const [gstNumber, setGstNumber] = useState(
    msmeProfile.gstNumber || "27AAACA9921B1ZM",
  )
  const [panNumber, setPanNumber] = useState(
    msmeProfile.panNumber || "AAACA9921B",
  )
  const [factoryAddress, setFactoryAddress] = useState(
    msmeProfile.factoryAddress ||
      "Plot 42, Bhosari MIDC Industrial Estate, Pune, Maharashtra 411026",
  )

  const [supplyCategories, setSupplyCategories] = useState<CatalogCategory[]>(
    msmeProfile.supplyCategories || [
      "Packaging & Printing",
      "Prototyping & Product Development",
    ],
  )

  const [monthlyCapacity, setMonthlyCapacity] = useState(
    msmeProfile.monthlyCapacity || "85,000 units/mo",
  )
  const [capacityUtilization, setCapacityUtilization] = useState(
    msmeProfile.capacityUtilization || 68,
  )
  const [shiftsPerDay, setShiftsPerDay] = useState(2)

  const [primaryMachinery, setPrimaryMachinery] = useState<string[]>(
    msmeProfile.primaryMachinery || [
      "Heidelberg 6-Color Offset Press (CD 102)",
      "Kolbus Automatic Rigid Box Former",
      "Bobst BMA High-Precision Foil Stamper",
    ],
  )
  const [newMachineInput, setNewMachineInput] = useState("")

  const [certifications, setCertifications] = useState<string[]>(
    msmeProfile.certifications || [
      "ISO 9001:2015",
      "FSC Forest Chain of Custody",
      "ZED Gold",
    ],
  )

  const [moqStandard, setMoqStandard] = useState(msmeProfile.moqStandard || 500)
  const [leadTimeDays, setLeadTimeDays] = useState(
    msmeProfile.leadTimeDays || 12,
  )
  const [standardPaymentTerms, setStandardPaymentTerms] = useState(
    msmeProfile.standardPaymentTerms ||
      "30% Advance Escrow, 70% against delivery dispatch inspection.",
  )

  const [qualityTestingFacilities, setQualityTestingFacilities] =
    useState<string[]>(
      msmeProfile.qualityTestingFacilities || [
        "In-house Spectrophotometer",
        "ISTA-1A Drop Tester",
        "Bursting Strength Tester",
      ],
    )

  const [panIndiaDispatch, setPanIndiaDispatch] = useState<boolean>(
    msmeProfile.panIndiaDispatch ?? true,
  )

  const [schemesUtilized, setSchemesUtilized] = useState<string[]>(
    msmeProfile.schemesUtilized || [
      "ZED Certification Subsidy",
      "CLCSS Technology Upgradation",
    ],
  )

  const [uploadedUdyamDoc] = useState(
    "Udyam_Registration_Certificate.pdf",
  )
  const [uploadedGstDoc] = useState(
    "GST_Registration_Certificate_27.pdf",
  )
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreedTerms, setAgreedTerms] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const toggleCategory = (cat: CatalogCategory) => {
    setSupplyCategories((prev) =>
      prev.includes(cat)
        ? prev.length > 1
          ? prev.filter((c) => c !== cat)
          : prev
        : [...prev, cat],
    )
  }

  const toggleCertification = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert],
    )
  }

  const toggleTestingFacility = (fac: string) => {
    setQualityTestingFacilities((prev) =>
      prev.includes(fac) ? prev.filter((f) => f !== fac) : [...prev, fac],
    )
  }

  const toggleScheme = (sch: string) => {
    setSchemesUtilized((prev) =>
      prev.includes(sch) ? prev.filter((s) => s !== sch) : [...prev, sch],
    )
  }

  const addMachine = () => {
    if (!newMachineInput.trim()) return
    setPrimaryMachinery((prev) => [...prev, newMachineInput.trim()])
    setNewMachineInput("")
  }

  const removeMachine = (index: number) => {
    setPrimaryMachinery((prev) => prev.filter((_, idx) => idx !== index))
  }

  const validateCurrentStep = (): boolean => {
    setErrorMessage("")
    if (currentStep === 1) {
      if (!enterpriseName.trim() || !contactPerson.trim() || !email.trim()) {
        setErrorMessage(
          "Please fill in Enterprise Name, Contact Person, and Business Email.",
        )
        return false
      }
    }
    if (currentStep === 2) {
      if (!udyamNumber.trim() || !gstNumber.trim()) {
        setErrorMessage(
          "Please provide your statutory Udyam and GSTIN registration numbers.",
        )
        return false
      }
    }
    if (currentStep === 11) {
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.")
        return false
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.")
        return false
      }
      if (!agreedTerms) {
        setErrorMessage("Please agree to the MPI Supplier Standards.")
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!validateCurrentStep()) return

    setIsSubmitting(true)
    setErrorMessage("")

    const newProfile: MSMEBusinessProfile = {
      enterpriseName,
      contactPerson,
      email,
      phone,
      city,
      state,
      enterpriseType,
      udyamNumber,
      gstNumber,
      panNumber,
      factoryAddress,
      supplyCategories,
      primaryMachinery,
      monthlyCapacity,
      capacityUtilization,
      certifications,
      moqStandard,
      standardPaymentTerms,
      qualityTestingFacilities,
      leadTimeDays,
      panIndiaDispatch,
      schemesUtilized,
      verificationStatus: "Verified",
      createdAt: new Date().toISOString().split("T")[0],
    }

    updateMSMEProfile(newProfile)

    await mockRegister("msme", {
      name: contactPerson,
      orgName: enterpriseName,
      email,
      password,
      confirmPassword,
    })

    setIsSubmitting(false)
    navigate("msme.home")
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1220] flex flex-col font-sans selection:bg-[#051F16] selection:text-white">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => navigate("home")}
            className="hover:opacity-85 transition-opacity text-left cursor-pointer shrink-0"
          >
            <MPILogo small />
          </button>

          {/* Back Button */}
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Go back"
          >
            <Icons.ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="min-w-0">
            {/* Interactive Clickable Breadcrumbs */}
            <div className="flex items-center gap-1 text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              <button
                onClick={() => navigate("home")}
                className="hover:text-slate-900 hover:underline cursor-pointer shrink-0"
              >
                Home
              </button>
              <span>/</span>
              <span className="text-[#051F16] font-semibold truncate">
                MSME Onboarding
              </span>
            </div>

            <div className="text-xs sm:text-sm font-bold text-[#051F16] truncate">
              MSME Supplier Onboarding & Statutory Audit Protocol (11 Steps)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => navigate("home")}
            className="hidden sm:flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>🏠</span>
            <span>Marketplace</span>
          </button>
          <button
            onClick={() => navigate("login.msme")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Log In →
          </button>
        </div>
      </header>

      {/* ── Progress Bar ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#051F16] text-white flex items-center justify-center font-bold text-xs">
              {currentStep}
            </span>
            <span className="text-xs font-extrabold text-[#051F16]">
              Step {currentStep} of {totalSteps}:{" "}
              {currentStep === 1 && "Enterprise Profile"}
              {currentStep === 2 && "Udyam & Tax IDs"}
              {currentStep === 3 && "Supply Capabilities"}
              {currentStep === 4 && "Manufacturing Capacity"}
              {currentStep === 5 && "Machinery Park"}
              {currentStep === 6 && "Quality Standards (ISO/ZED)"}
              {currentStep === 7 && "Pricing & MOQ"}
              {currentStep === 8 && "Testing Facilities"}
              {currentStep === 9 && "Logistics & Dispatch"}
              {currentStep === 10 && "Govt Scheme Benefits"}
              {currentStep === 11 && "Verification & Account"}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {Math.round((currentStep / totalSteps) * 100)}% Complete
          </span>
        </div>

        <div className="max-w-4xl mx-auto w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-[#051F16] h-full rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Form Card Container ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10">
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <Icons.AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: BUSINESS PROFILE & ENTERPRISE TYPE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 1 · Business Entity
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Enterprise Profile & Statutory Classification
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Provide your registered company information and legal
                  representative details.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Registered Enterprise Name *
                  </label>
                  <input
                    type="text"
                    value={enterpriseName}
                    onChange={(e) => setEnterpriseName(e.target.value)}
                    placeholder="e.g. Apex Precision Packaging Ltd."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Authorized Representative *
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Vikram Joshi (VP Operations)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Enterprise Classification *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Micro", "Small", "Medium"] as const).map((et) => (
                      <button
                        key={et}
                        type="button"
                        onClick={() => setEnterpriseType(et)}
                        className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                          enterpriseType === et
                            ? "bg-[#051F16] text-white border-[#051F16] shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {et}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Business Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="v.joshi@apexpackaging.in"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Factory Phone *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98220 44102"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Pune"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REGISTRATION (UDYAM, GST, PAN) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 2 · Statutory Registrations
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Statutory Udyam, GSTIN, & Factory Premise
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Required to earn the MPI Verified trust badge and receive
                  direct high-intent buyer inquiries.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Udyam Registration Number *
                  </label>
                  <input
                    type="text"
                    value={udyamNumber}
                    onChange={(e) => setUdyamNumber(e.target.value)}
                    placeholder="e.g. UDYAM-MH-12-0048192"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16] font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      GSTIN Number *
                    </label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      placeholder="e.g. 27AAACA9921B1ZM"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Permanent Account Number (PAN) *
                    </label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      placeholder="e.g. AAACA9921B"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Factory / Plant Physical Address *
                  </label>
                  <textarea
                    rows={3}
                    value={factoryAddress}
                    onChange={(e) => setFactoryAddress(e.target.value)}
                    placeholder="Plot / Shed number, Industrial Area / MIDC / GIDC, City, Pincode"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRODUCTS & SERVICES */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 3 · Supply Capabilities
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  What categories and manufacturing services do you offer?
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Select all categories where you have verified tooling and
                  production capacity.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2.5">
                  Select Applicable Categories (Minimum 1):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CATALOG_CATEGORIES.map((cat) => {
                    const isSelected = supplyCategories.includes(cat)
                    return (
                      <div
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-50/50 border-[#051F16] shadow-2xs"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-xs font-bold text-[#051F16]">
                          {cat}
                        </span>
                        {isSelected && (
                          <span className="text-emerald-800 font-bold">✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CAPACITY & OUTPUT */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 4 · Capacity
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Manufacturing & Monthly Service Capacity
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Helps our AI assign procurement matches without overloading
                  your shop floor.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Maximum Monthly Capacity Output:
                  </label>
                  <input
                    type="text"
                    value={monthlyCapacity}
                    onChange={(e) => setMonthlyCapacity(e.target.value)}
                    placeholder="e.g. 85,000 units/mo or 25,000 meters/mo"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Current Shop Floor Capacity Utilization:
                    </label>
                    <span className="text-xs font-extrabold text-[#051F16] bg-slate-100 px-2.5 py-0.5 rounded">
                      {capacityUtilization}% ({100 - capacityUtilization}%
                      Available for MPI RFQs)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={capacityUtilization}
                    onChange={(e) =>
                      setCapacityUtilization(Number(e.target.value))
                    }
                    className="w-full accent-blue-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Operational Shifts Per Day:
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((shifts) => (
                      <button
                        key={shifts}
                        type="button"
                        onClick={() => setShiftsPerDay(shifts)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          shiftsPerDay === shifts
                            ? "bg-[#051F16] text-white border-[#051F16]"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {shifts}{" "}
                        {shifts === 1
                          ? "Shift (8 hrs)"
                          : `${shifts} Shifts (${shifts * 8} hrs)`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: MACHINERY & TOOLING PARK */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 5 · Machine Park
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Machinery, Equipment & Tooling Park
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  List your core production equipment to verify technical
                  feasibility with startup specifications.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMachineInput}
                    onChange={(e) => setNewMachineInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addMachine())
                    }
                    placeholder="e.g. Haas VF-2SS 5-Axis CNC Milling Center"
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                  <MPIButton
                    variant="outline"
                    type="button"
                    onClick={addMachine}
                  >
                    + Add Machine
                  </MPIButton>
                </div>

                <div className="space-y-2">
                  {primaryMachinery.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono">
                          0{idx + 1}.
                        </span>
                        <span className="font-bold text-[#051F16]">{m}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMachine(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Icons.Close className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: CERTIFICATIONS (ISO, ZED) */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 6 · Quality Standards
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Statutory Quality Standards & Certifications
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  ZED and ISO certifications boost your matching rank by up to
                  35% on startup RFQs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "ISO 9001:2015 Quality Management",
                  "ZED Gold (Zero Defect Zero Effect)",
                  "ZED Silver",
                  "ZED Bronze",
                  "ISO 14001 Environmental Management",
                  "FSC Forest Chain of Custody",
                  "GMP (Good Manufacturing Practices)",
                  "CE Mark Conformity",
                ].map((cert) => {
                  const isChecked = certifications.includes(cert)
                  return (
                    <label
                      key={cert}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-emerald-50/50 border-blue-400 shadow-2xs"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCertification(cert)}
                        className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        {cert}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 7: PRICING & MOQ */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 7 · Pricing & MOQ
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Standard Minimum Order Quantities & Commercial Terms
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Define your minimum batch threshold and preferred payment
                  escrow structures.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Standard MOQ (Units):
                    </label>
                    <input
                      type="number"
                      value={moqStandard}
                      onChange={(e) => setMoqStandard(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Standard Production Lead Time (Days):
                    </label>
                    <input
                      type="number"
                      value={leadTimeDays}
                      onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Standard Payment & Escrow Terms:
                  </label>
                  <textarea
                    rows={3}
                    value={standardPaymentTerms}
                    onChange={(e) => setStandardPaymentTerms(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: TESTING & INSPECTION FACILITIES */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 8 · Testing & QA
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  In-House Testing & Quality Inspection Facilities
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Enables pre-shipment quality verification passes without
                  third-party lab delays.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "In-house Spectrophotometer",
                  "ISTA-1A Drop Tester",
                  "Bursting Strength Tester",
                  "Coordinate Measuring Machine (CMM)",
                  "Melt Flow Index (MFI) Tester",
                  "High Voltage Insulation Tester",
                ].map((fac) => {
                  const isChecked = qualityTestingFacilities.includes(fac)
                  return (
                    <label
                      key={fac}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-emerald-50/50 border-blue-400 shadow-2xs"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTestingFacility(fac)}
                        className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        {fac}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 9: LOGISTICS & DISPATCH */}
          {currentStep === 9 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 9 · Logistics
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Packaging & Pan-India Dispatch Capabilities
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Confirm your shipping and surface transport reach across
                  Tier-1 and Tier-2 startup hubs.
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={panIndiaDispatch}
                    onChange={(e) => setPanIndiaDispatch(e.target.checked)}
                    className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">
                      Pan-India Dispatch Capability
                    </span>
                    <span className="text-slate-500 block text-[11px]">
                      Integrated tie-ups with commercial logistics carriers
                      (Delhivery, BlueDart, Safexpress, V-Trans)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 10: GOVERNMENT SCHEMES INTEREST */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 10 · Government Subsidies
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Government Schemes Utilized & Subsidy Pass-Through
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Tag schemes you currently leverage so our reverse-margin
                  calculator can pass discounts to buyers.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  "ZED Certification Subsidy (Up to 80% Reimbursement)",
                  "Credit Linked Capital Subsidy Scheme (CLCSS - 15% Capital Subsidy)",
                  "NSIC Single Point Registration Scheme (SPRS - 100% EMD Exemption)",
                  "NSIC Raw Material Assistance Scheme (RMA)",
                  "Lean Manufacturing Competitiveness Scheme (80% Grant)",
                ].map((sch) => {
                  const isChecked = schemesUtilized.includes(sch)
                  return (
                    <label
                      key={sch}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-emerald-50/50 border-blue-400 shadow-2xs"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleScheme(sch)}
                        className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        {sch}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 11: VERIFICATION & ACCOUNT CREATION */}
          {currentStep === 11 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Step 11 · Verification & Password
                </span>
                <h1
                  className="text-2xl font-extrabold text-[#051F16] mt-1"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  Confirm Verification Documents & Set Password
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Review attached statutory certificates and create your
                  password to access the MSME Supplier Portal.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-700">
                    Attached Verification Files:
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="flex items-center gap-2">
                      <Icons.FileText className="w-4 h-4 text-emerald-700" />
                      <span>{uploadedUdyamDoc}</span>
                    </span>
                    <span className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded">
                      Uploaded ✓
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="flex items-center gap-2">
                      <Icons.FileText className="w-4 h-4 text-emerald-700" />
                      <span>{uploadedGstDoc}</span>
                    </span>
                    <span className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded">
                      Uploaded ✓
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Create Password *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#051F16]"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                  />
                  <span className="text-xs text-slate-600 leading-snug">
                    I declare that all machinery specifications and statutory
                    registrations are authentic and agree to MPI quality audits.
                  </span>
                </label>
              </div>

              <div className="pt-4">
                <MPIButton
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Registering Supplier..."
                    : "Complete Onboarding & Enter MSME Portal →"}
                </MPIButton>
              </div>
            </form>
          )}

          {/* ── Action Buttons Footer ────────────────────────────────────────── */}
          {currentStep < 11 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-8">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 1}
                className={`text-xs font-bold px-4 py-2 rounded-lg border transition-colors cursor-pointer ${
                  currentStep === 1
                    ? "text-slate-300 border-slate-100 cursor-not-allowed"
                    : "text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                ← Back
              </button>

              <MPIButton variant="primary" onClick={handleNext}>
                <span>Continue to Step {currentStep + 1}</span>
                <Icons.ArrowRight className="w-4 h-4" />
              </MPIButton>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
