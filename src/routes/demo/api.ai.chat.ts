import { createFileRoute } from '@tanstack/react-router'
import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { openaiText } from '@tanstack/ai-openai'
import { geminiText } from '@tanstack/ai-gemini'
import { ollamaText } from '@tanstack/ai-ollama'
import { openRouterText } from '@tanstack/ai-openrouter'
import {
  memoryPersistence,
  reconstructChat,
  withPersistence,
} from '@tanstack/ai-persistence'

import {
  getCaseStudies,
  getServices,
  scheduleIntroCall,
  showOfferToolDef,
} from '#/lib/studio-tools'
import { studioUsageMiddleware } from '#/lib/studio-usage'

// In-process persistence backend (dev/tests). Swap for a database-backed
// adapter (see @tanstack/ai-persistence store contracts) in production.
const persistence = memoryPersistence()

const SYSTEM_PROMPT = `You are an AI solutions consultant who helps small business owners find the right AI automation for their business.

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THIS EXACT WORKFLOW:

When discussing services or recommending an offering:
1. FIRST: Use the getServices tool (no parameters needed) to see available packages
2. SECOND: Use the showOffer tool with the package ID and a one-sentence pitch tailored to the client's situation
3. NEVER write out package details yourself - ALWAYS use the showOffer tool

When the user wants proof, past results, or references:
1. Use the getCaseStudies tool to fetch real client outcomes before answering

When the user wants to move forward, explore working together, or book a meeting:
1. Propose a concrete time slot and topic, then call scheduleIntroCall to book it
2. The scheduleIntroCall tool requires explicit human approval - it will pause until the user approves

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
      // Hydration endpoint for server-authoritative clients: resolves
      // ?threadId= and returns stored transcript + pending interrupts.
      GET: async ({ request }) => {
        return reconstructChat(persistence, request, {
          // Demo only. In production you MUST authorize by session here -
          // without it anyone who guesses ?threadId= reads the thread.
          authorize: async () => true,
        })
      },
      POST: async ({ request }) => {
        // Capture request signal before reading body (it may be aborted after body is consumed)
        const requestSignal = request.signal

        // If request is already aborted, return early
        if (requestSignal.aborted) {
          return new Response(null, { status: 499 }) // 499 = Client Closed Request
        }

        const abortController = new AbortController()

        try {
          // Raw body first: we read custom fields (provider/debug) that are
          // not part of the AG-UI RunAgentInput contract, then validate the
          // rest through the body-level parser.
          const raw = await request.json()
          // Parses messages + threadId + runId + resume batch
          const params = await chatParamsFromRequestBody(raw)

          // Providers actually usable in this environment (key present)
          const availableProviders = [
            ...(process.env.OPENROUTER_API_KEY ? ['openrouter'] : []),
            ...(process.env.ANTHROPIC_API_KEY ? ['anthropic'] : []),
            ...(process.env.OPENAI_API_KEY ? ['openai'] : []),
            ...(process.env.GEMINI_API_KEY ? ['gemini'] : []),
            'ollama',
          ]

          // Client may request a provider (runtime adapter switching);
          // fall back to the best available one if it is not configured.
          const requested =
            typeof raw.provider === 'string' &&
            availableProviders.includes(raw.provider)
              ? raw.provider
              : null
          let provider: string = requested ?? availableProviders[0]
          const MODELS = {
            openrouter: 'openrouter/free',
            anthropic: 'claude-haiku-4-5',
            openai: 'gpt-4o',
            gemini: 'gemini-2.0-flash-exp',
            ollama: 'mistral:7b',
          }
          let model: string =
            MODELS[provider as keyof typeof MODELS] ?? MODELS.ollama

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

          const adapter =
            adapterConfig[provider as keyof typeof adapterConfig]()

          const stream = chat({
            adapter,
            modelOptions:
              provider === 'openrouter'
                ? { maxCompletionTokens: 1024 }
                : undefined,
            tools: [
              getServices, // Server tool - executes on the server
              showOfferToolDef, // Client tool - definition only, browser executes it
              scheduleIntroCall, // Approval-gated server tool - pauses for user approval
              getCaseStudies, // Lazy server tool - schema discovered on demand
            ],
            systemPrompts: [SYSTEM_PROMPT],
            agentLoopStrategy: maxIterations(5),
            messages: params.messages,
            threadId: params.threadId,
            runId: params.runId,
            ...(params.resume ? { resume: params.resume } : {}),
            // Toggleable from the client for live request/chunk tracing.
            // Errors log by default even without this flag.
            ...(raw.debug === true ? { debug: true } : {}),
            middleware: [
              studioUsageMiddleware, // per-thread token/tool metering
              withPersistence(persistence), // server-side transcripts, runs, interrupts
            ],
            abortController,
          })

          return toServerSentEventsResponse(stream, { abortController })
        } catch (error: any) {
          console.error('[chat] request failed:', error)
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
