import { useEffect, useState } from "react"
import { NavProps } from "../App"
import { BackButton, MPILogo } from "../components/shared"

export default function Landing({ navigate, goBack, canGoBack }: NavProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 60)
    return () => clearTimeout(t)
  }, [])

  const roles = [
    {
      key: "startup",
      target: "login.startup" as const,
      label: "Startups & Buyers",
      sub: "Procurement Sourcing",
      badge: "Buyer Portal",
      desc: "Formulate plain-language requirements into verified MSME matches, automated quote comparisons, and decision-ready RFQs.",
      features: [
        "AI requirement analysis",
        "Side-by-side quote comparison",
        "Verified supplier directory",
      ],
      cta: "Enter as Startup",
      color: "#051F16",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      btnClass: "bg-[#051F16] hover:bg-[#083A28] text-white",
    },
    {
      key: "msme",
      target: "login.msme" as const,
      label: "MSMEs & Suppliers",
      sub: "Manufacturing & Services",
      badge: "Supplier Portal",
      desc: "Complete statutory verification, showcase machine capacities, and respond directly to high-intent procurement inquiries.",
      features: [
        "MPI verified badge",
        "Direct RFQ invitations",
        "Real-time proposal tracker",
      ],
      cta: "Enter as MSME",
      color: "#051F16",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      btnClass: "bg-[#051F16] hover:bg-[#083A28] text-white",
    },
    {
      key: "admin",
      target: "login.admin" as const,
      label: "Platform Governance",
      sub: "Control & Compliance",
      badge: "Admin Console",
      desc: "Comprehensive oversight of compliance audits, matching algorithm health, and end-to-end procurement workflows.",
      features: [
        "Verification review queue",
        "AI matching audit log",
        "Ecosystem macro analytics",
      ],
      cta: "Admin Console",
      color: "#0F172A",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      btnClass: "bg-slate-900 hover:bg-slate-800 text-white",
    },
  ]

  return (
    <div className="min-h-screen animated-gradient flex flex-col font-sans">
      {canGoBack && (
        <div className="w-full max-w-6xl mx-auto px-6 pt-5">
          <BackButton onClick={goBack} />
        </div>
      )}

      {/* Top navigation */}
      <nav className="glass-nav sticky top-0 z-50 px-8 py-3.5 flex items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <MPILogo />
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("home")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            ⌘ Dashboard
          </button>
          <button
            onClick={() => navigate("login.startup")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Startups
          </button>
          <button
            onClick={() => navigate("login.msme")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Suppliers
          </button>
          <button
            onClick={() => navigate("home")}
            className="btn-primary text-xs py-1.5 px-3 rounded-lg"
          >
            Launch App →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 max-w-6xl mx-auto w-full">
        {/* Eyebrow Pill */}
        <div
          className={`animate-fade-in-up delay-100 ${show ? "" : "opacity-0"}`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-6 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            AI-Powered B2B Procurement Intelligence
          </div>
        </div>

        {/* Headline */}
        <div
          className={`text-center max-w-3xl animate-fade-in-up delay-200 ${
            show ? "" : "opacity-0"
          }`}
        >
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-5"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Enterprise Procurement,{" "}
            <span className="text-emerald-700">Accelerated by AI.</span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Connect high-growth startups with vetted MSME manufacturers and
            service providers. From specification drafting to final quote
            comparison in days, not weeks.
          </p>
        </div>

        {/* Role cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full animate-fade-in-up delay-300 ${
            show ? "" : "opacity-0"
          }`}
        >
          {roles.map((role) => (
            <div
              key={role.key}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${role.badgeClass}`}
                  >
                    {role.badge}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {role.sub}
                  </span>
                </div>

                <h3
                  className="text-xl font-bold text-slate-900 mb-2"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  {role.label}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  {role.desc}
                </p>

                <div className="space-y-2 mb-6 pt-4 border-t border-slate-100">
                  {role.features.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-2 text-xs text-slate-700 font-medium"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="text-emerald-600 shrink-0"
                      >
                        <circle cx="8" cy="8" r="7" fill="#ECFDF5" />
                        <path
                          d="M5 8L7 10L11 6"
                          stroke="#059669"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigate(role.target)}
                className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${role.btnClass}`}
              >
                <span>{role.cta}</span>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3L11 8L6 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Stats Row */}
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 w-full max-w-4xl p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs animate-fade-in-up delay-400 ${
            show ? "" : "opacity-0"
          }`}
        >
          {[
            { label: "Verified Suppliers", value: "2,400+" },
            { label: "Procurement Requests", value: "8,700+" },
            { label: "Match Accuracy Rate", value: "94.2%" },
            { label: "Avg. Turnaround Saved", value: "11 Days" },
          ].map((s) => (
            <div key={s.label} className="text-center px-3 py-1">
              <div
                className="text-2xl font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                {s.value}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Compliance & Trust Banner */}
        <div
          className={`mt-8 animate-fade-in delay-500 ${
            show ? "" : "opacity-0"
          }`}
        >
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-100/80 border border-slate-200 text-xs text-slate-500">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="text-slate-700"
            >
              <path
                d="M8 2L13 4V8C13 11 10.5 13.5 8 14C5.5 13.5 3 11 3 8V4L8 2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
              <path
                d="M6 8L7.5 9.5L10.5 6.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>
              Aligned with government MSME initiatives · End-to-end verified
              audit trail · Secure RFQ workspace
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
