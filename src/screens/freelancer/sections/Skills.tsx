/**
 * Skills: tap a skill to add it, then set the level (and years). Saved straight
 * away. Skills come from MPI's list, grouped by category.
 */

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Plus, Sparkles, X } from "lucide-react"
import { removeMySkill, saveMySkill, type SkillLevel } from "../../../services/data/providers"
import { Alert } from "../../../ui/form"
import { errorText } from "../../supplier/parts"
import { EmptyLine, SectionPanel, Segmented, Tile } from "../ui"
import { SKILL_LEVELS } from "../useBuilder"
import type { SectionProps } from "./types"

export default function Skills({ b, orgId, reload, toast }: SectionProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mine = new Map(b.data.skills.map((s) => [s.skill_id, s]))
  const byId = new Map(b.skills.map((s) => [s.id, s]))
  const open = new Set(b.categories.map((c) => c.id))
  const myCats = new Set(b.data.categoryIds)
  // Your categories first, then the other open ones.
  const groups = b.categories
    .map((c) => ({ cat: c, skills: b.skills.filter((s) => s.category_id === c.id && s.is_active) }))
    .filter((g) => g.skills.length && open.has(g.cat.id))
    .sort((a, z) => Number(myCats.has(z.cat.id)) - Number(myCats.has(a.cat.id)))

  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await reload()
      if (done) toast(done)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <SectionPanel icon={Sparkles} title="Skills" subtitle="Pick what you're good at and how good. MPI uses these to match you." aside={<span className="text-[13px] font-semibold text-muted">{b.data.skills.length} of 25</span>}>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          {groups.map((g) => (
            <Tile key={g.cat.id}>
              <p className="mb-2.5 flex items-center justify-between text-[14px] font-bold text-navy">
                {g.cat.name}
                {!myCats.has(g.cat.id) && <span className="text-[12px] font-medium text-muted">Not one of your categories</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.skills.map((s) => {
                  const on = mine.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      disabled={busy === s.id}
                      onClick={() => void run(s.id, () => (on ? removeMySkill(orgId, s.id) : saveMySkill(orgId, s.id, "intermediate")), on ? `${s.name} removed` : `${s.name} added`)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13.5px] font-semibold transition-colors disabled:opacity-60 ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
                    >
                      {on ? <Check size={14} className="text-orange" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </Tile>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-navy">Your skills</p>
          {b.data.skills.length === 0 ? (
            <EmptyLine>Tap a skill on the left to add it.</EmptyLine>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {b.data.skills.map((s) => {
                  const sk = byId.get(s.skill_id)
                  return (
                    <motion.li key={s.skill_id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-white px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 text-[14.5px] font-bold text-navy">{sk?.name ?? s.skill?.name ?? "Skill"}</span>
                      <Segmented
                        size="sm"
                        label={`Level for ${sk?.name ?? "skill"}`}
                        options={[...SKILL_LEVELS]}
                        value={s.level as SkillLevel}
                        onChange={(level) => void run(s.skill_id, () => saveMySkill(orgId, s.skill_id, level, s.years))}
                      />
                      <label className="flex items-center gap-1.5 text-[13px] text-muted">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          defaultValue={s.years ?? ""}
                          onBlur={(e) => {
                            const y = e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value)))
                            if (y !== s.years) void run(s.skill_id, () => saveMySkill(orgId, s.skill_id, s.level as SkillLevel, y))
                          }}
                          className="h-8 w-14 rounded-md border-[1.5px] border-input px-2 text-center text-[13.5px] text-navy focus:border-orange focus:outline-none"
                          aria-label={`Years of ${sk?.name ?? "skill"}`}
                        />
                        yrs
                      </label>
                      <button type="button" onClick={() => void run(s.skill_id, () => removeMySkill(orgId, s.skill_id), "Skill removed")} className="rounded-md p-1 text-muted hover:bg-red-tint hover:text-red-text" aria-label={`Remove ${sk?.name ?? "skill"}`}>
                        <X size={16} />
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </SectionPanel>
  )
}
