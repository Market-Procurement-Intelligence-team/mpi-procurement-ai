/**
 * A simple working login, so the app can be used while the real login and
 * sign-up screens are designed (they are the first screens we build).
 */

import { useState, type FormEvent } from "react"
import { Navigate } from "react-router"
import { CircleAlert } from "lucide-react"
import { homeFor, useSession } from "../../app/session"
import { signIn } from "../../services/data/auth"
import Button from "../../ui/Button"
import Card from "../../ui/Card"

export default function LoginPlaceholder() {
  const { state } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.status === "signedIn") return <Navigate to={homeFor(state.role)} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      // The session then sends the person to their own area.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.")
      setBusy(false)
    }
  }

  const input =
    "mt-1.5 block h-12 w-full rounded-md border-[1.5px] border-input bg-white px-3 text-navy focus:border-orange focus:outline-none"

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-navy">MPI</div>
          <p className="mt-1 text-muted">AI-powered sourcing for startups and verified MSMEs</p>
        </div>
        <Card accent>
          <h1 className="text-[22px] font-semibold text-navy">Sign in</h1>
          <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
            <label className="block text-sm font-semibold text-navy">
              Email
              <input className={input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-navy">
              Password
              <input
                className={input}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="flex items-start gap-2 rounded-md bg-red-tint p-3 text-sm text-red-text" role="alert">
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" busy={busy} disabled={!email || !password} className="w-full">
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-muted">Sign-up and password reset come with the real login screens.</p>
      </div>
    </div>
  )
}
