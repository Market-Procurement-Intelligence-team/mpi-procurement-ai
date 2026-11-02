/**
 * The frame for log in, sign up and password pages.
 *
 * One box centred on the page. Laptop: the dark brand panel with the animated
 * MPI swirl and what MPI does on the left, the form on the right. Phone: just
 * the form, with a small logo.
 * The panel uses the logo's own dark background (ink), and the logo there is
 * the animated one.
 */

import { useEffect, type ReactNode } from "react"
import { BadgeCheck, Sparkles } from "lucide-react"
import emblem from "../../assets/brand/mpi-emblem-dark.webp"
import MpiLogo from "../../ui/brand/MpiLogo"

const POINTS = [
  { icon: BadgeCheck, title: "Verified MSMEs only", body: "Every supplier is checked by MPI before they get requests." },
  { icon: Sparkles, title: "AI reads your request", body: "Describe what you need in your own words, typed or spoken." },
]

export default function AuthLayout({
  title,
  children,
  footer,
}: {
  /** Browser tab title for this page. */
  title: string
  children: ReactNode
  /** Line under the card, e.g. "New to MPI? Create an account". */
  footer?: ReactNode
}) {
  useEffect(() => {
    document.title = `${title} · MPI`
  }, [title])

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-6">
      {/* One box in the middle of the page, as in the Stitch design: dark brand panel on the left, form on the right. */}
      <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border-[1.5px] border-line bg-white shadow-[0_12px_40px_rgba(21,35,61,0.12)] lg:grid lg:max-w-[1200px] lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-14 py-10 text-white lg:flex [@media(max-height:820px)]:py-8">
          {/* soft glows, like Stitch */}
          <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-orange/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-navy-2/40 blur-2xl" aria-hidden="true" />

          <div className="relative mx-auto flex w-full max-w-md flex-col items-center text-center">
            <MpiLogo wordmark={false} className="w-56 xl:w-60 [@media(max-height:820px)]:w-40" />
            <h2 className="mt-6 text-[34px] leading-[1.18] font-bold [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:text-[26px]">
              Sourcing for startups, from verified Indian MSMEs.
            </h2>
            <p className="mt-2.5 text-[16px] leading-relaxed text-nav-muted">
              Tell MPI what you need. AI finds matching suppliers, and the MPI team approves every match.
            </p>
            <ul className="mt-6 w-full space-y-2.5 text-left [@media(max-height:820px)]:mt-5 [@media(max-height:820px)]:space-y-2">
              {POINTS.map(({ icon: Icon, title: pointTitle, body }) => (
                <li key={pointTitle} className="flex items-center gap-3.5 rounded-lg bg-white/[0.06] px-3.5 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-orange/15 text-orange">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{pointTitle}</span>
                    <span className="block text-sm text-nav-muted [@media(max-height:820px)]:hidden">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative pt-6 text-center text-sm text-nav-muted [@media(max-height:820px)]:pt-5">Verified B2B sourcing for India</p>
        </aside>

        <main className="flex flex-col">
          <div className="accent-line h-1" />
          <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 lg:px-16 lg:py-12 [@media(max-height:820px)]:lg:py-6">
            <div className="mx-auto w-full max-w-[440px]">
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <img src={emblem} alt="" className="size-11 rounded-md" width={256} height={256} />
                <span className="leading-tight">
                  <span className="block text-xl font-bold text-navy">MPI</span>
                  <span className="block text-xs font-semibold tracking-wide text-muted uppercase">Market Procurement Intelligence</span>
                </span>
              </div>
              {children}
              {footer && <div className="mt-8 text-center text-[15px] text-muted [@media(max-height:820px)]:mt-4">{footer}</div>}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
