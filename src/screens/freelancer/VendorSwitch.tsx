/**
 * Freelancers and supplier businesses share the supplier area (/supplier).
 * These pick the right screen for each: freelancers land on their profile
 * builder; businesses keep their dashboard and business profile.
 */

import { Navigate } from "react-router"
import { useMe } from "../../app/session"
import SupplierOverview from "../overview/SupplierOverview"
import SupplierProfilePage from "../profile/SupplierProfilePage"
import FreelancerProfilePage from "./FreelancerProfilePage"

export const isFreelancer = (me: ReturnType<typeof useMe>) => me.organisation.provider_type === "individual"

export function SupplierHome() {
  const me = useMe()
  return isFreelancer(me) ? <Navigate to="/supplier/profile" replace /> : <SupplierOverview />
}

export function SupplierProfile() {
  const me = useMe()
  return isFreelancer(me) ? <FreelancerProfilePage /> : <SupplierProfilePage />
}
