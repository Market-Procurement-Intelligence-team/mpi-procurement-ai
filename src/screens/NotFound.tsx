import { Link } from "react-router"
import FullPageMessage from "../ui/FullPageMessage"

export default function NotFound() {
  return (
    <FullPageMessage
      title="Page not found"
      body="This page doesn't exist."
      action={
        <Link to="/" className="font-semibold text-navy underline">
          Go to MPI home
        </Link>
      }
    />
  )
}
