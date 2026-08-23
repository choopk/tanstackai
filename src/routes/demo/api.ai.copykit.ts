import { createFileRoute } from '@tanstack/react-router'
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { openRouterText } from '@tanstack/ai-openrouter'
import { z } from 'zod'

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

// Schema for a complete marketing copy kit, validated on the server
const CopyKitSchema = z.object({
  businessName: z.string().describe('The business name'),
  tagline: z.string().describe('A short memorable tagline'),
  heroHeadline: z.string().describe('Landing page hero headline'),
  heroSubheadline: z
    .string()
    .describe('One or two sentences expanding on the headline'),
  socialPosts: z
    .array(
      z.object({
        platform: z.enum(['x', 'linkedin', 'instagram']),
        text: z.string(),
      }),
    )
    .describe('Three social posts, one per platform'),
  emailSubject: z.string().describe('Subject line for a launch/promo email'),
  emailBody: z
    .string()
    .describe('Short promotional email body (2-3 short paragraphs)'),
  ctaSuggestions: z
    .array(z.string())
    .describe('Three call-to-action button texts'),
})

export type CopyKit = z.infer<typeof CopyKitSchema>

export const Route = createFileRoute('/demo/api/ai/copykit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { description, tone = 'friendly and professional' } = body

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

          const result = await chat({
            adapter: adapter(),
            modelOptions:
              provider === 'openrouter' ? { maxCompletionTokens: 4096 } : undefined,
            systemPrompts: [
              'You output ONLY a single raw JSON object matching the requested schema. No markdown fences, no commentary, no blank lines.',
            ],
            messages: [
              {
                role: 'user',
                content: `Generate a marketing copy kit for this business: ${description}

Tone of voice: ${tone}.`,
              },
            ],
            outputSchema: CopyKitSchema,
          } as any)

          return new Response(
            JSON.stringify({ kit: result, provider, model }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
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
