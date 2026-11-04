/**
 * Netlify Function: dashboard-summary
 *
 * Writes the one-line "AI summary" at the top of each Overview dashboard
 * (decided 2 Nov 2026: shown with an "AI summary" label).
 *
 * The app sends short facts it has already worked out for the signed-in
 * person (counts, amounts and MPI aliases, never real company names); the AI
 * only turns them into one or two friendly sentences. It can't look anything
 * up, so it can't reveal anything the person couldn't already see.
 *
 * Safety rules, like the request reader:
 * - a Supabase login token is required, and the role comes from the database;
 * - the Gemini key is read from the server setting GEMINI_API_KEY only;
 * - one fixed job and prompt, small input limits, a per-user rate limit;
 * - the answer is trimmed to plain text of at most 320 characters.
 */

import { createClient } from "@supabase/supabase-js"

const MAX_FACTS = 12
const MAX_FACT_LENGTH = 160
const PER_USER_LIMIT = 20 // summaries per user per 10 minutes (per server instance)
const LIMIT_WINDOW_MS = 10 * 60 * 1000
const AI_TIMEOUT_MS = 8000
const DEFAULT_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash"]

export interface SummaryResult {
  status: number
  body: { summary: string; model: string } | { error: string }
}

interface SummaryInput {
  method: string
  authorization: string | null
  body: string | null
}

interface SummaryDeps {
  env: Record<string, string | undefined>
  fetch?: typeof fetch
  now?: Date
}

const recentCalls = new Map<string, number[]>()

function fail(status: number, error: string): SummaryResult {
  return { status, body: { error } }
}

function isRateLimited(userId: string, now: number): boolean {
  const calls = (recentCalls.get(userId) ?? []).filter((t) => now - t < LIMIT_WINDOW_MS)
  if (calls.length >= PER_USER_LIMIT) {
    recentCalls.set(userId, calls)
    return true
  }
  calls.push(now)
  recentCalls.set(userId, calls)
  return false
}

const ROLE_TEXT: Record<string, string> = {
  startup: "a startup that buys from verified suppliers through MPI",
  vendor: "a verified supplier (MSME) that sells to startups through MPI",
  admin: "the MPI team, who approve matches, verify suppliers and look after orders and payments",
}

function buildPrompt(role: string, language: string): string {
  return [
    "You write the one-line summary at the top of a dashboard in MPI, a B2B procurement app in India.",
    `The reader is ${ROLE_TEXT[role] ?? "an MPI user"}.`,
    "You get a short list of facts. Write one or two short, warm, plain sentences (max 45 words) that tell the reader what matters most today and what to do first.",
    "Rules:",
    "- Use only the facts given. Never invent numbers, names, dates or suggestions that aren't supported by the facts.",
    "- Put anything urgent (offers about to expire, payments due, overdue deliveries, messages waiting) first.",
    "- If nothing needs attention, say so kindly in one sentence.",
    "- Plain text only: no markdown, no lists, no emojis, no greetings like 'Hello'.",
    "- Amounts are in Indian rupees; keep the ₹ figures exactly as given.",
    language === "hi" ? "- Write in simple Hindi (Devanagari)." : "- Write in simple English.",
  ].join("\n")
}

async function askGemini(
  fetchImpl: typeof fetch,
  apiKey: string,
  models: string[],
  systemPrompt: string,
  facts: string[],
): Promise<{ text: string; model: string } | { error: string; status: number }> {
  let lastError = { error: "The AI summary isn't available right now.", status: 503 }
  for (const model of models) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    try {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: `Facts:\n${facts.map((f) => `- ${f}`).join("\n")}` }] }],
            // Newer Gemini models spend part of this budget "thinking", so a small
            // limit cut answers off mid-sentence. 1024 leaves plenty for 45 words.
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        },
      )
      if (response.status === 404 || response.status === 400) continue
      if (response.status === 429) {
        lastError = { error: "The AI is busy. Please try again in a minute.", status: 429 }
        continue
      }
      if (!response.ok) continue
      const data = (await response.json()) as {
        candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
      }
      const candidate = data.candidates?.[0]
      let text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? ""
      if (candidate?.finishReason === "MAX_TOKENS") {
        // Cut off: keep only whole sentences, or try the next model.
        const end = Math.max(text.lastIndexOf(". "), text.lastIndexOf("."), text.lastIndexOf("।"))
        text = end > 40 ? text.slice(0, end + 1) : ""
      }
      if (text.trim()) return { text, model }
    } catch {
      // timeout or network problem: try the next model
    } finally {
      clearTimeout(timer)
    }
  }
  return lastError
}

/** Plain text, one paragraph, at most 320 characters, ending on a whole sentence where possible. */
/** Drops a sentence the AI wrote twice ("X. X." or "X X"). */
export function dropRepeats(text: string): string {
  const words = text.trim().split(/\s+/)
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2
    if (words.slice(0, half).join(" ") === words.slice(half).join(" ")) return words.slice(0, half).join(" ")
  }
  const seen = new Set<string>()
  const kept: string[] = []
  for (const part of text.match(/[^.!?\u0964]+[.!?\u0964]*/g) ?? [text]) {
    const key = part.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    kept.push(part.trim())
  }
  return kept.join(" ")
}

export function cleanSummary(text: string): string {
  const flat = dropRepeats(
    text
      .replace(/[*_#`>]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
  if (flat.length <= 320) return flat
  const cut = flat.slice(0, 320)
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("। "))
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, 277).trimEnd()}…`
}

/** The whole job, separate from Netlify so it can run in the Vite dev server and in tests. */
export async function summarise(input: SummaryInput, deps: SummaryDeps): Promise<SummaryResult> {
  const fetchImpl = deps.fetch ?? fetch
  const env = deps.env
  if (input.method !== "POST") return fail(405, "Only POST is supported.")

  const token = input.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return fail(401, "Please log in first.")

  let facts: string[]
  let language = "en"
  try {
    const payload = JSON.parse(input.body ?? "{}") as { facts?: unknown; language?: unknown }
    facts = Array.isArray(payload.facts)
      ? payload.facts
          .filter((f): f is string => typeof f === "string")
          .map((f) => f.replace(/\s+/g, " ").trim().slice(0, MAX_FACT_LENGTH))
          .filter(Boolean)
          .slice(0, MAX_FACTS)
      : []
    if (payload.language === "hi") language = "hi"
  } catch {
    return fail(400, "The request wasn't readable.")
  }
  if (!facts.length) return fail(400, "No facts to summarise.")

  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!supabaseUrl || !supabaseKey || !apiKey) {
    console.error("dashboard-summary: missing SUPABASE_URL/KEY or GEMINI_API_KEY setting")
    return fail(503, "The AI summary isn't set up yet.")
  }

  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: fetchImpl },
  })
  const { data: userData, error: userError } = await db.auth.getUser(token)
  if (userError || !userData.user) return fail(401, "Your session has ended. Please log in again.")
  const userId = userData.user.id

  const { data: profile } = await db.from("profiles").select("role").eq("id", userId).maybeSingle()
  const role = profile?.role
  if (!role) return fail(403, "Not allowed.")

  const now = deps.now ?? new Date()
  if (isRateLimited(userId, now.getTime())) return fail(429, "That's a lot of summaries in a short time. Please wait a few minutes.")

  const models = [...new Set([env.GEMINI_MODEL, env.VITE_GEMINI_MODEL, ...DEFAULT_MODELS].filter((m): m is string => !!m))]
  const answer = await askGemini(fetchImpl, apiKey, models, buildPrompt(role, language), facts)
  if ("error" in answer) return fail(answer.status, answer.error)
  const summary = cleanSummary(answer.text)
  if (!summary) return fail(502, "The AI summary isn't available right now.")
  return { status: 200, body: { summary, model: answer.model } }
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }

export default async function (req: Request): Promise<Response> {
  const result = await summarise(
    { method: req.method, authorization: req.headers.get("authorization"), body: req.method === "POST" ? await req.text() : null },
    { env: process.env },
  )
  return new Response(JSON.stringify(result.body), { status: result.status, headers: JSON_HEADERS })
}

export const config = { path: "/api/dashboard-summary" }
