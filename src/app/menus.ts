import {
  Activity,
  FileText,
  Inbox,
  Landmark,
  LayoutDashboard,
  Package,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "./session"

export interface MenuItem {
  label: string
  /** Shorter name for the top bar on laptops; the phone menu shows `label`. */
  short?: string
  to: string
  icon: LucideIcon
}

/** Each role's menu in the top bar. Paths are relative to the role's area. */
export const MENUS: Record<Role, { area: string; title: string; items: MenuItem[] }> = {
  startup: {
    area: "/startup",
    title: "Startup",
    items: [
      { label: "Overview", to: "", icon: LayoutDashboard },
      { label: "My requests", to: "requests", icon: FileText },
      { label: "Orders", to: "orders", icon: Package },
      { label: "Schemes", to: "schemes", icon: Landmark },
      { label: "Profile", to: "profile", icon: UserRound },
    ],
  },
  vendor: {
    area: "/supplier",
    title: "Supplier",
    items: [
      { label: "Overview", to: "", icon: LayoutDashboard },
      { label: "Requests for you", to: "requests", icon: Inbox },
      { label: "My orders", to: "orders", icon: Package },
      { label: "Schemes", to: "schemes", icon: Landmark },
      { label: "Profile", to: "profile", icon: UserRound },
    ],
  },
  admin: {
    area: "/admin",
    title: "Admin",
    items: [
      { label: "Overview", to: "", icon: LayoutDashboard },
      { label: "AI matches to review", short: "AI matches", to: "matches", icon: Sparkles },
      { label: "Orders and messages", short: "Orders", to: "orders", icon: Package },
      { label: "Supplier verification", short: "Verification", to: "verification", icon: ShieldCheck },
      { label: "Payment terms", to: "payment-terms", icon: Wallet },
      { label: "Price offers and activity", short: "Activity", to: "activity", icon: Activity },
      { label: "Government schemes", short: "Schemes", to: "schemes", icon: Landmark },
      { label: "Demo workspace", short: "Demo", to: "demo", icon: RefreshCcw },
    ],
  },
}
