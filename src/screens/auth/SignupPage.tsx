/**
 * Create an account: choose startup or supplier, then name, company, email
 * and password. The database creates the company and its anonymous code.
 *
 * "Confirm email" is off in Supabase, so people are signed in straight away:
 * startups land on My requests, suppliers on their Profile to get verified.
 * If confirmation is ever switched on, the page says to check their inbox.
 */

import { useState, type FormEvent } from "react"
import { Link, Navigate } from "react-router"
import { Building2, MailCheck, ShoppingBag, type LucideIcon } from "lucide-react"
import { homeFor, useSession, type Role } from "../../app/session"
import { signUp, type AccountType } from "../../services/data/auth"
import Button from "../../ui/Button"
import AuthLayout from "./AuthLayout"
import { EMAIL_PATTERN, FormAlert, messageOf, MIN_PASSWORD, PasswordField, TextField } from "./fields"

const LINK = "font-semibold text-navy underline-offset-4 hover:underline"

const ROLES: { value: AccountType; title: string; tag: string; body: string; icon: LucideIcon }[] = [
  { value: "startup", title: "Startup", tag: "Buyer", body: "I buy goods or services", icon: ShoppingBag },
  { value: "vendor", title: "Supplier", tag: "MSME", body: "I sell goods or services", icon: Building2 },
]

/** Where people land right after creating an account. */
function landingFor(role: Role): string {
  if (role === "startup") return "/startup/requests"
  if (role === "vendor") return "/supplier/profile"
  return homeFor(role)
}

type Errors = Partial<Record<"role" | "fullName" | "orgName" | "email" | "password", string>>

export default function SignupPage() {
  const { state } = useSession()
  const [role, setRole] = useState<AccountType | null>(null)
  const [fullName, setFullName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(false)
  const [checkInbox, setCheckInbox] = useState(false)

  if (state.status === "signedIn") {
    return <Navigate to={created ? landingFor(state.role) : homeFor(state.role)} replace />
  }

  if (checkInbox) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-orange-tint text-navy">
            <MailCheck size={28} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-[32px] leading-tight font-bold text-navy">Check your inbox</h1>
          <p className="mt-2 text-muted">
            We've sent a link to <strong className="text-navy">{email.trim().toLowerCase()}</strong>. Open it to finish creating your account.
          </p>
          <Link to="/login" className={`mt-6 inline-block ${LINK}`}>
            Back to log in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  function validate(): Errors {
    const next: Errors = {}
    if (!role) next.role = "Please choose how you'll use MPI."
    if (!fullName.trim()) next.fullName = "Please enter your full name."
    if (!orgName.trim()) next.orgName = "Please enter your company name."
    if (!email.trim()) next.email = "Please enter your email."
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "Please enter a full email, like name@company.in."
    if (password.length < MIN_PASSWORD) next.password = `Please use at least ${MIN_PASSWORD} characters.`
    return next
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const next = validate()
    setErrors(next)
    setError(null)
    if (Object.keys(next).length) {
      requestAnimationFrame(() => form.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus())
      return
    }
    setBusy(true)
    try {
      const { needsEmailConfirmation } = await signUp({ email, password, accountType: role!, orgName, fullName })
      if (needsEmailConfirmation) setCheckInbox(true)
      else setCreated(true)
      setBusy(false)
    } catch (err) {
      const message = messageOf(err, "Couldn't create your account. Please try again.")
      if (/already exists/i.test(message)) {
        setErrors({ email: message })
        requestAnimationFrame(() => form.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus())
      } else if (/password/i.test(message)) setErrors({ password: message })
      else setError(message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className={LINK}>
            Log in
          </Link>
        </>
      }
    >
      <h1 className="text-[32px] leading-tight font-bold text-navy">Create your MPI account</h1>
      <p className="mt-1 text-muted [@media(max-height:820px)]:hidden">It takes a minute. Business details come later.</p>

      <form className="mt-5 [@media(max-height:820px)]:mt-4" onSubmit={submit} noValidate>
        <fieldset aria-describedby={errors.role ? "role-error" : undefined}>
          <legend className="text-xs font-bold tracking-wide text-navy uppercase">1. How will you use MPI?</legend>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            {ROLES.map(({ value, title, tag, body, icon: Icon }) => {
              const checked = role === value
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-[1.5px] p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange ${
                    checked ? "border-orange bg-orange-tint/50" : errors.role ? "border-red bg-white" : "border-line bg-white hover:border-input"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={checked}
                    onChange={() => {
                      setRole(value)
                      setErrors((e) => ({ ...e, role: undefined }))
                    }}
                    aria-invalid={errors.role ? true : undefined}
                    className="mt-0.5 size-5 shrink-0 accent-[#ec8d49]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Icon size={18} className="shrink-0 text-navy" aria-hidden="true" />
                      <span className="font-bold text-navy">{title}</span>
                      <span className="rounded bg-navy-tint px-1.5 py-0.5 text-xs font-semibold text-navy">{tag}</span>
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted">{body}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {errors.role && (
            <p id="role-error" className="mt-2 text-sm font-medium text-red-text">
              {errors.role}
            </p>
          )}
        </fieldset>

        <div className="mt-5 space-y-4 [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:space-y-3">
          <p className="text-xs font-bold tracking-wide text-navy uppercase">2. Your details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
            <TextField label="Company name" autoComplete="organization" value={orgName} onChange={(e) => setOrgName(e.target.value)} error={errors.orgName} />
          </div>
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            aside={<span className="text-muted">At least {MIN_PASSWORD} characters</span>}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          {role === "vendor" && (
            <p className="rounded-md bg-navy-tint px-3 py-2 text-sm text-navy">
              Next you'll add your Udyam and GST numbers. You get requests once MPI verifies you.
            </p>
          )}
          {error && <FormAlert>{error}</FormAlert>}
          <Button type="submit" busy={busy} className="h-12 w-full">
            {busy ? "Creating your account..." : "Create account"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
