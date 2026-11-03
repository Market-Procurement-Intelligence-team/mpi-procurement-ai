/**
 * A text box with a "Speak to type" button (browser voice input).
 * What is heard is added to the end of the text.
 */

import { Mic, MicOff } from "lucide-react"
import { useVoiceInput } from "../lib/useVoiceInput"
import { BOX, boxBorder } from "./form"

export default function VoiceTextArea({
  value,
  onChange,
  placeholder,
  label,
  rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  rows?: number
}) {
  const voice = useVoiceInput({ onEnd: (spoken) => onChange(value.trim() ? `${value.trim()} ${spoken}` : spoken) })
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-navy">{label}</span>
        <button
          type="button"
          onClick={voice.toggle}
          disabled={!voice.supported}
          title={voice.supported ? undefined : "Voice typing works in Chrome, Edge and Safari"}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
            voice.listening ? "bg-red text-white" : "bg-navy-tint text-navy hover:bg-orange-tint"
          }`}
        >
          {voice.listening ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
          {voice.listening ? "Stop" : "Speak to type"}
        </button>
      </div>
      <textarea
        aria-label={label}
        rows={rows}
        value={voice.listening && voice.text ? `${value} ${voice.text}`.trim() : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        className={`${BOX} ${boxBorder()} py-2.5`}
      />
      {voice.error && <p className="mt-1 text-[13px] font-medium text-red-text">{voice.error}</p>}
    </div>
  )
}
