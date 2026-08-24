import { createFileRoute } from '@tanstack/react-router'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { openRouterText } from '@tanstack/ai-openrouter'

import { CopyKitSchema } from '#/lib/studio-schemas'

const FREE_MODEL = 'openrouter/free'

function resolveAdapter() {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      adapter: () => openRouterText(FREE_MODEL as any),
      provider: 'openrouter',
      model: FREE_MODEL,
    }
  }
  return { adapter: () => openaiText('gpt-4o'), provider: 'openai', model: 'gpt-4o' }
}

export const Route = createFileRoute('/demo/api/ai/copykit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const {
          description,
          tone = 'friendly and professional',
          // 'json' (default): one validated object. 'streaming': SSE with
          // incremental JSON deltas + a terminal structured-output event.
          mode = 'json',
        } = body

        if (!description || description.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'Business description is required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        try {
          const { adapter, provider, model } = resolveAdapter()

          const messages = [
            {
              role: 'user' as const,
              content: `Generate a marketing copy kit for this business: ${description}

Tone of voice: ${tone}.`,
            },
          ]

          if (mode === 'streaming') {
            const stream = chat({
              adapter: adapter(),
              modelOptions:
                provider === 'openrouter' ? { maxCompletionTokens: 4096 } : undefined,
              systemPrompts: [
                'You output ONLY a single raw JSON object matching the requested schema. No markdown fences, no commentary, no blank lines.',
              ],
              messages,
              outputSchema: CopyKitSchema,
              stream: true,
            } as any)

            return toServerSentEventsResponse(stream)
          }

          const result = await chat({
            adapter: adapter(),
            modelOptions:
              provider === 'openrouter' ? { maxCompletionTokens: 4096 } : undefined,
            systemPrompts: [
              'You output ONLY a single raw JSON object matching the requested schema. No markdown fences, no commentary, no blank lines.',
            ],
            messages,
            outputSchema: CopyKitSchema,
          } as any)

          return new Response(JSON.stringify({ kit: result, provider, model }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: error.message || 'An error occurred' }),
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
