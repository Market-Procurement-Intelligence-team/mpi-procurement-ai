/** Log in with email and password. Signed-in people go straight to their area. */

import { useState, type FormEvent } from "react"
import { Link, Navigate, useLocation } from "react-router"
import { homeFor, useSession } from "../../app/session"
import { signIn } from "../../services/data/auth"
import Button from "../../ui/Button"
import AuthLayout from "./AuthLayout"
import { EMAIL_PATTERN, FormAlert, messageOf, PasswordField, TextField } from "./fields"

const LINK = "font-semibold text-navy underline-offset-4 hover:underline"

export default function LoginPage() {
  const { state } = useSession()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status === "signedIn") {
    // Back to the page they were trying to open, if it's in their own area.
    const from = (location.state as { from?: string } | null)?.from
    const home = homeFor(state.role)
    return <Navigate to={from && from.startsWith(home) ? from : home} replace />
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const badEmail = !email.trim() ? "Please enter your email." : !EMAIL_PATTERN.test(email.trim()) ? "Please enter a full email, like name@company.in." : null
    const badPassword = !password ? "Please enter your password." : null
    setEmailError(badEmail)
    setPasswordError(badPassword)
    setError(null)
    if (badEmail || badPassword) {
      event.currentTarget.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus()
      return
    }
    setBusy(true)
    try {
      await signIn(email, password)
      // The session picks up the sign-in and this page sends them on.
    } catch (err) {
      setError(messageOf(err, "Couldn't log in. Please try again."))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Log in"
      footer={
        <>
          New to MPI?{" "}
          <Link to="/signup" className={LINK}>
            Create an account
          </Link>
        </>
      }
    >
      <h1 className="text-[32px] leading-tight font-bold text-navy">Log in to your account</h1>
      <p className="mt-1.5 text-muted">Welcome back. Use the email you signed up with.</p>

      <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          aside={
            <Link to="/forgot-password" className={LINK} state={{ email }}>
              Forgot password?
            </Link>
          }
        />
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" busy={busy} className="h-12 w-full">
          {busy ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  )
}
