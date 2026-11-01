import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Card from "./Card"

export default function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-8 text-center">
        <div className="mb-4 rounded-full bg-navy-tint p-4 text-navy">
          <Icon size={28} />
        </div>
        <h2 className="text-[22px] font-semibold text-navy">{title}</h2>
        {body && <p className="mt-2 max-w-md text-muted">{body}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </Card>
  )
}
