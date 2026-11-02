/**
 * Ask for a password reset link. The answer is the same whether or not the
 * email has an account, so the page never reveals who uses MPI.
 */

import { useState, type FormEvent } from "react"
import { Link, useLocation } from "react-router"
import { ArrowLeft, MailCheck } from "lucide-react"
import { sendPasswordReset } from "../../services/data/auth"
import Button from "../../ui/Button"
import AuthLayout from "./AuthLayout"
import { EMAIL_PATTERN, FormAlert, messageOf, TextField } from "./fields"

const BACK = "inline-flex items-center gap-2 font-semibold text-navy underline-offset-4 hover:underline"

export default function ForgotPasswordPage() {
  const location = useLocation()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const bad = !email.trim() ? "Please enter your email." : !EMAIL_PATTERN.test(email.trim()) ? "Please enter a full email, like name@company.in." : null
    setEmailError(bad)
    setError(null)
    if (bad) {
      event.currentTarget.querySelector<HTMLInputElement>("input")?.focus()
      return
    }
    setBusy(true)
    try {
      await sendPasswordReset(email, `${window.location.origin}/reset-password`)
      setSent(true)
    } catch (err) {
      setError(messageOf(err, "Couldn't send the link. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <div className="text-center" role="status">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-orange-tint text-navy">
            <MailCheck size={28} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-[32px] leading-tight font-bold text-navy">Check your email</h1>
          <p className="mt-2 text-muted">
            If an account exists for <strong className="text-navy">{email.trim().toLowerCase()}</strong>, we've sent a link to reset your
            password. It can take a minute to arrive, so check your spam folder too.
          </p>
          <Link to="/login" className={`mt-6 ${BACK}`}>
            <ArrowLeft size={18} aria-hidden="true" />
            Back to log in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      footer={
        <Link to="/login" className={BACK}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back to log in
        </Link>
      }
    >
      <h1 className="text-[32px] leading-tight font-bold text-navy">Reset your password</h1>
      <p className="mt-1.5 text-muted">Enter the email you signed up with and we'll send you a link to choose a new password.</p>
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
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" busy={busy} className="h-12 w-full">
          {busy ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  )
}
