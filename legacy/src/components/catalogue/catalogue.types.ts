import { CatalogCategory, CatalogService } from "../../lib/mpiCatalog"

export interface EnrichedCatalogProduct extends CatalogService {
  moq: string
  leadTime: string
  startingPrice: string
  specifications: string[]
  supplierBadge: string
  subsidiesEligible?: string[]
  materials?: string[]
  badge?: string
  highResImage?: string
}

export interface CategoryMetadata {
  id: CatalogCategory
  displayName: string
  subtitle: string
  description: string
  iconName: string
  sampleDeliverables: string[]
}
