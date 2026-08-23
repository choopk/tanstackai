import { createFileRoute } from '@tanstack/react-router'
import { generateImage } from '@tanstack/ai'
import { openaiImage } from '@tanstack/ai-openai'

const OPENROUTER_IMAGE_MODEL = 'google/gemini-2.5-flash-image'
// Cap output tokens so image requests fit small credit balances
// (a single 1024x1024 Gemini image costs ~1290 output tokens)
const OPENROUTER_IMAGE_MAX_TOKENS = 4096

const SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  '1024x1024': '1:1',
  '832x1248': '2:3',
  '1248x832': '3:2',
  '864x1184': '3:4',
  '1184x864': '4:3',
  '896x1152': '4:5',
  '1152x896': '5:4',
  '768x1344': '9:16',
  '1344x768': '16:9',
  '1536x672': '21:9',
}

type OpenRouterImageResult = { b64Json?: string; url?: string }

async function generateViaOpenRouter(
  prompt: string,
  numberOfImages: number,
  size: string,
): Promise<OpenRouterImageResult[]> {
  const aspectRatio = SIZE_TO_ASPECT_RATIO[size] ?? '1:1'
  const results: OpenRouterImageResult[] = []

  // The chat-completions image pathway generates one image per request
  for (let i = 0; i < numberOfImages; i++) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_IMAGE_MODEL,
        modalities: ['image'],
        max_tokens: OPENROUTER_IMAGE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
        image_config: { aspect_ratio: aspectRatio },
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(
        error?.error?.message ||
          `OpenRouter image request failed with status ${response.status}`,
      )
    }

    const data = await response.json()
    const images = data?.choices?.[0]?.message?.images ?? []
    for (const img of images) {
      const url: string | undefined = img?.image_url?.url
      if (!url) continue
      if (url.startsWith('data:')) {
        const match = url.match(/^data:image\/[^;]+;base64,(.+)$/)
        if (match) results.push({ b64Json: match[1] })
      } else {
        results.push({ url })
      }
    }
  }

  if (results.length === 0) {
    throw new Error('Image generation failed: response contained no images')
  }
  return results
}

export const Route = createFileRoute('/demo/api/ai/image')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { prompt, numberOfImages = 1, size = '1024x1024' } = body

        if (!prompt || prompt.trim().length === 0) {
          return new Response(
            JSON.stringify({
              error: 'Prompt is required',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
          return new Response(
            JSON.stringify({
              error:
                'No image provider configured. Set OPENROUTER_API_KEY (preferred) or OPENAI_API_KEY in .env.local',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
        const model = useOpenRouter ? OPENROUTER_IMAGE_MODEL : 'gpt-image-1'

        try {
          const images = useOpenRouter
            ? await generateViaOpenRouter(prompt, numberOfImages, size)
            : (
                await generateImage({
                  adapter: openaiImage('gpt-image-1'),
                  prompt,
                  numberOfImages,
                  size: size as '1024x1024',
                })
              ).images

          return new Response(
            JSON.stringify({
              images,
              model,
              provider: useOpenRouter ? 'openrouter' : 'openai',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error.message || 'An error occurred',
            }),
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
