/**
 * Tries the AI request reader end to end, without any screens:
 * logs in to Supabase as a startup, then asks the running dev server to read a requirement.
 *
 *   1. In one terminal: npm run dev
 *   2. In another:      node scripts/test-request-reader.mjs
 *
 * It asks for the startup's email and password in the terminal and doesn't save them.
 * Optional: pass your own text, e.g.  node scripts/test-request-reader.mjs "need 200 t-shirts in Delhi"
 */

import fs from "node:fs"
import readline from "node:readline/promises"
import { createClient } from "@supabase/supabase-js"

const DEV_SERVER = process.env.DEV_SERVER ?? "http://localhost:8443"
const text =
  process.argv[2] ??
  "Need 5000 printed corrugated boxes in Pune by 15 Nov, ISO 9001, budget around 2 lakh. Also need a simple company website."

function readEnv() {
  const env = {}
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const env = readEnv()
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.error("Your .env needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.")
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const email = (await rl.question("Startup email: ")).trim()
const password = await rl.question("Password: ")
rl.close()

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error || !data.session) {
  console.error("Login failed:", error?.message ?? "no session")
  process.exit(1)
}

console.log(`\nAsking the AI to read:\n  "${text}"\n`)
const started = Date.now()
let response
try {
  response = await fetch(`${DEV_SERVER}/api/request-reader`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ text }),
  })
} catch {
  console.error(`Couldn't reach ${DEV_SERVER}. Is "npm run dev" running? (Set DEV_SERVER=http://localhost:PORT if it uses another port.)`)
  process.exit(1)
}
const body = await response.json().catch(() => null)
console.log(`Status ${response.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(JSON.stringify(body, null, 2))
await supabase.auth.signOut()
