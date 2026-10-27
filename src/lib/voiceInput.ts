/**
 * Voice input: turns speech into text in the browser (Web Speech API).
 * Used by the "describe what you need" box (then the AI request reader takes
 * the text) and by supplier notes. Works in Chrome, Edge and Safari; other
 * browsers get a clear message and the person types instead. There is no fake
 * fallback: if the browser can't listen, we say so.
 *
 * React screens use the useVoiceInput hook (src/lib/useVoiceInput.ts).
 */

export type VoiceLanguage = "en" | "hi" | "mr" | "gu" | "ta" | "te" | "kn" | "bn"

/** Speech language codes for India, by app language. */
export const VOICE_LANGUAGES: Record<VoiceLanguage, { code: string; label: string }> = {
  en: { code: "en-IN", label: "English" },
  hi: { code: "hi-IN", label: "हिंदी" },
  mr: { code: "mr-IN", label: "मराठी" },
  gu: { code: "gu-IN", label: "ગુજરાતી" },
  ta: { code: "ta-IN", label: "தமிழ்" },
  te: { code: "te-IN", label: "తెలుగు" },
  kn: { code: "kn-IN", label: "ಕನ್ನಡ" },
  bn: { code: "bn-IN", label: "বাংলা" },
}

export interface VoiceInputOptions {
  language?: VoiceLanguage
  /** Called while the person speaks, with everything heard so far. */
  onText: (text: string) => void
  /** Called once when listening stops, with the final text (may be empty). */
  onEnd?: (text: string) => void
  /** Called with a message a person can act on. Listening has stopped. */
  onError?: (message: string) => void
}

export interface VoiceSession {
  /** Stop listening and keep what was heard. */
  stop: () => void
  /** Stop listening and throw away what was heard. */
  cancel: () => void
}

// The Web Speech API isn't in TypeScript's built-in types, so here is the part we use.
interface SpeechResult {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechResultEvent {
  resultIndex: number
  results: ArrayLike<SpeechResult>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const VOICE_NOT_SUPPORTED = "Voice input works in Chrome, Edge and Safari. Please type instead."

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow the microphone in your browser's address bar and try again.",
  "service-not-allowed": "Microphone access is blocked. Allow the microphone in your browser's address bar and try again.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  "no-speech": "We didn't hear anything. Tap the microphone and speak again.",
  network: "Voice input needs an internet connection. Please try again or type instead.",
  "language-not-supported": "This browser can't listen in that language. Try English or Hindi, or type instead.",
}

export function isVoiceInputSupported(): boolean {
  return getRecognition() !== null
}

/**
 * Starts listening. Returns a session to stop it, or null if the browser
 * can't listen (onError gets the reason).
 */
export function startVoiceInput(options: VoiceInputOptions): VoiceSession | null {
  const Recognition = getRecognition()
  if (!Recognition) {
    options.onError?.(VOICE_NOT_SUPPORTED)
    return null
  }

  const recognition = new Recognition()
  recognition.lang = VOICE_LANGUAGES[options.language ?? "en"].code
  recognition.continuous = true // keep listening through short pauses; the person taps again to stop
  recognition.interimResults = true

  let finalText = ""
  let latestText = ""
  let cancelled = false
  let ended = false

  recognition.onresult = (event) => {
    let interim = ""
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) finalText = `${finalText} ${result[0].transcript}`.trim()
      else interim += result[0].transcript
    }
    latestText = `${finalText} ${interim}`.replace(/\s+/g, " ").trim()
    if (!cancelled) options.onText(latestText)
  }

  recognition.onerror = (event) => {
    if (event.error === "aborted" || cancelled) return
    options.onError?.(ERROR_MESSAGES[event.error] ?? "Voice input stopped. Please try again or type instead.")
  }

  recognition.onend = () => {
    if (ended) return
    ended = true
    if (!cancelled) options.onEnd?.(latestText)
  }

  try {
    recognition.start()
  } catch {
    options.onError?.("Voice input couldn't start. Please try again or type instead.")
    return null
  }

  return {
    stop: () => recognition.stop(),
    cancel: () => {
      cancelled = true
      recognition.abort()
    },
  }
}
