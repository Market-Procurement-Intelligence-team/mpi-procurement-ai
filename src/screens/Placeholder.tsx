import { Hammer } from "lucide-react"
import EmptyState from "../ui/EmptyState"
import PageHeader from "../ui/PageHeader"

/** Stands in for a menu page until its real screen is built. */
export default function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={Hammer} title="Coming next" body="This page is being built. Everything behind it is already working." />
    </>
  )
}
