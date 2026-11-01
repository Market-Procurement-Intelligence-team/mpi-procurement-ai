import type { ReactNode } from "react"
import { LoaderCircle } from "lucide-react"

/** A centred message on its own page, for loading, errors and "not found". */
export default function FullPageMessage({
  title,
  body,
  action,
  loading = false,
}: {
  title: string
  body?: string
  action?: ReactNode
  loading?: boolean
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center" role={loading ? "status" : "alert"}>
      {loading && <LoaderCircle size={32} className="mb-4 animate-spin text-navy" aria-hidden="true" />}
      <h1 className="text-[22px] font-semibold text-navy">{title}</h1>
      {body && <p className="mt-2 max-w-md text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
