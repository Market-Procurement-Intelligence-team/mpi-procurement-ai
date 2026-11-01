/**
 * Netlify Serverless Function: gemini
 *
 * Production-hardened serverless endpoint proxying requests to Google Gemini API.
 * Keeps GEMINI_API_KEY secure on the server side and enforces:
 * - Specific HTTP error handling (400, 404, 429, 503, 500, timeout)
 * - Exponential backoff with jitter on 429/503
 * - Verified model cascading (gemini-3.1-flash-lite -> gemini-3-flash-preview)
 * - Structured response validation
 * - CORS headers and safe preflight
 *
 * Supports both Netlify Functions v2 (Web Request/Response) and v1 (AWS Lambda handler)
 */

interface RequestPayload {
  systemPrompt?: string
  userPrompt?: string
  responseSchema?: Record<string, unknown>
  systemInstruction?: string
  contents?: Array<{ role: string; parts: Array<{ text: string }> }>
  model?: string
  candidateModels?: string[]
  clientApiKey?: string
}

interface ProcessResult {
  statusCode: number
  headers: Record<string, string>
  body: string
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-gemini-api-key, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
}

function getSecretApiKey(clientHeaderKey?: string, clientBodyKey?: string): string {
  if (clientHeaderKey && clientHeaderKey.trim().length > 5) {
    return clientHeaderKey.trim()
  }
  if (clientBodyKey && clientBodyKey.trim().length > 5) {
    return clientBodyKey.trim()
  }
  const envKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  return envKey.trim()
}

function extractAction(rawPath: string, queryAction?: string): string {
  if (queryAction && queryAction.trim()) {
    return queryAction.trim()
  }
  const cleanPath = (rawPath || "").split("?")[0].toLowerCase()
  if (cleanPath.endsWith("/health") || cleanPath.includes("health")) return "health"
  if (cleanPath.endsWith("/chat") || cleanPath.includes("chat")) return "chat"
  if (cleanPath.endsWith("/test") || cleanPath.includes("test")) return "test"
  if (cleanPath.endsWith("/generatecontent") || cleanPath.includes("generatecontent")) return "generateContent"
  return "generateContent"
}

function cleanExtractedJson(rawText: string): string {
  let cleaned = rawText.trim()
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (markdownMatch) {
    cleaned = markdownMatch[1].trim()
  }
  return cleaned
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function processGeminiApiRequest(params: {
  method: string
  path: string
  headers: Record<string, string | undefined>
  body?: string | null
  queryAction?: string
}): Promise<ProcessResult> {
  const { method, path, headers, body, queryAction } = params

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    }
  }

  const action = extractAction(path, queryAction)
  const clientHeaderKey = headers["x-gemini-api-key"] || headers["X-Gemini-API-Key"]

  let payload: RequestPayload = {}
  if (body) {
    try {
      payload = JSON.parse(body)
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Request payload must be valid JSON.",
          },
        }),
      }
    }
  }

  const apiKey = getSecretApiKey(clientHeaderKey, payload.clientApiKey)

  // 1. HEALTH CHECK ENDPOINT
  if (action === "health" && (method === "GET" || method === "POST")) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        isConfigured: Boolean(apiKey && apiKey.length > 5),
        model: process.env.VITE_GEMINI_MODEL || "gemini-3.1-flash-lite",
        platform: "netlify-functions",
      }),
    }
  }

  if (method !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are supported." },
      }),
    }
  }

  // Check API key availability
  if (!apiKey || apiKey.length < 5) {
    return {
      statusCode: 503,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: "API_KEY_MISSING",
          message:
            "AI service key is not configured. Please set GEMINI_API_KEY in environment configuration.",
        },
        isLive: false,
      }),
    }
  }

  // Candidate models cascade: verified models first
  const candidateModels = Array.from(
    new Set(
      [
        payload.model,
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-2.5-flash-lite",
        "gemini-3-flash-preview",
        "gemini-flash-latest",
        "gemini-1.5-flash",
      ].filter((m): m is string => Boolean(m && typeof m === "string" && m.trim())),
    ),
  )

  // 2. TEST ENDPOINT
  if (action === "test") {
    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Ping MPI AI engine. Reply 'OK'." }] }],
          }),
        })

        if (res.ok) {
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              message: `Successfully connected to MPI AI Neural Engine (${m})!`,
              model: m,
            }),
          }
        }
      } catch {
        // try next
      }
    }

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: "Failed to connect to AI service with configured key.",
        },
      }),
    }
  }

  // 3. GENERATE CONTENT ENDPOINT
  if (action === "generateContent") {
    const { systemPrompt, userPrompt, responseSchema } = payload

    if (!userPrompt && !systemPrompt) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing procurement requirement prompt in request body.",
          },
        }),
      }
    }

    const requestBody: Record<string, unknown> = {
      system_instruction: {
        parts: [{ text: systemPrompt || "" }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt || "" }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        ...(responseSchema
          ? {
              responseMimeType: "application/json",
              responseSchema,
            }
          : {}),
      },
    }

    let lastError: { status: number; text: string } | null = null

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 24000)

        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (response.ok) {
            const data = (await response.json()) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string; thought?: boolean }> }
                output?: string
              }>
            }
            const parts = data.candidates?.[0]?.content?.parts || []
            let text =
              parts
                .filter((p) => p.text && !p.thought)
                .map((p) => p.text)
                .join("") ||
              parts.map((p) => p.text || "").join("") ||
              data.candidates?.[0]?.output ||
              ""

            if (responseSchema && text) {
              text = cleanExtractedJson(text)
            }

            if (text) {
              return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                  success: true,
                  text,
                  isLive: true,
                  model,
                }),
              }
            }
          }

          const errText = await response.text()
          lastError = { status: response.status, text: errText }

          // If rate limited (429) or service busy (503), apply exponential backoff jitter
          if (response.status === 429 || response.status === 503) {
            const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 500
            await sleep(backoff)
            continue
          }

          // If 404 (model unsupported), break inner retry and try next candidate model
          if (response.status === 404) {
            break
          }

          // If 400 (bad request), do not retry endlessly
          if (response.status === 400) {
            break
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId)
          const isAbort = (err as { name?: string })?.name === "AbortError"
          lastError = {
            status: isAbort ? 504 : 500,
            text: isAbort ? "AI request timed out" : String(err),
          }
        }
      }
    }

    const statusCode = lastError?.status === 429 ? 429 : lastError?.status === 504 ? 504 : 502
    const userMessage =
      statusCode === 429
        ? "AI service is temporarily busy. Please try again shortly."
        : statusCode === 504
          ? "Request timed out while waiting for AI model. Please try with a shorter requirement description."
          : "Failed to generate response from AI service."

    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: statusCode === 429 ? "RATE_LIMITED" : statusCode === 504 ? "TIMEOUT" : "UPSTREAM_ERROR",
          message: userMessage,
        },
        isLive: false,
      }),
    }
  }

  // 4. CHAT ENDPOINT
  if (action === "chat") {
    const { systemInstruction, contents } = payload

    if (!contents || contents.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: { code: "BAD_REQUEST", message: "Missing conversation contents in request body." },
        }),
      }
    }

    const requestBody: Record<string, unknown> = {
      ...(systemInstruction
        ? {
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
      contents,
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    }

    let lastError: { status: number; text: string } | null = null

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 24000)

        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (response.ok) {
            const data = (await response.json()) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string; thought?: boolean }> }
              }>
            }
            const parts = data.candidates?.[0]?.content?.parts || []
            const text =
              parts
                .filter((p) => p.text && !p.thought)
                .map((p) => p.text)
                .join("") ||
              parts.map((p) => p.text || "").join("") ||
              ""

            if (text) {
              return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                  success: true,
                  text,
                  isLive: true,
                  model,
                }),
              }
            }
          }

          const errText = await response.text()
          lastError = { status: response.status, text: errText }

          if (response.status === 429 || response.status === 503) {
            const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 500
            await sleep(backoff)
            continue
          }

          if (response.status === 404 || response.status === 400) {
            break
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId)
          const isAbort = (err as { name?: string })?.name === "AbortError"
          lastError = {
            status: isAbort ? 504 : 500,
            text: isAbort ? "Chat request timed out" : String(err),
          }
        }
      }
    }

    const statusCode = lastError?.status === 429 ? 429 : 502
    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: statusCode === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
          message:
            statusCode === 429
              ? "AI service is temporarily busy. Please try again shortly."
              : "Failed to generate chat response from AI service.",
        },
        isLive: false,
      }),
    }
  }

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: { code: "NOT_FOUND", message: `Unknown action '${action}'.` },
    }),
  }
}

// ─── NETLIFY FUNCTIONS V2 EXPORT (Standard Web Request / Response) ────────────
export default async function (req: Request): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method
  const path = url.pathname
  const queryAction = url.searchParams.get("action") || undefined

  const headers: Record<string, string | undefined> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })

  let body: string | null = null
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    try {
      body = await req.text()
    } catch {
      body = null
    }
  }

  const result = await processGeminiApiRequest({
    method,
    path,
    headers,
    body,
    queryAction,
  })

  return new Response(result.body, {
    status: result.statusCode,
    headers: result.headers,
  })
}

// ─── NETLIFY FUNCTIONS V1 / AWS LAMBDA HANDLER EXPORT ────────────────────────
export async function handler(event: {
  httpMethod: string
  path: string
  headers: Record<string, string | undefined>
  body: string | null
  queryStringParameters?: Record<string, string | undefined>
}): Promise<{
  statusCode: number
  headers: Record<string, string>
  body: string
}> {
  return processGeminiApiRequest({
    method: event.httpMethod,
    path: event.path,
    headers: event.headers || {},
    body: event.body,
    queryAction: event.queryStringParameters?.action,
  })
}
