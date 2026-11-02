import { Navigate, Outlet, useLocation } from "react-router"
import FullPageMessage from "../ui/FullPageMessage"
import { homeFor, useSession, type Role } from "./session"

/** Lets only the given role in. Others go to login, or to their own area. */
export default function RequireRole({ role }: { role: Role }) {
  const { state } = useSession()
  const location = useLocation()

  if (state.status === "loading") return <FullPageMessage loading title="Loading MPI" />
  if (state.status === "error") return <FullPageMessage title="Couldn't load your account" body={state.message} />
  if (state.status === "signedOut") return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (state.role !== role) return <Navigate to={homeFor(state.role)} replace />
  return <Outlet />
}
