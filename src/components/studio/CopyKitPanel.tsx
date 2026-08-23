import { useState } from 'react'
import { Loader2, Sparkles, Copy, Check } from 'lucide-react'

import HowItWorks from './HowItWorks'

interface CopyKit {
  businessName: string
  tagline: string
  heroHeadline: string
  heroSubheadline: string
  socialPosts: Array<{ platform: string; text: string }>
  emailSubject: string
  emailBody: string
  ctaSuggestions: Array<string>
}

const EXAMPLES = [
  'Family-owned bakery in Austin, known for sourdough, open since 1998',
  'Freelance wedding photographer shooting 30 events a year',
  'Boutique gym offering small-group strength coaching for busy professionals',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="demo-muted p-1 transition hover:text-[var(--lagoon-deep)]"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function CopyKitPanel() {
  const [description, setDescription] = useState('')
  const [tone, setTone] = useState('friendly and professional')
  const [kit, setKit] = useState<CopyKit | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!description.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setKit(null)
    try {
      const response = await fetch('/demo/api/ai/copykit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, tone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Generation failed')
      setKit(data.kit)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        Describe any business and get a complete, validated marketing kit back
        as typed JSON — landing copy, social posts, an email sequence, and CTAs.
        This is a service you can deliver to clients in minutes.
      </p>

      <div className="demo-card space-y-4 p-4">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the business (what it does, who it serves, what makes it special)..."
          className="demo-textarea w-full"
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm demo-muted">Tone:</span>
          {['friendly and professional', 'bold and punchy', 'premium and elegant'].map(
            (t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  tone === t
                    ? 'border-[var(--lagoon-deep)] bg-[var(--chip-bg)] font-semibold text-[var(--sea-ink)]'
                    : 'border-[var(--line)] demo-muted hover:text-[var(--sea-ink)]'
                }`}
              >
                {t}
              </button>
            ),
          )}
          <button
            onClick={generate}
            disabled={!description.trim() || isLoading}
            className="demo-button ml-auto px-4 py-2 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Copy Kit
              </>
            )}
          </button>
        </div>
        {!description && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs demo-muted">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setDescription(ex)}
                className="rounded-full bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
              >
                {ex.length > 40 ? ex.slice(0, 40) + '…' : ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {kit && (
        <div className="mt-6 space-y-4">
          <div className="demo-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[var(--sea-ink)]">
                {kit.businessName}
              </h3>
              <CopyButton text={`${kit.tagline}\n\n${kit.heroHeadline}\n${kit.heroSubheadline}`} />
            </div>
            <p className="text-sm font-medium italic text-[var(--lagoon-deep)]">
              “{kit.tagline}”
            </p>
            <hr className="my-4 border-[var(--line)]" />
            <h4 className="text-lg font-semibold text-[var(--sea-ink)]">
              {kit.heroHeadline}
            </h4>
            <p className="demo-muted mt-1 text-sm">{kit.heroSubheadline}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {kit.ctaSuggestions.map((cta) => (
                <span
                  key={cta}
                  className="rounded-full bg-[var(--lagoon-deep)] px-4 py-1.5 text-sm font-semibold text-white"
                >
                  {cta}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {kit.socialPosts.map((post) => (
              <div key={post.platform} className="demo-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lagoon-deep)]">
                    {post.platform}
                  </span>
                  <CopyButton text={post.text} />
                </div>
                <p className="text-sm text-[var(--sea-ink)]">{post.text}</p>
              </div>
            ))}
          </div>

          <div className="demo-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lagoon-deep)]">
                Email campaign
              </span>
              <CopyButton text={`Subject: ${kit.emailSubject}\n\n${kit.emailBody}`} />
            </div>
            <p className="font-semibold text-[var(--sea-ink)]">
              Subject: {kit.emailSubject}
            </p>
            <p className="demo-muted mt-2 whitespace-pre-line text-sm">
              {kit.emailBody}
            </p>
          </div>
        </div>
      )}

      <HowItWorks title="How this works: structured output">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            The server defines a Zod schema (<code>CopyKitSchema</code>) and passes it
            as <code>outputSchema</code> to <code>chat()</code>.
          </li>
          <li>
            TanStack AI converts the schema for each provider automatically — OpenAI
            gets <code>response_format</code>, Anthropic uses tool-based extraction.
            You never configure provider specifics.
          </li>
          <li>
            The result arrives fully typed and server-side validated:{' '}
            <code>result.heroHeadline</code> is a string, not a guess.
          </li>
          <li>
            File: <code>src/routes/demo/api.ai.copykit.ts</code>
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
