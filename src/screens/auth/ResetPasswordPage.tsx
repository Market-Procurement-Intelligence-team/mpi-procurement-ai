/**
 * Choose a new password. Opened from the reset email: Supabase reads the link
 * and signs the person in for this, so a signed-in session means the link
 * worked. No session means the link expired or was already used.
 */

import { useState, type FormEvent } from "react"
import { Link } from "react-router"
import { CircleCheck, LoaderCircle } from "lucide-react"
import { homeFor, useSession } from "../../app/session"
import { setNewPassword } from "../../services/data/auth"
import Button from "../../ui/Button"
import AuthLayout from "./AuthLayout"
import { FormAlert, messageOf, MIN_PASSWORD, PasswordField } from "./fields"

const LINK = "font-semibold text-navy underline-offset-4 hover:underline"

export default function ResetPasswordPage() {
  const { state } = useSession()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (state.status === "loading") {
    return (
      <AuthLayout title="Choose a new password">
        <div className="flex items-center justify-center gap-3 py-6 text-muted" role="status">
          <LoaderCircle size={22} className="animate-spin text-navy" aria-hidden="true" />
          Checking your link...
        </div>
      </AuthLayout>
    )
  }

  if (state.status !== "signedIn") {
    return (
      <AuthLayout title="Link expired">
        <h1 className="text-[32px] leading-tight font-bold text-navy">This link has expired</h1>
        <p className="mt-2 text-muted">Reset links work once and only for a short time. Ask for a new one and use it straight away.</p>
        <Link to="/forgot-password" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-md btn-gradient font-bold text-navy shadow-sm hover:brightness-95">
          Send a new link
        </Link>
        <p className="mt-4 text-center">
          <Link to="/login" className={LINK}>
            Back to log in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Password changed">
        <div className="text-center" role="status">
          <CircleCheck size={48} className="mx-auto text-navy" aria-hidden="true" />
          <h1 className="mt-4 text-[32px] leading-tight font-bold text-navy">Password changed</h1>
          <p className="mt-2 text-muted">Use your new password next time you log in.</p>
          <Link to={homeFor(state.role)} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-md btn-gradient font-bold text-navy shadow-sm hover:brightness-95">
            Continue to MPI
          </Link>
        </div>
      </AuthLayout>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const badPassword = password.length < MIN_PASSWORD ? `Please use at least ${MIN_PASSWORD} characters.` : null
    const badConfirm = !badPassword && confirm !== password ? "The two passwords don't match." : null
    setPasswordError(badPassword)
    setConfirmError(badConfirm)
    setError(null)
    if (badPassword || badConfirm) {
      requestAnimationFrame(() => form.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus())
      return
    }
    setBusy(true)
    try {
      await setNewPassword(password)
      setDone(true)
    } catch (err) {
      const message = messageOf(err, "Couldn't change your password. Please try again.")
      if (/password/i.test(message)) setPasswordError(message)
      else setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password">
      <h1 className="text-[32px] leading-tight font-bold text-navy">Choose a new password</h1>
      <p className="mt-1.5 text-muted">
        For <strong className="text-navy">{state.me.email}</strong>
      </p>
      <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          aside={<span className="text-muted">At least {MIN_PASSWORD} characters</span>}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
        />
        <PasswordField label="Type it again" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirmError} />
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" busy={busy} className="h-12 w-full">
          {busy ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </AuthLayout>
  )
}
