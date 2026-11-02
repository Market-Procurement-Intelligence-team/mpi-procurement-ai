import React from "react"
import { useCookieConsent } from "../../hooks/useCookieConsent"
import CookieConsentBanner from "./CookieConsentBanner"
import CookiePreferencesModal from "./CookiePreferencesModal"

export const CookieConsentExperience: React.FC = () => {
  const {
    consent,
    isBannerOpen,
    isPreferencesOpen,
    acceptAll,
    rejectOptional,
    savePreferences,
    openPreferences,
    closePreferences,
  } = useCookieConsent()

  return (
    <>
      <CookieConsentBanner
        isOpen={isBannerOpen && !isPreferencesOpen}
        onAcceptAll={acceptAll}
        onRejectOptional={rejectOptional}
        onOpenPreferences={openPreferences}
      />

      <CookiePreferencesModal
        isOpen={isPreferencesOpen}
        currentConsent={consent}
        onClose={closePreferences}
        onSavePreferences={savePreferences}
        onAcceptAll={acceptAll}
        onRejectOptional={rejectOptional}
      />
    </>
  )
}

export default CookieConsentExperience
