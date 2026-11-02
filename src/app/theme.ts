/**
 * The person's light / dark / system choice, kept in this browser.
 * The dark colours aren't designed yet, so for now the choice is only
 * remembered and put on <html data-theme-choice="…">; the app stays light.
 */

import { useCallback, useEffect, useState } from "react"

export type ThemeChoice = "light" | "dark" | "system"

const KEY = "mpi.theme"

export function readThemeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === "dark" || value === "system" ? value : "light"
  } catch {
    return "light"
  }
}

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.themeChoice = choice
}

export function useThemeChoice() {
  const [choice, setChoiceState] = useState<ThemeChoice>(readThemeChoice)
  useEffect(() => apply(choice), [choice])
  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private windows can block storage; the choice then lasts until reload.
    }
  }, [])
  return [choice, setChoice] as const
}
