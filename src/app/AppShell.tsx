/**
 * The frame around every signed-in page: a dark top bar with the MPI logo,
 * the role's menu, notifications and the account menu, then the page itself.
 * On phones and small laptops the menu opens from the menu button.
 */

import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { Bell, ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react"
import { signOut } from "../services/data/auth"
import { countUnread } from "../services/data/notifications"
import MpiLogo from "../ui/brand/MpiLogo"
import { MENUS } from "./menus"
import { useSession, type Role } from "./session"

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

export default function AppShell({ role }: { role: Role }) {
  const { state } = useSession()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const accountRef = useRef<HTMLDivElement>(null)
  const menu = MENUS[role]

  // Close the menus after moving to another page.
  useEffect(() => {
    setMenuOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    countUnread()
      .then(setUnread)
      .catch(() => setUnread(0))
  }, [location.pathname])

  // Close the account menu on a click outside it, or on Escape.
  useEffect(() => {
    if (!accountOpen) return
    const onClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setAccountOpen(false)
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [accountOpen])

  const me = state.status === "signedIn" ? state.me : null
  const personName = me?.profile.full_name || me?.email || ""
  const orgName = me?.organisation.display_name || me?.organisation.name || ""

  const linkTo = (to: string) => (to ? `${menu.area}/${to}` : menu.area)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-ink text-white shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8 xl:gap-8 xl:px-10">
          {/* Logo */}
          <Link to={menu.area} className="flex shrink-0 items-center gap-2.5 rounded-md" aria-label="MPI home">
            <MpiLogo wordmark={false} className="w-11" />
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold tracking-tight">MPI</span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-nav-muted">{menu.title}</span>
            </span>
          </Link>

          {/* Menu, on laptops */}
          <nav className="hidden h-full items-center gap-1.5 lg:flex xl:gap-3" aria-label="Main">
            {menu.items.map((item) => (
              <NavLink
                key={item.label}
                to={linkTo(item.to)}
                end={!item.to}
                title={item.short ? item.label : undefined}
                className={({ isActive }) =>
                  `flex h-10 items-center self-center whitespace-nowrap rounded-md px-3 text-[15px] xl:px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/70 ${
                    isActive ? "bg-orange/25 text-white ring-0 ring-inset ring-orange/50" : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {item.short ?? item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="relative rounded-md p-2 text-white/85 hover:bg-white/10 hover:text-white"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell size={22} />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-red px-1 text-center text-xs font-bold leading-5 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {/* Account */}
            <div className="relative hidden sm:block" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-3 rounded-md py-1.5 pl-3 pr-2 hover:bg-white/10"
              >
                <span className="max-w-48 text-right leading-tight xl:max-w-none">
                  <span className="block truncate text-sm font-semibold xl:whitespace-nowrap">{orgName}</span>
                  <span className="block truncate text-xs text-nav-muted">{personName}</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange text-sm font-bold text-navy">
                  {initialsOf(personName || orgName)}
                </span>
                <ChevronDown size={16} className="text-nav-muted" />
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-lg border-[1.5px] border-line bg-white text-navy shadow-lg"
                >
                  <div className="border-b border-line px-4 py-3 text-sm">
                    <div className="truncate font-semibold">{orgName}</div>
                    <div className="truncate text-muted">{me?.email}</div>
                  </div>
                  <Link
                    to={`${menu.area}/profile`}
                    role="menuitem"
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-[15px] font-medium hover:bg-navy-tint"
                  >
                    <UserRound size={18} className="text-muted" />
                    Profile and settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void signOut()}
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-[15px] font-medium hover:bg-navy-tint"
                  >
                    <LogOut size={18} className="text-muted" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-md p-2 text-white hover:bg-white/10 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="phone-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        <div className="accent-line h-[3px]" />

        {/* Menu, on phones and small laptops */}
        {menuOpen && (
          <nav id="phone-menu" className="border-t border-white/10 bg-ink px-4 pb-4 pt-2 lg:hidden" aria-label="Main">
            {menu.items.map((item) => (
              <NavLink
                key={item.label}
                to={linkTo(item.to)}
                end={!item.to}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-md px-3 text-[16px] font-medium ${
                    isActive ? "bg-orange/20 text-white" : "text-white/85 hover:bg-white/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} className={isActive ? "text-white" : "text-nav-muted"} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
            <div className="mt-3 border-t border-white/10 pt-3 sm:hidden">
              <div className="px-3 text-sm">
                <div className="truncate font-semibold">{orgName}</div>
                <div className="truncate text-nav-muted">{personName}</div>
              </div>
              {role === "admin" && (
                <Link to={`${menu.area}/profile`} className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-white hover:bg-white/5">
                  <UserRound size={20} className="text-nav-muted" />
                  Profile and settings
                </Link>
              )}
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-white hover:bg-white/5"
              >
                <LogOut size={20} className="text-nav-muted" />
                Sign out
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
        <Outlet />
      </main>
    </div>
  )
}
