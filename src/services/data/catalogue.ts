/** Catalogue categories and items. Readable by everyone, including signed-out visitors. */

import { db } from "../../lib/db"
import type { Tables } from "../../lib/database.types"
import { unwrap } from "./errors"

export type Category = Tables<"catalogue_categories">
export type CatalogueItem = Tables<"catalogue_items">

export async function listCategories(): Promise<Category[]> {
  return unwrap(await db.from("catalogue_categories").select("*").eq("is_active", true).order("sort_order"))
}

export async function listItems(categoryId?: string): Promise<CatalogueItem[]> {
  let query = db.from("catalogue_items").select("*").eq("is_active", true).order("name")
  if (categoryId) query = query.eq("category_id", categoryId)
  return unwrap(await query)
}
