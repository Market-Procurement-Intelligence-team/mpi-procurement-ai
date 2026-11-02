import { useEffect } from "react"

/**
 * useScrollReveal: Lightweight, hardware-accelerated viewport scroll reveal hook.
 * Automatically tracks all elements marked with `data-reveal` or `.scroll-reveal`
 * and triggers smooth cinematic entry animations with stagger support.
 */
export function useScrollReveal(dependency?: unknown) {
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return

    const elements = document.querySelectorAll<HTMLElement>("[data-reveal], .scroll-reveal")

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed")
            // Optional unobserve once revealed for peak performance
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      },
    )

    elements.forEach((el) => {
      // If already in viewport on load, reveal immediately
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add("is-revealed")
      } else {
        observer.observe(el)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [dependency])
}

export default useScrollReveal
