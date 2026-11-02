import { useEffect, useState } from "react"

export interface LanguageOption {
  code: string
  label: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "EN", nativeName: "English" },
  { code: "hi", label: "हिन्दी", nativeName: "हिन्दी (Hindi)" },
  { code: "ta", label: "தமிழ்", nativeName: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు", nativeName: "తెలుగు (Telugu)" },
  { code: "mr", label: "मराठी", nativeName: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা", nativeName: "বাংলা (Bengali)" },
  { code: "gu", label: "ગુજરાતી", nativeName: "ગુજરાતી (Gujarati)" },
  { code: "kn", label: "ಕನ್ನಡ", nativeName: "ಕನ್ನಡ (Kannada)" },
]

declare global {
  interface Window {
    google: any
    googleTranslateElementInit?: () => void
  }
}

let googleTranslateScriptLoaded = false

export function initGoogleTranslateScript() {
  if (typeof window === "undefined" || googleTranslateScriptLoaded) return

  // Define global init callback
  window.googleTranslateElementInit = () => {
    if (window.google && window.google.translate) {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,hi,ta,te,mr,bn,gu,kn",
          autoDisplay: false,
        },
        "google_translate_element"
      )
    }
  }

  // Create script element
  const script = document.createElement("script")
  script.id = "google-translate-script"
  script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
  script.async = true
  document.body.appendChild(script)
  googleTranslateScriptLoaded = true
}

export function setPageLanguage(langCode: string) {
  if (typeof window === "undefined") return

  // Save selection
  localStorage.setItem("mpi_user_language", langCode)

  if (langCode === "en") {
    // Reset cookie for English
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname
    
    // Also try combo select if present
    const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo")
    if (combo) {
      combo.value = "en"
      combo.dispatchEvent(new Event("change"))
    } else {
      window.location.reload()
    }
    return
  }

  // Set googtrans cookie: /en/<target>
  const cookieVal = `/en/${langCode}`
  document.cookie = `googtrans=${cookieVal}; path=/;`
  document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname};`

  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo")
  if (combo) {
    combo.value = langCode
    combo.dispatchEvent(new Event("change"))
  } else {
    // Ensure translate script runs then reloads to apply cookie
    initGoogleTranslateScript()
    setTimeout(() => {
      window.location.reload()
    }, 150)
  }
}

export function usePageLanguage() {
  const [currentLang, setCurrentLang] = useState<string>("en")

  useEffect(() => {
    initGoogleTranslateScript()
    const saved = localStorage.getItem("mpi_user_language")
    if (saved) {
      setCurrentLang(saved)
    } else {
      // Check cookie
      const match = document.cookie.match(/googtrans=\/en\/([a-z]{2})/i)
      if (match && match[1]) {
        setCurrentLang(match[1])
      }
    }
  }, [])

  const changeLanguage = (code: string) => {
    setCurrentLang(code)
    setPageLanguage(code)
  }

  return { currentLang, changeLanguage, supportedLanguages: SUPPORTED_LANGUAGES }
}
