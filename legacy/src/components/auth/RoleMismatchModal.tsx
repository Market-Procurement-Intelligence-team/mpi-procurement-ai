import { RoleKey } from "../../lib/mockAuth"
import MaterialIcon from "../ui/MaterialIcon"

export interface RoleMismatchModalProps {
  isOpen: boolean
  currentRole: RoleKey | null
  requiredRole: RoleKey
  actionName?: string
  onClose: () => void
  onSwitchAccount: (targetRole: RoleKey) => void
  onContinueCurrentRole: (currentRole: RoleKey) => void
}

export default function RoleMismatchModal({
  isOpen,
  currentRole,
  requiredRole,
  actionName = "this action",
  onClose,
  onSwitchAccount,
  onContinueCurrentRole,
}: RoleMismatchModalProps) {
  if (!isOpen) return null

  const roleLabels: Record<RoleKey, { title: string; badge: string; icon: string }> = {
    startup: {
      title: "Startup Buyer",
      badge: "Buyer Account",
      icon: "rocket_launch",
    },
    msme: {
      title: "Verified MSME Manufacturer",
      badge: "Supplier Account",
      icon: "precision_manufacturing",
    },
    admin: {
      title: "Platform Administrator",
      badge: "Admin Access",
      icon: "admin_panel_settings",
    },
  }

  const currentInfo = currentRole ? roleLabels[currentRole] : null
  const requiredInfo = roleLabels[requiredRole]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 bg-amber-50/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm border border-amber-300">
              <MaterialIcon name="manage_accounts" size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#051F16] tracking-tight">
                Role Transition Required
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Access permission for {requiredInfo.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            You are currently signed in as a{" "}
            <span className="font-bold text-slate-900 underline decoration-amber-400">
              {currentInfo ? currentInfo.title : "different account"}
            </span>
            . The action{" "}
            <span className="font-bold text-slate-900">"{actionName}"</span> is specifically
            designed for{" "}
            <span className="font-bold text-slate-900">{requiredInfo.title}s</span>.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Current Account:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <MaterialIcon name={currentInfo?.icon || "person"} size={14} className="text-slate-600" />
                <span>{currentInfo?.title}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Required Access:</span>
              <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                <MaterialIcon name={requiredInfo.icon} size={14} className="text-emerald-700" />
                <span>{requiredInfo.title}</span>
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => onSwitchAccount(requiredRole)}
              className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer border border-[#0A3525]"
            >
              <MaterialIcon name="swap_horiz" size={16} className="text-[#A3F65C]" />
              <span>Switch to {requiredInfo.title} Account</span>
            </button>

            {currentRole && (
              <button
                type="button"
                onClick={() => onContinueCurrentRole(currentRole)}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              >
                <span>Continue to {currentInfo?.title} Dashboard</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Dismiss and stay on page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
