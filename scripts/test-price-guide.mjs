/**
 * Tries the suppliers' price guide end to end, without any screens:
 * logs in to Supabase as a supplier, then shows the price guide for every
 * item on the requests that supplier was invited to. Items with too few past
 * prices are sent to the running dev server for the AI estimate.
 *
 *   1. In one terminal: npm run dev
 *   2. In another:      node scripts/test-price-guide.mjs
 *
 * It asks for the supplier's email and password in the terminal and doesn't save them.
 * Good demo accounts: mpi-demosupplier1@example.com (boxes and labels: past quotes)
 * and mpi-demosupplier2@example.com (prototype: AI estimate).
 */

import fs from "node:fs"
import readline from "node:readline/promises"
import { createClient } from "@supabase/supabase-js"

const DEV_SERVER = process.env.DEV_SERVER ?? "http://localhost:8443"

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
const email = (await rl.question("Supplier email: ")).trim()
const password = await rl.question("Password: ")
rl.close()

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error || !data.session) {
  console.error("Login failed:", error?.message ?? "no session")
  process.exit(1)
}

const { data: invitations } = await supabase.from("rfq_invitations").select("request_id")
const requestIds = (invitations ?? []).map((i) => i.request_id)
const { data: lines } = await supabase.from("request_lines").select("id, description, quantity, unit").in("request_id", requestIds)
if (!lines?.length) {
  console.log("This supplier has no invited requests with items.")
  process.exit(0)
}

const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`

for (const line of lines) {
  console.log(`\n${line.description} (${line.quantity} ${line.unit})`)
  const { data: rows, error: guideError } = await supabase.rpc("price_guide", { p_request_line_id: line.id })
  if (guideError) {
    console.log("  Error:", guideError.message)
    continue
  }
  const row = rows[0]
  if (row.source === "past_quotes") {
    console.log(`  From ${row.price_count} past prices: ${rupees(row.low)} to ${rupees(row.high)} per ${line.unit}, typical ${rupees(row.typical)}`)
    continue
  }

  console.log(`  Only ${row.price_count} past prices, asking the AI...`)
  const started = Date.now()
  let response
  try {
    response = await fetch(`${DEV_SERVER}/api/price-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ requestLineId: line.id }),
    })
  } catch {
    console.error(`  Couldn't reach ${DEV_SERVER}. Is "npm run dev" running? (Set DEV_SERVER=http://localhost:PORT if it uses another port.)`)
    continue
  }
  const body = await response.json().catch(() => null)
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  if (!response.ok || !body?.band) {
    console.log(`  Status ${response.status} in ${seconds}s:`, body?.error ?? body)
    continue
  }
  const { band, model } = body
  console.log(`  AI estimate (${model}, ${seconds}s): ${rupees(band.low)} to ${rupees(band.high)} per ${line.unit}, typical ${rupees(band.typical)}`)
  if (band.note) console.log(`  Note: ${band.note}`)
}

await supabase.auth.signOut()
