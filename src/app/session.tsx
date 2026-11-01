/**
 * Who is signed in, shared with every screen. Wraps getMe() from the data
 * layer and follows sign-in / sign-out as they happen.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { getMe, getSession, onAuthChange, type Me } from "../services/data/auth"

export type Role = Me["profile"]["role"]

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "signedIn"; me: Me; role: Role }

interface SessionValue {
  state: SessionState
  /** Reloads the signed-in person, e.g. after they edit their profile. */
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

/** The home page of each role's area. */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin"
  if (role === "vendor") return "/supplier"
  return "/startup"
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [state, setState] = useState<SessionState>({ status: "loading" })

  const load = useCallback(async () => {
    try {
      const me = await getMe()
      setState(me ? { status: "signedIn", me, role: me.profile.role } : { status: "signedOut" })
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Something went wrong." })
    }
  }, [])

  // Only remember who is signed in here: Supabase asks not to call it again
  // from inside its own sign-in listener.
  useEffect(() => {
    getSession()
      .then((session) => setUserId(session?.user.id ?? null))
      .catch(() => setUserId(null))
    return onAuthChange((session) => setUserId(session?.user.id ?? null))
  }, [])

  useEffect(() => {
    if (userId === undefined) return
    if (userId === null) {
      setState({ status: "signedOut" })
      return
    }
    setState({ status: "loading" })
    void load()
  }, [userId, load])

  return <SessionContext.Provider value={{ state, refresh: load }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error("useSession must be used inside SessionProvider")
  return value
}

/** The signed-in person; only for screens inside a role's area. */
export function useMe(): Me {
  const { state } = useSession()
  if (state.status !== "signedIn") throw new Error("useMe needs a signed-in person")
  return state.me
}
