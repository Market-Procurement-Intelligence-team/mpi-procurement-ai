/**
 * Settings everyone has: how the app looks, a new password, and signing out.
 * These save on their own, separate from the profile's Save changes button.
 */

import { useState, type FormEvent } from "react"
import { KeyRound, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react"
import { useThemeChoice, type ThemeChoice } from "../../app/theme"
import { setNewPassword, signOut } from "../../services/data/auth"
import Button from "../../ui/Button"
import { Alert } from "../../ui/form"
import { ProfileSection, TextInput } from "./parts"

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Same as device", icon: Monitor },
]

const MIN_PASSWORD = 8

export default function SettingsSection({ email }: { email: string }) {
  const [theme, setTheme] = useThemeChoice()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (password.length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters.`
    if (confirm !== password) found.confirm = "The two passwords don't match."
    setErrors(found)
    setResult(null)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await setNewPassword(password)
      setPassword("")
      setConfirm("")
      setResult({ ok: true, text: "Your password is changed. Use it next time you log in." })
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error && err.message ? err.message : "Couldn't change the password. Please try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileSection id="settings" icon={Settings} title="Settings" description="These save straight away.">
      <div className="space-y-8">
        <fieldset>
          <legend className="text-sm font-semibold text-navy">Appearance</legend>
          <p className="mt-0.5 text-sm text-muted">The dark look is being designed. Your choice is remembered and will apply once it's ready.</p>
          <div role="radiogroup" aria-label="Appearance" className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border-[1.5px] border-line bg-page p-1">
            {THEMES.map((t) => {
              const on = theme === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(t.value)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold transition-colors ${
                    on ? "bg-navy text-white shadow-sm" : "text-navy hover:bg-white"
                  }`}
                >
                  <t.icon size={17} className={on ? "text-orange" : "text-muted"} aria-hidden="true" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <form onSubmit={changePassword} noValidate className="border-t border-line pt-6">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-muted" aria-hidden="true" />
            <h3 className="text-base font-bold text-navy">Change password</h3>
          </div>
          <p className="mt-0.5 text-sm text-muted">For {email}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              aside={`At least ${MIN_PASSWORD} characters`}
            />
            <TextInput
              label="Type it again"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
              error={errors.confirm}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" busy={busy} disabled={!password}>
              {busy ? "Changing…" : "Change password"}
            </Button>
          </div>
          {result && <div className="mt-3">{result.ok ? <Alert tone="info">{result.text}</Alert> : <Alert>{result.text}</Alert>}</div>}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <div>
            <h3 className="text-base font-bold text-navy">Sign out</h3>
            <p className="text-sm text-muted">You'll need your email and password to come back.</p>
          </div>
          <Button
            variant="ghost"
            className="border-[1.5px] border-red-text bg-white text-red-text hover:bg-red-tint"
            busy={signingOut}
            onClick={() => {
              setSigningOut(true)
              void signOut().finally(() => setSigningOut(false))
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </ProfileSection>
  )
}
