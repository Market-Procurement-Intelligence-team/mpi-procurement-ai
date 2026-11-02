import { useState, useRef, useEffect } from "react"
import { usePageLanguage } from "../../lib/languageTranslator"

interface LanguageTranslatorButtonProps {
  variant?: "default" | "minimal" | "navy"
  className?: string
}

export default function LanguageTranslatorButton({
  variant = "default",
  className = "",
}: LanguageTranslatorButtonProps) {
  const { currentLang, changeLanguage, supportedLanguages } = usePageLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption =
    supportedLanguages.find((l) => l.code === currentLang) || supportedLanguages[0]

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Globe + EN Button matching user's design reference */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer select-none backdrop-blur-md ${
          variant === "navy"
            ? "bg-[#051F16]/85 hover:bg-[#083A28]/92 text-slate-200 border border-white/20 hover:text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
            : "bg-white/85 hover:bg-white text-slate-700 hover:text-[#051F16] border border-slate-200/90 hover:border-slate-300 shadow-2xs"
        }`}
        title="Translate webpage language / भाषा बदलें"
        aria-label="Language translator"
      >
        {/* Clean Line Globe Icon matching reference image */}
        <svg
          className="w-4 h-4 text-slate-600 group-hover:text-[#051F16] transition-colors shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>

        {/* Text code, e.g. EN, हिन्दी */}
        <span className="font-semibold tracking-wide uppercase text-slate-800">
          {selectedOption.label}
        </span>

        {/* Small chevron */}
        <span className={`text-[9px] text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Language Selection Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-fade-in text-xs font-medium">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Select Language</span>
            <span className="text-emerald-600 font-semibold">Instant</span>
          </div>

          <div className="max-h-60 overflow-y-auto py-0.5 space-y-0.5">
            {supportedLanguages.map((lang) => {
              const isSelected = lang.code === currentLang
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    changeLanguage(lang.code)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50 text-[#051F16] font-bold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono text-[11px] w-6 uppercase">
                      {lang.code}
                    </span>
                    <span>{lang.nativeName}</span>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#051F16]" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="px-3 pt-2 mt-1 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1.5">
            <span>🌐 Translates all pages</span>
          </div>
        </div>
      )}
    </div>
  )
}
