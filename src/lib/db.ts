import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"
import type { Database } from "./database.types"

/**
 * Typed handle to the MPI database. It is the same connection as `supabase`
 * (one login session for the whole app), with table and function types from
 * database.types.ts. New code uses `db`; the older services keep `supabase`
 * until they are replaced.
 */
export const db = supabase as unknown as SupabaseClient<Database>
