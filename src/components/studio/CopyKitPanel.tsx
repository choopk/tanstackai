import { useMemo, useState } from 'react'
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  Zap,
  FileJson,
} from 'lucide-react'
import {
  createChatClientOptions,
  fetchServerSentEvents,
  useChat,
} from '@tanstack/ai-react'

import { CopyKitSchema, type CopyKit } from '#/lib/studio-schemas'

import HowItWorks from './HowItWorks'

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

function KitView({ kit }: { kit: CopyKit }) {
  return (
    <div className="space-y-4">
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
          {(kit.ctaSuggestions ?? []).map((cta) => (
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
        {(kit.socialPosts ?? []).map((post) => (
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
  )
}

// Progressive view while JSON deltas stream in via `partial`
function PartialView({ partial }: { partial: Partial<CopyKit> }) {
  return (
    <div className="demo-card mt-6 space-y-3 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--lagoon-deep)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Streaming fields as they arrive...
      </div>
      {partial.businessName && (
        <h3 className="text-xl font-bold text-[var(--sea-ink)]">
          {partial.businessName}
        </h3>
      )}
      {partial.tagline && (
        <p className="text-sm italic text-[var(--lagoon-deep)]">
          “{partial.tagline}”
        </p>
      )}
      {partial.heroHeadline && (
        <h4 className="font-semibold text-[var(--sea-ink)]">
          {partial.heroHeadline}
        </h4>
      )}
      {partial.heroSubheadline && (
        <p className="demo-muted text-sm">{partial.heroSubheadline}</p>
      )}
      {partial.socialPosts && partial.socialPosts.length > 0 && (
        <p className="text-xs demo-muted">
          social posts: {partial.socialPosts.length}/3
        </p>
      )}
      {!partial.businessName && (
        <p className="text-xs demo-muted">Waiting for first field...</p>
      )}
    </div>
  )
}

export default function CopyKitPanel() {
  // 'json' = await chat({ outputSchema }) — one validated object
  // 'streaming' = SSE + useChat({ outputSchema }) with live partial
  const [mode, setMode] = useState<'json' | 'streaming'>('streaming')
  const [description, setDescription] = useState('')
  const [tone, setTone] = useState('friendly and professional')
  const [kit, setKit] = useState<CopyKit | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- One-shot mode ----
  const generateJson = async () => {
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

  // ---- Streaming mode: partial fills field-by-field, final snaps in ----
  // outputSchema is a useChat-level option (client-side typing of
  // partial/final); the server validates against its own copy.
  const streamOptions = useMemo(
    () =>
      createChatClientOptions({
        connection: fetchServerSentEvents('/demo/api/ai/copykit?mode=streaming'),
      }),
    [],
  )
  const { sendMessage: sendStream, partial, final } = useChat({
    ...streamOptions,
    outputSchema: CopyKitSchema,
  })

  const generateStreaming = () => {
    if (!description.trim()) return
    setError(null)
    sendStream(
      `Generate a marketing copy kit for this business: ${description}\n\nTone of voice: ${tone}.`,
    )
  }

  const generate =
    mode === 'json'
      ? generateJson
      : generateStreaming

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        Describe any business and get a complete, validated marketing kit back
        as typed JSON — landing copy, social posts, an email sequence, and CTAs.
        This is a service you can deliver to clients in minutes.
      </p>

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: 'streaming', label: 'Streaming', icon: Zap },
            { id: 'json', label: 'One-shot JSON', icon: FileJson },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs transition ${
              mode === id
                ? 'bg-[var(--lagoon-deep)] font-semibold text-white'
                : 'border border-[var(--line)] demo-muted hover:text-[var(--sea-ink)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

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

      {mode === 'json' && kit && <div className="mt-6"><KitView kit={kit} /></div>}

      {mode === 'streaming' &&
        (partial && Object.keys(partial).length > 0 && !final ? (
          <PartialView partial={partial as Partial<CopyKit>} />
        ) : final ? (
          <div className="mt-6">
            <KitView kit={final as CopyKit} />
          </div>
        ) : null)}

      <HowItWorks title="How this works: structured output, one-shot vs streaming">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            Both modes pass the same Zod schema (<code>CopyKitSchema</code>, shared
            between client and server in{' '}
            <code>src/lib/studio-schemas.ts</code>) as{' '}
            <code>outputSchema</code>.
          </li>
          <li>
            <strong>One-shot:</strong>{' '}
            <code>await chat({'{ outputSchema }'})</code> returns a fully typed,
            server-validated object. Simple, but you wait for the whole thing.
          </li>
          <li>
            <strong>Streaming:</strong> add <code>stream: true</code> server-side and{' '}
            <code>useChat({'{ outputSchema }'})</code> client-side — the hook's{' '}
            <code>partial</code> fills field-by-field from JSON deltas and{' '}
            <code>final</code> snaps to the completed object on the terminal{' '}
            <code>structured-output.complete</code> event.
          </li>
          <li>
            The adapter handles provider differences transparently — never configure
            provider-specific response formats yourself.
          </li>
          <li>
            Files: <code>src/routes/demo/api.ai.copykit.ts</code>, this panel
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
