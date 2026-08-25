import { chat, combineStrategies, maxIterations, untilFinishReason } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { openaiText } from '@tanstack/ai-openai'
import { geminiText } from '@tanstack/ai-gemini'
import { ollamaText } from '@tanstack/ai-ollama'
import { openRouterText } from '@tanstack/ai-openrouter'
import { withPersistence } from '@tanstack/ai-persistence'

import { discoveryIntake, intakeMiddleware } from './studio-intake'
import { persistence } from './studio-persistence'
import { studioTools } from './studio-tool-registry'
import { studioUsage } from './studio-usage'

export const STUDIO_SYSTEM_PROMPT = `You are an AI solutions consultant who helps small business owners find the right AI automation for their business.

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

// Providers actually usable in this environment (key present)
const AVAILABLE_PROVIDERS = [
  ...(process.env.OPENROUTER_API_KEY ? ['openrouter'] : []),
  ...(process.env.ANTHROPIC_API_KEY ? ['anthropic'] : []),
  ...(process.env.OPENAI_API_KEY ? ['openai'] : []),
  ...(process.env.GEMINI_API_KEY ? ['gemini'] : []),
  'ollama',
] as const

const MODELS = {
  openrouter: 'openrouter/free',
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash-exp',
  ollama: 'mistral:7b',
} as const

// Adapter factory pattern for multi-vendor support. Model ids are cast:
// several are runtime-resolved (OpenRouter free router, Ollama local tags).
const ADAPTER_FACTORIES = {
  openrouter: () => openRouterText(MODELS.openrouter as never),
  anthropic: () => anthropicText(MODELS.anthropic),
  openai: () => openaiText(MODELS.openai),
  gemini: () => geminiText(MODELS.gemini as never),
  ollama: () => ollamaText(MODELS.ollama as never),
}

export function resolveProvider(requested?: string | null) {
  const provider =
    requested && (AVAILABLE_PROVIDERS as readonly string[]).includes(requested)
      ? requested
      : AVAILABLE_PROVIDERS[0]
  return {
    provider,
    model: MODELS[provider as keyof typeof MODELS] ?? MODELS.ollama,
    adapter: ADAPTER_FACTORIES[provider as keyof typeof ADAPTER_FACTORIES](),
  }
}

export interface StudioTurnInput {
  messages: Array<unknown>
  threadId?: string
  runId?: string
  /** Resume batch forwarded from an interrupt continuation. */
  resume?: Array<unknown>
  /** Requested provider; falls back to the best configured one. */
  provider?: string | null
  debug?: boolean
  /** Opt-in generic interrupt demo (discovery intake before tools run). */
  intake?: boolean
  abortController?: AbortController
}

// One shared pipeline for BOTH transports (SSE route + WebSocket endpoint):
// same adapter selection, registry tools, loop strategy, interrupts and
// middleware stack.
export function runStudioTurn(input: StudioTurnInput) {
  const { provider, adapter } = resolveProvider(input.provider)

  // AGENT LOOP STRATEGIES, composed: keep iterating while the model wants
  // tools (max 8 turns), but stop the moment it produces a final answer.
  // combineStrategies is AND logic — every strategy must agree to continue.
  const agentLoopStrategy = combineStrategies([
    maxIterations(8),
    untilFinishReason(['stop', 'length']),
  ])

  return chat({
    adapter: adapter as never,
    modelOptions:
      provider === 'openrouter'
        ? ({ maxCompletionTokens: 1024 } as never)
        : undefined,
    // Managed tool registry instead of an inline array (see studio-tool-registry.ts)
    tools: studioTools.getTools(),
    systemPrompts: [STUDIO_SYSTEM_PROMPT],
    agentLoopStrategy,
    messages: input.messages as never,
    // Generic interrupt definitions registered server-side; the client
    // registers the same definition so its answers are typed.
    interrupts: [discoveryIntake],
    context: { intake: input.intake === true },
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.resume ? { resume: input.resume as never } : {}),    // Toggleable from the client for live request/chunk tracing.
    ...(input.debug ? { debug: true } : {}),
    middleware: [
      ...studioUsage, // capability-backed per-thread metering
      intakeMiddleware, // raises the discovery-intake generic interrupt
      withPersistence(persistence), // transcripts, runs, durable interrupts
    ],
    ...(input.abortController ? { abortController: input.abortController } : {}),
  })
}
