/**
 * React hook around voice input (src/lib/voiceInput.ts), for a microphone button.
 *
 *   const voice = useVoiceInput({ language: "hi", onEnd: (text) => setRequirement(text) })
 *   <button onClick={voice.toggle} disabled={!voice.supported}>{voice.listening ? "Stop" : "Speak"}</button>
 *   {voice.listening && <p>{voice.text || "Listening…"}</p>}
 *   {voice.error && <p role="alert">{voice.error}</p>}
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { isVoiceInputSupported, startVoiceInput, type VoiceLanguage, type VoiceSession } from "./voiceInput"

export interface UseVoiceInputOptions {
  language?: VoiceLanguage
  /** Called once with the final text when listening stops (not when cancelled). */
  onEnd?: (text: string) => void
}

export function useVoiceInput({ language = "en", onEnd }: UseVoiceInputOptions = {}) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const session = useRef<VoiceSession | null>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const start = useCallback(() => {
    session.current?.cancel()
    setError(null)
    setText("")
    const started = startVoiceInput({
      language,
      onText: setText,
      onEnd: (finalText) => {
        session.current = null
        setListening(false)
        if (finalText) onEndRef.current?.(finalText)
      },
      onError: (message) => {
        setError(message)
        setListening(false)
      },
    })
    session.current = started
    setListening(started !== null)
  }, [language])

  const stop = useCallback(() => session.current?.stop(), [])

  const cancel = useCallback(() => {
    session.current?.cancel()
    session.current = null
    setListening(false)
    setText("")
  }, [])

  const toggle = useCallback(() => (session.current ? stop() : start()), [start, stop])

  // Stop the microphone if the screen closes while listening.
  useEffect(() => () => session.current?.cancel(), [])

  return { supported: isVoiceInputSupported(), listening, text, error, start, stop, cancel, toggle }
}
