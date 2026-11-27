import type { Builder } from "../useBuilder"

/** What every builder section gets. */
export interface SectionProps {
  b: Builder
  orgId: string
  reload: () => Promise<void>
  toast: (text: string) => void
}
