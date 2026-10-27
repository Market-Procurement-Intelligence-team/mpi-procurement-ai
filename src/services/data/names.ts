/**
 * Anonymous names. Startups and suppliers only ever see each other as
 * "MPI Verified Buyer #004" / "MPI Verified Supplier #001", read from the
 * org_public view. Only the admin sees real company names.
 */

import { db } from "../../lib/db"
import { unwrap } from "./errors"

/** Maps organisation ids to their anonymous display names. */
export async function getDisplayNames(orgIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(orgIds)]
  if (!ids.length) return new Map()
  const rows = unwrap(await db.from("org_public").select("id, display_name").in("id", ids))
  return new Map(rows.flatMap((r) => (r.id && r.display_name ? [[r.id, r.display_name] as const] : [])))
}
