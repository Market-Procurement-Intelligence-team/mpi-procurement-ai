# MPI Netlify Production Deployment Guide

## 1. Architecture Overview

```
USER BROWSER
    │
    ▼
NETLIFY CDN (SPA Routing & Static Assets)
    │
    ├─► Static HTML/CSS/JS (dist/)
    │     ├── _redirects (forces /api/gemini/* to function & /* to index.html)
    │     └── Zero Secret Leaks (No GEMINI_API_KEY in client bundle)
    │
    ▼
NETLIFY SERVERLESS FUNCTION (netlify/functions/gemini.ts)
    │
    ├─► Consumes private GEMINI_API_KEY from Netlify Environment Variables
    ├─► Model Cascade (gemini-3.1-flash-lite → gemini-3-flash-preview)
    ├─► Error Hardening (400, 404, 429 backoff, 503 retry, 504 timeout)
    ├─► Structured Output & Content-Type Safety
    │
    ▼
GOOGLE GEMINI API (Upstream)
```

---

## 2. Netlify Dashboard Configuration

### A. Build & Deploy Settings
In **Netlify Dashboard → Site Settings → Build & deploy → Continuous Deployment**:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Repository** | Your connected GitHub repo | Continuous deployment |
| **Base directory** | *(empty / project root)* | Default |
| **Build command** | `npm run build` | Builds Vite bundle to `dist/` |
| **Publish directory** | `dist` | Generated static output |
| **Functions directory** | `netlify/functions` | Automatically detected via `netlify.toml` |

### B. Environment Variables
In **Netlify Dashboard → Site Settings → Environment variables → Add a variable**:

| Variable Name | Scope / Secret | Recommended Production Value |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **PRIVATE SECRET (Server-only)** | Your Google AI Studio API Key |
| `VITE_GEMINI_MODEL` | Public (Client + Function) | `gemini-3.1-flash-lite` |
| `VITE_SUPABASE_URL` | Public (Client) | `https://wrcllzvgemyacakttjxs.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public (Client) | Your Supabase publishable anon key |
| `NODE_VERSION` | Build Environment | `20` |

> [!CAUTION]
> **Never** prefix `GEMINI_API_KEY` with `VITE_`. Non-prefixed variables are strictly isolated to Netlify Serverless Functions and will never be bundled into client-side JavaScript.

---

## 3. Production Verification & Diagnostics

Once deployed to `https://<your-site>.netlify.app`:

### 1. Test Serverless Health Endpoint
Open in browser or curl:
```bash
curl -s https://<your-site>.netlify.app/api/gemini/health
```
Expected response:
```json
{
  "ok": true,
  "isConfigured": true,
  "model": "gemini-3.1-flash-lite",
  "platform": "netlify-functions"
}
```

### 2. Verify SPA Route Direct Access
Navigate directly to:
- `https://<your-site>.netlify.app/`
- `https://<your-site>.netlify.app/1982/admin`

The application should render cleanly without 404 errors due to `public/_redirects` and `netlify.toml` rewrites.

### 3. Verify AI Specification Engine
On the home page, enter:
> *"Need 500 custom printed packaging boxes in Jaipur within 15 days with a budget of ₹50,000."*

Click **Analyze & Generate Specs**. The engine will return institutional specifications with verified quantities, category benchmarks, and standard tolerances.
