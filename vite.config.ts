import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

import siteConfiguration from './.figma/make/site.json'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      tailwindcss(),
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
      geminiBackendProxyPlugin(),
      requestReaderDevPlugin(),
      priceEstimateDevPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
      allowedHosts: true,
      watch: { ignored: ['**/.figma/**'] },
    },
    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ''
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const language = sanitizeHtmlValue(config.language) || 'en'
  const googleAnalyticsId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt = config.robots?.index === false ? 'User-agent: *\nDisallow: /\n' : ''

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:title', escapeHtmlText(title))
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        const tags: HtmlTagDescriptor[] = []
        if (description) {
          tags.push({ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        if (title) {
          tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' })
        }
        if (description) {
          tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' })
        }
        if (socialImage) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:image', content: socialImage }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: socialImage }, injectTo: 'head' },
          )
        }

        if (googleAnalyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(googleAnalyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  const hadRefreshBoundary = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}

/**
 * Secure Backend Proxy Plugin for Gemini API.
 * Keeps GEMINI_API_KEY safe on the server side and handles:
 * - GET  /api/gemini/health
 * - POST /api/gemini/generateContent
 * - POST /api/gemini/chat
 * - POST /api/gemini/test
 */
function geminiBackendProxyPlugin(): Plugin {
  function getBackendApiKey(): string {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return process.env.GEMINI_API_KEY.trim()
    }
    try {
      const envPath = path.resolve(process.cwd(), '.env')
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8')
        const match = content.match(/^\s*(?:VITE_)?GEMINI_API_KEY\s*=\s*(.*)?\s*$/m)
        if (match && match[1]) {
          let val = match[1].trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          return val
        }
      }
    } catch {
      // fallback
    }
    return ''
  }

  function handleGeminiMiddleware(req: any, res: any, next: () => void) {
    const parsedUrl = (req.url || '').split('?')[0]
    if (!parsedUrl.startsWith('/api/gemini')) {
      return next()
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      return res.end()
    }

    if (parsedUrl === '/api/gemini/health' && req.method === 'GET') {
      const key = getBackendApiKey()
      res.statusCode = 200
      return res.end(
        JSON.stringify({
          ok: true,
          isConfigured: Boolean(key && key.length > 5),
          model: process.env.VITE_GEMINI_MODEL || 'gemini-3.1-flash-lite',
        })
      )
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      return res.end(JSON.stringify({ error: 'Method not allowed' }))
    }

    let rawBody = ''
    req.on('data', (chunk: Buffer) => {
      rawBody += chunk.toString()
    })

    req.on('end', async () => {
      try {
        let payload: any = {}
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody)
          } catch {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          }
        }

        const headerKey = req.headers['x-gemini-api-key']
        const apiKey = (headerKey && typeof headerKey === 'string' && headerKey.trim())
          ? headerKey.trim()
          : (payload.clientApiKey ? String(payload.clientApiKey).trim() : getBackendApiKey())

        if (!apiKey || apiKey.length < 5) {
          res.statusCode = 400
          return res.end(
            JSON.stringify({
              error: 'No Gemini API key configured on server or in request.',
              isLive: false,
            })
          )
        }

        const candidateModels = Array.from(
          new Set([
            payload.model || 'gemini-3.1-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-3.8-flash',
            'gemini-2.5-flash-lite',
            'gemini-3-flash-preview',
            'gemini-flash-latest',
            'gemini-1.5-flash',
          ].filter(Boolean))
        )

        if (parsedUrl === '/api/gemini/test') {
          let pingSuccess = false
          let lastErr = ''
          let workingModel = ''
          for (const m of candidateModels) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
              const upstream = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: 'MPI connection verification ping' }] }],
                }),
              })
              if (upstream.ok) {
                pingSuccess = true
                workingModel = m
                break
              } else {
                lastErr = await upstream.text()
              }
            } catch (err: any) {
              lastErr = err.message
            }
          }

          if (pingSuccess) {
            res.statusCode = 200
            return res.end(
              JSON.stringify({
                success: true,
                message: `Successfully connected to MPI AI Neural Engine (${workingModel})!`,
                model: workingModel,
              })
            )
          } else {
            res.statusCode = 502
            return res.end(
              JSON.stringify({
                success: false,
                message: `MPI AI connection failed: ${lastErr || 'Unknown error'}`,
              })
            )
          }
        }

        if (parsedUrl === '/api/gemini/generateContent') {
          const { systemPrompt, userPrompt, responseSchema } = payload
          const requestBody: Record<string, unknown> = {
            system_instruction: {
              parts: [{ text: systemPrompt || '' }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt || '' }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              topP: 0.95,
              ...(responseSchema
                ? {
                    responseMimeType: 'application/json',
                    responseSchema,
                  }
                : {}),
            },
          }

          let lastErrorMsg = ''
          for (const m of candidateModels) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
              const upstream = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              })

              if (upstream.ok) {
                const data = await upstream.json()
                const parts = data.candidates?.[0]?.content?.parts || []
                const text =
                  parts
                    .filter((p: any) => p.text && !p.thought)
                    .map((p: any) => p.text)
                    .join('') ||
                  parts.map((p: any) => p.text || '').join('') ||
                  data.candidates?.[0]?.output ||
                  ''
                if (text) {
                  res.statusCode = 200
                  return res.end(JSON.stringify({ text, isLive: true, model: m }))
                }
              } else {
                lastErrorMsg = await upstream.text()
              }
            } catch (err: any) {
              lastErrorMsg = err.message
            }
          }

          res.statusCode = 502
          return res.end(
            JSON.stringify({
              error: `Failed to generate response from Gemini: ${lastErrorMsg}`,
              isLive: false,
            })
          )
        }

        if (parsedUrl === '/api/gemini/chat') {
          const { systemInstruction, contents } = payload
          const requestBody: Record<string, unknown> = {
            ...(systemInstruction
              ? {
                  system_instruction: {
                    parts: [{ text: systemInstruction }],
                  },
                }
              : {}),
            contents: contents || [],
            generationConfig: {
              temperature: 0.3,
              topP: 0.95,
            },
          }

          let lastErrorMsg = ''
          for (const m of candidateModels) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
              const upstream = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              })

              if (upstream.ok) {
                const data = await upstream.json()
                const parts = data.candidates?.[0]?.content?.parts || []
                const text =
                  parts
                    .filter((p: any) => p.text && !p.thought)
                    .map((p: any) => p.text)
                    .join('') ||
                  parts.map((p: any) => p.text || '').join('') ||
                  ''
                if (text) {
                  res.statusCode = 200
                  return res.end(JSON.stringify({ text, isLive: true, model: m }))
                }
              } else {
                lastErrorMsg = await upstream.text()
              }
            } catch (err: any) {
              lastErrorMsg = err.message
            }
          }

          res.statusCode = 502
          return res.end(
            JSON.stringify({
              error: `Failed to generate chat response: ${lastErrorMsg}`,
              isLive: false,
            })
          )
        }

        res.statusCode = 404
        return res.end(JSON.stringify({ error: 'Endpoint not found' }))
      } catch (err: any) {
        res.statusCode = 500
        return res.end(JSON.stringify({ error: err.message }))
      }
    })
  }

  return {
    name: 'gemini-backend-proxy',
    configureServer(server) {
      server.middlewares.use(handleGeminiMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleGeminiMiddleware)
    },
  }
}

/**
 * Dev-server route for the AI request reader (POST /api/request-reader).
 * Runs the same code as the Netlify function, so `npm run dev` works without
 * the Netlify CLI. Reads GEMINI_API_KEY and the Supabase settings from .env.
 */
function requestReaderDevPlugin(): Plugin {
  let env: Record<string, string | undefined> = {}
  return {
    name: 'mpi-request-reader-dev',
    configResolved(config) {
      env = { ...loadEnv(config.mode, process.cwd(), ''), ...process.env }
    },
    configureServer(server) {
      server.middlewares.use('/api/request-reader', (req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { readRequest } = await server.ssrLoadModule('/netlify/functions/request-reader.ts')
            const result = await readRequest(
              { method: req.method ?? 'GET', authorization: req.headers.authorization ?? null, body },
              { env }
            )
            res.statusCode = result.status
            res.end(JSON.stringify(result.body))
          } catch (error) {
            console.error('request-reader (dev):', error)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Something went wrong. Please try again.' }))
          }
        })
      })
    },
  }
}

/**
 * Dev-server route for the suppliers' AI price estimate (POST /api/price-estimate).
 * Runs the same code as the Netlify function, like the request reader above.
 */
function priceEstimateDevPlugin(): Plugin {
  let env: Record<string, string | undefined> = {}
  return {
    name: 'mpi-price-estimate-dev',
    configResolved(config) {
      env = { ...loadEnv(config.mode, process.cwd(), ''), ...process.env }
    },
    configureServer(server) {
      server.middlewares.use('/api/price-estimate', (req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { estimatePrice } = await server.ssrLoadModule('/netlify/functions/price-estimate.ts')
            const result = await estimatePrice(
              { method: req.method ?? 'GET', authorization: req.headers.authorization ?? null, body },
              { env }
            )
            res.statusCode = result.status
            res.end(JSON.stringify(result.body))
          } catch (error) {
            console.error('price-estimate (dev):', error)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Something went wrong. Please try again.' }))
          }
        })
      })
    },
  }
}
