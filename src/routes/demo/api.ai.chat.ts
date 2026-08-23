import { createFileRoute } from '@tanstack/react-router'
import { chat, maxIterations, toServerSentEventsResponse } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { openaiText } from '@tanstack/ai-openai'
import { geminiText } from '@tanstack/ai-gemini'
import { ollamaText } from '@tanstack/ai-ollama'
import { openRouterText } from '@tanstack/ai-openrouter'

import { getServices, showOfferToolDef } from '#/lib/studio-tools'

const SYSTEM_PROMPT = `You are an AI solutions consultant who helps small business owners find the right AI automation for their business.

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THIS EXACT WORKFLOW:

When discussing services or recommending an offering:
1. FIRST: Use the getServices tool (no parameters needed) to see available packages
2. SECOND: Use the showOffer tool with the package ID and a one-sentence pitch tailored to the client's situation
3. NEVER write out package details yourself - ALWAYS use the showOffer tool

IMPORTANT:
- The showOffer tool displays the package as an interactive card with a booking button
- You MUST use showOffer for ANY service recommendation
- ONLY offer packages that exist in the catalog (call getServices first)
- Ask about the client's business, team size, and biggest time drain before recommending if it is not clear
- Keep your text responses brief - let the showOffer card do the heavy lifting
`

export const Route = createFileRoute('/demo/api/ai/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Capture request signal before reading body (it may be aborted after body is consumed)
        const requestSignal = request.signal

        // If request is already aborted, return early
        if (requestSignal.aborted) {
          return new Response(null, { status: 499 }) // 499 = Client Closed Request
        }

        const abortController = new AbortController()

        try {
          const body = await request.json()
          const { messages } = body

          // Determine the best available provider
          let provider: string = 'ollama'
          let model: string = 'mistral:7b'
          if (process.env.OPENROUTER_API_KEY) {
            provider = 'openrouter'
            model = 'openrouter/free'
          } else if (process.env.ANTHROPIC_API_KEY) {
            provider = 'anthropic'
            model = 'claude-haiku-4-5'
          } else if (process.env.OPENAI_API_KEY) {
            provider = 'openai'
            model = 'gpt-4o'
          } else if (process.env.GEMINI_API_KEY) {
            provider = 'gemini'
            model = 'gemini-2.0-flash-exp'
          }

          // Adapter factory pattern for multi-vendor support
          const adapterConfig = {
            openrouter: () =>
              openRouterText((model || 'openrouter/free') as any),
            anthropic: () =>
              anthropicText((model || 'claude-haiku-4-5') as any),
            openai: () => openaiText((model || 'gpt-4o') as any),
            gemini: () => geminiText((model || 'gemini-2.0-flash-exp') as any),
            ollama: () => ollamaText((model || 'mistral:7b') as any),
          }

          const adapter = adapterConfig[provider]()

          const stream = chat({
            adapter,
            modelOptions:
              provider === 'openrouter'
                ? { maxCompletionTokens: 1024 }
                : undefined,
            tools: [
              getServices, // Server tool - executes on the server
              showOfferToolDef, // Client tool - definition only, browser executes it
            ],
            systemPrompts: [SYSTEM_PROMPT],
            agentLoopStrategy: maxIterations(5),
            messages,
            abortController,
          })

          return toServerSentEventsResponse(stream, { abortController })
        } catch (error: any) {
          // If request was aborted, return early (don't send error response)
          if (error.name === 'AbortError' || abortController.signal.aborted) {
            return new Response(null, { status: 499 }) // 499 = Client Closed Request
          }
          return new Response(
            JSON.stringify({ error: 'Failed to process chat request' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
