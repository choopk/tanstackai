import { useState } from 'react'
import { ImageIcon, Loader2, Download } from 'lucide-react'

import HowItWorks from './HowItWorks'

interface GeneratedImage {
  url?: string
  b64Json?: string
  revisedPrompt?: string
}

const PRESETS = [
  {
    label: 'Product shot',
    prompt:
      'Professional product photo of a ceramic coffee mug on a marble countertop, soft morning light, minimal styling',
  },
  {
    label: 'Social ad',
    prompt:
      'Bold social media ad for a summer sale, vibrant gradient background, energetic composition, space for headline text',
  },
  {
    label: 'Hero banner',
    prompt:
      'Wide hero banner for a landscaping company website, lush garden at golden hour, clean modern feel',
  },
]

export default function ImagePanel() {
  const [prompt, setPrompt] = useState(PRESETS[0].prompt)
  const [size, setSize] = useState('1024x1024')
  const [images, setImages] = useState<Array<GeneratedImage>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!prompt.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setImages([])
    try {
      const response = await fetch('/demo/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size, numberOfImages: 1 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Generation failed')
      setImages(data.images)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const getImageSrc = (image: GeneratedImage) => {
    if (image.url) return image.url
    if (image.b64Json) return `data:image/png;base64,${image.b64Json}`
    return ''
  }

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        Generate product visuals and ad creatives from a text prompt. Businesses
        pay for on-demand creative — this endpoint pattern is the core of that
        service.
      </p>

      <div className="demo-card space-y-4 p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="demo-textarea w-full"
          rows={2}
        />
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPrompt(p.prompt)}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs demo-muted transition hover:text-[var(--sea-ink)]"
            >
              {p.label}
            </button>
          ))}
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--sea-ink)]"
          >
            <option value="1024x1024">Square</option>
            <option value="1536x1024">Landscape</option>
            <option value="1024x1536">Portrait</option>
            <option value="auto">Auto</option>
          </select>
          <button
            onClick={generate}
            disabled={!prompt.trim() || isLoading}
            className="demo-button ml-auto px-4 py-2 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate Image
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error} — image generation needs a small positive OpenRouter credit
          balance.
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {images.map((image, i) => (
            <div key={i} className="demo-card overflow-hidden p-0">
              <img
                src={getImageSrc(image)}
                alt={prompt}
                className="w-full object-cover"
              />
              <button
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = getImageSrc(image)
                  a.download = `ad-creative-${i + 1}.png`
                  a.click()
                }}
                className="flex w-full items-center justify-center gap-2 border-t border-[var(--line)] py-2 text-sm demo-muted transition hover:text-[var(--sea-ink)]"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
          ))}
        </div>
      )}

      <HowItWorks title="How this works: media generation">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            The server route uses <code>generateImage()</code> adapters — or a direct
            provider call when token caps require it.
          </li>
          <li>
            Images come back as base64 data URLs ready to render or store.
          </li>
          <li>
            TanStack AI also ships <code>useGenerateImage()</code>,{' '}
            <code>useGenerateVideo()</code> and <code>generateSpeech()</code>{' '}
            adapters for full multi-modal apps. File:{' '}
            <code>src/routes/demo/api.ai.image.ts</code>
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
