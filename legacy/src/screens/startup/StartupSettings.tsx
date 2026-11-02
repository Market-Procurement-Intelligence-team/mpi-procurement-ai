import React, { useState } from "react"
import { Screen } from "../../App"
import { Icons, MPIButton } from "../../components/design-system/MPIDesignSystem"
import { StartupBusinessProfile } from "../../context/ProcurementContext"

interface StartupSettingsProps {
  startupProfile: StartupBusinessProfile
  updateStartupProfile: (profile: Partial<StartupBusinessProfile>) => void
  navigate: (screen: Screen) => void
}

export default function StartupSettings({
  startupProfile,
  updateStartupProfile,
  navigate,
}: StartupSettingsProps) {
  const [founderName, setFounderName] = useState(startupProfile.founderName || "")
  const [startupName, setStartupName] = useState(startupProfile.startupName || "")
  const [email, setEmail] = useState(startupProfile.email || "")
  const [phone, setPhone] = useState(startupProfile.phone || "")
  const [city, setCity] = useState(startupProfile.city || "Bengaluru")
  const [state, setState] = useState(startupProfile.state || "Karnataka")
  const [annualBudget, setAnnualBudget] = useState(
    startupProfile.annualProcurementBudget || 2000000
  )
  const [turnaroundPriority, setTurnaroundPriority] = useState(
    startupProfile.turnaroundPriority || "Standard"
  )
  const [hasDpiit, setHasDpiit] = useState<boolean>(
    Boolean(startupProfile.hasDpiit ?? true)
  )
  const [dpiitNumber, setDpiitNumber] = useState(
    startupProfile.dpiitNumber || "DIPP104829"
  )
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateStartupProfile({
      founderName,
      startupName,
      email,
      phone,
      city,
      state,
      annualProcurementBudget: Number(annualBudget),
      turnaroundPriority: turnaroundPriority as any,
      hasDpiit,
      dpiitNumber,
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Account Governance
          </span>
          <h2
            className="text-xl font-extrabold text-[#051F16] mt-0.5"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Startup Profile & Procurement Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your statutory DPIIT credentials, annual sourcing threshold,
            and escrow parameters.
          </p>
        </div>
        <MPIButton
          variant="outline"
          size="sm"
          onClick={() => navigate("startup.home")}
        >
          ← Return to Dashboard
        </MPIButton>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <Icons.Check className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully. Sourcing parameters updated.</span>
          </div>
          <button
            onClick={() => setSavedSuccess(false)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Information */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Icons.Building className="w-4 h-4 text-[#051F16]" />
            <span>Organization & Legal Identity</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Startup / Entity Name
              </label>
              <input
                type="text"
                value={startupName}
                onChange={(e) => setStartupName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Founder / Authorized Signatory
              </label>
              <input
                type="text"
                value={founderName}
                onChange={(e) => setFounderName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Registered Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Direct Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Manufacturing / Headquarter City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                State / Territory
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
              />
            </div>
          </div>
        </div>

        {/* Statutory & DPIIT Credentials */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Icons.ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Statutory DPIIT & Government Benefits</span>
          </h3>

          <div className="flex items-center gap-3 p-3 bg-[#F4FBF7] rounded-xl border border-emerald-200/80">
            <input
              type="checkbox"
              id="dpiitCheck"
              checked={hasDpiit}
              onChange={(e) => setHasDpiit(e.target.checked)}
              className="w-4 h-4 text-[#051F16] rounded border-slate-300 focus:ring-[#A3F65C]"
            />
            <label htmlFor="dpiitCheck" className="text-xs text-slate-700 font-semibold cursor-pointer">
              Startup India DPIIT Recognized (Unlocks up to 80% testing and patent subsidies)
            </label>
          </div>

          {hasDpiit && (
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">
                DPIIT Certificate Registration Number
              </label>
              <input
                type="text"
                value={dpiitNumber}
                onChange={(e) => setDpiitNumber(e.target.value)}
                placeholder="e.g. DIPP104829"
                className="w-full sm:w-80 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
              />
            </div>
          )}
        </div>

        {/* Commercial Budget & Sourcing Parameters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Icons.Coins className="w-4 h-4 text-[#051F16]" />
            <span>Procurement Governance & Escrow Threshold</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Annual Procurement Allocation (₹)
              </label>
              <input
                type="number"
                value={annualBudget}
                onChange={(e) => setAnnualBudget(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
                step="50000"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Formatted: ₹{Number(annualBudget).toLocaleString("en-IN")}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Turnaround Priority Default
              </label>
              <select
                value={turnaroundPriority}
                onChange={(e) => setTurnaroundPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#A3F65C]/50 focus:border-[#051F16]"
              >
                <option value="Standard">Standard (15-20 Days SLA)</option>
                <option value="Urgent (<10 days)">Urgent Priority (&lt;10 Days SLA)</option>
                <option value="Cost Priority">Cost Optimization (Flexible Delivery)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <MPIButton
            variant="outline"
            size="md"
            onClick={() => navigate("startup.home")}
          >
            Cancel
          </MPIButton>
          <MPIButton
            variant="primary"
            size="md"
            icon={<Icons.Check className="w-4 h-4" />}
          >
            Save Account Settings
          </MPIButton>
        </div>
      </form>
    </div>
  )
}
