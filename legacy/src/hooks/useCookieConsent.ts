import { useState, useEffect, useCallback } from "react"
import {
  CookieCategories,
  CookieConsentRecord,
  getStoredConsent,
  hasUserDecided,
  saveConsent,
  acceptAllCookies,
  rejectOptionalCookies,
  hasConsent as checkHasConsent,
  resetConsent,
  onConsentChange,
  onOpenPreferencesRequest,
} from "../services/cookieConsentService"

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentRecord | null>(() => getStoredConsent())
  const [hasDecided, setHasDecided] = useState<boolean>(() => hasUserDecided())
  const [isBannerOpen, setIsBannerOpen] = useState<boolean>(false)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false)

  // Initialize on mount
  useEffect(() => {
    const stored = getStoredConsent()
    const decided = hasUserDecided()
    setConsent(stored)
    setHasDecided(decided)

    // Show banner after brief delay if no decision has been recorded yet
    if (!decided) {
      const timer = window.setTimeout(() => {
        setIsBannerOpen(true)
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [])

  // Listen to cross-component consent updates & open requests
  useEffect(() => {
    const unsubConsent = onConsentChange((updatedRecord) => {
      setConsent(updatedRecord)
      setHasDecided(Boolean(updatedRecord && updatedRecord.consentGiven))
      if (updatedRecord && updatedRecord.consentGiven) {
        setIsBannerOpen(false)
      } else {
        setIsBannerOpen(true)
      }
    })

    const unsubOpen = onOpenPreferencesRequest(() => {
      setIsPreferencesOpen(true)
    })

    return () => {
      unsubConsent()
      unsubOpen()
    }
  }, [])

  const handleAcceptAll = useCallback(() => {
    const record = acceptAllCookies()
    setConsent(record)
    setHasDecided(true)
    setIsBannerOpen(false)
    setIsPreferencesOpen(false)
  }, [])

  const handleRejectOptional = useCallback(() => {
    const record = rejectOptionalCookies()
    setConsent(record)
    setHasDecided(true)
    setIsBannerOpen(false)
    setIsPreferencesOpen(false)
  }, [])

  const handleSavePreferences = useCallback((categories: CookieCategories) => {
    const record = saveConsent(categories)
    setConsent(record)
    setHasDecided(true)
    setIsBannerOpen(false)
    setIsPreferencesOpen(false)
  }, [])

  const handleOpenPreferences = useCallback(() => {
    setIsPreferencesOpen(true)
  }, [])

  const handleClosePreferences = useCallback(() => {
    setIsPreferencesOpen(false)
  }, [])

  const handleDismissBanner = useCallback(() => {
    // If dismissed without choosing, retain essential only as safe default
    handleRejectOptional()
  }, [handleRejectOptional])

  const checkCategory = useCallback((category: keyof CookieCategories) => {
    return checkHasConsent(category)
  }, [])

  const handleReset = useCallback(() => {
    resetConsent()
    setConsent(null)
    setHasDecided(false)
    setIsBannerOpen(true)
  }, [])

  return {
    consent,
    hasDecided,
    isBannerOpen,
    isPreferencesOpen,
    acceptAll: handleAcceptAll,
    rejectOptional: handleRejectOptional,
    savePreferences: handleSavePreferences,
    openPreferences: handleOpenPreferences,
    closePreferences: handleClosePreferences,
    dismissBanner: handleDismissBanner,
    hasConsent: checkCategory,
    reset: handleReset,
  }
}
