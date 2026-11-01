import { useEffect } from "react"

const BOT_SCRIPT =
  "https://files.bpcontent.cloud/2026/09/15/12/20260915120747-INJYVTYM.js"

export default function BotpressChat() {
  useEffect(() => {
    const injectSrc = "https://cdn.botpress.cloud/webchat/v5.0/inject.js"
    const existingInject = document.querySelector(`script[src="${injectSrc}"]`)
    const existingBot = document.querySelector(`script[src="${BOT_SCRIPT}"]`)

    if (!existingInject) {
      const script = document.createElement("script")
      script.src = injectSrc
      script.async = true
      document.head.appendChild(script)
    }

    if (!existingBot) {
      const script = document.createElement("script")
      script.src = BOT_SCRIPT
      script.defer = true
      document.body.appendChild(script)
    }
  }, [])

  return null
}
