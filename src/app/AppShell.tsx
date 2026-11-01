/**
 * The frame around every signed-in page: navy sidebar with the role's menu,
 * a top bar with notifications and the account menu, and the page itself.
 * On phones the sidebar opens from the menu button.
 */

import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router"
import { Bell, LogOut, Menu, X } from "lucide-react"
import { signOut } from "../services/data/auth"
import { countUnread } from "../services/data/notifications"
import { MENUS } from "./menus"
import { useSession, type Role } from "./session"

export default function AppShell({ role }: { role: Role }) {
  const { state } = useSession()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const menu = MENUS[role]

  // Close the phone menu after moving to another page.
  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    countUnread()
      .then(setUnread)
      .catch(() => setUnread(0))
  }, [location.pathname])

  const me = state.status === "signedIn" ? state.me : null
  const personName = me?.profile.full_name || me?.email || ""
  const orgName = me?.organisation.name ?? ""

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <div className="text-xl font-bold tracking-tight">MPI</div>
            <div className="text-xs text-nav-muted">{menu.title}</div>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-nav-muted hover:bg-navy-2 lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
        <div className="accent-line h-1" />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
          {menu.items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to ? `${menu.area}/${item.to}` : menu.area}
              end={!item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-md border-l-4 px-3 text-[15px] font-medium ${
                  isActive
                    ? "border-orange bg-navy-2 text-orange"
                    : "border-transparent text-white hover:bg-navy-2"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={isActive ? "text-orange" : "text-nav-muted"} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-navy-2 p-4 text-sm">
          <div className="truncate font-semibold">{orgName}</div>
          <div className="truncate text-nav-muted">{personName}</div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-white hover:bg-navy-2"
          >
            <LogOut size={18} className="text-nav-muted" />
            Sign out
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-navy/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Page */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-[1.5px] border-line bg-white px-4 sm:px-8">
          <button
            type="button"
            className="rounded-md p-2 text-navy hover:bg-navy-tint lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <div className="hidden text-sm text-muted lg:block">{me?.organisation.display_name}</div>
          <button
            type="button"
            className="relative rounded-md p-2 text-navy hover:bg-navy-tint"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <Bell size={22} />
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-red px-1 text-center text-xs font-bold leading-5 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
