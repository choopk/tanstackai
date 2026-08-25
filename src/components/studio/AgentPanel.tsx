import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Square, X, Bug, RadioTower } from 'lucide-react'
import { Streamdown } from 'streamdown'

import {
  createStudioChatOptions,
  type ChatTransport,
  type StudioChatRuntimeOptions,
} from '#/lib/demo-ai-hook'
import { useChat } from '@tanstack/ai-react'
import OfferCard from '#/components/demo-OfferCard'

import HowItWorks from './HowItWorks'

// Answer form for the discovery-intake GENERIC interrupt. The shape is
// typed by the shared defineInterrupt() responseSchema registered in
// createStudioChatOptions.
function IntakeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (answer: {
    teamSize: '1-5' | '6-20' | '21-100' | '100+'
    biggestTimeDrain: string
  }) => void
  onCancel: () => void
}) {
  const [teamSize, setTeamSize] = useState<'1-5' | '6-20' | '21-100' | '100+'>(
    '1-5',
  )
  const [drain, setDrain] = useState('')
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        value={teamSize}
        onChange={(e) => setTeamSize(e.target.value as typeof teamSize)}
        className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1.5 text-xs text-[var(--sea-ink)]"
      >
        <option value="1-5">Team: 1–5</option>
        <option value="6-20">Team: 6–20</option>
        <option value="21-100">Team: 21–100</option>
        <option value="100+">Team: 100+</option>
      </select>
      <input
        value={drain}
        onChange={(e) => setDrain(e.target.value)}
        placeholder="Biggest time drain..."
        className="demo-textarea min-h-0 flex-1 py-1.5 text-xs"
        style={{ minHeight: '32px', maxHeight: '32px' }}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({ teamSize, biggestTimeDrain: drain })}
          disabled={drain.trim().length < 3}
          className="demo-button px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Answer
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs demo-muted transition hover:text-[var(--sea-ink)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

const FOCUS = {
  chat: {
    title: 'Advisor Chat',
    blurb:
      'A streaming AI consultant for your business. Responses stream token-by-token over server-sent events.',
    suggestions: [
      'I run a 5-person dental clinic buried in paperwork',
      'How can I stop missing customer calls at my salon?',
      'What would automate lead follow-up for my real estate team?',
    ],
  },
  data: {
    title: 'Data Agent',
    blurb:
      'The model calls the getServices SERVER tool to fetch live catalog data mid-conversation. Try asking for proof of past results too — that triggers getCaseStudies, a LAZY tool whose schema is discovered on demand instead of shipped in every prompt.',
    suggestions: [
      'What services do you offer?',
      'Which package is best for automating invoices?',
      'Show me proof of past results from your clients',
    ],
  },
  actions: {
    title: 'Action Agent',
    blurb:
      'The model emits a showOffer CLIENT tool call that streams down to this page, where our code renders an interactive offer card. The LLM drives your UI.',
    suggestions: [
      'Show me something that handles my phone calls',
      'I need marketing content for my bakery',
      'Offer me a package for document processing',
    ],
  },
  approvals: {
    title: 'Approval-Gated Agent',
    blurb:
      'Ask to book a discovery call. The model will call scheduleIntroCall — which has needsApproval: true — and the run PAUSES until you approve or deny it below. Nothing executes without a human click.',
    suggestions: [
      'Can we set up a discovery call Tuesday at 2pm about automating my invoices?',
      'I want to move forward - book me a call to discuss the voice receptionist',
      "Schedule a call for next Monday morning to talk about my salon's missed calls",
    ],
  },
} as const

// Providers selectable at runtime. The server silently falls back to the
// best configured provider when a key is missing.
const PROVIDERS = [
  { id: '', label: 'Auto (best available)' },
  { id: 'openrouter', label: 'OpenRouter free' },
  { id: 'anthropic', label: 'Claude Haiku' },
  { id: 'openai', label: 'GPT-4o' },
  { id: 'gemini', label: 'Gemini Flash' },
  { id: 'ollama', label: 'Ollama (local)' },
]

export default function AgentPanel({
  focus,
}: {
  focus: keyof typeof FOCUS
}) {
  const { blurb, suggestions } = FOCUS[focus]
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState('')
  const [debug, setDebug] = useState(false)
  const [transport, setTransport] = useState<ChatTransport>('sse')
  const [intake, setIntake] = useState(focus === 'approvals')

  // Latest run correlation id (via onRunIdChange) — used for the
  // out-of-band server cancel (requestRunCancel control plane).
  const runIdRef = useRef<string | null>(null)
  const handlersRef = useRef({
    onRunIdChange: (runId: string | null) => {
      runIdRef.current = runId
    },
  })

  // Runtime adapter switching + debug flag ride to the server via `body`.
  const runtime = useMemo<StudioChatRuntimeOptions>(
    () => ({
      ...(provider ? { provider } : {}),
      ...(debug ? { debug: true } : {}),
      transport,
      ...(intake ? { intake: true } : {}),
    }),
    [provider, debug, transport, intake],
  )
  const chatOptions = useMemo(
    () => createStudioChatOptions(runtime, handlersRef.current),
    [runtime],
  )

  const {
    messages,
    sendMessage,
    isLoading,
    stop,
    interrupts,
    queue,
    cancelQueued,
  } = useChat(chatOptions)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const send = (text?: string) => {
    const message = text ?? input
    if (!message.trim() || isLoading) return
    sendMessage(message)
    setInput('')
  }

  // Graceful cancellation with a durable reason code: record intent on the
  // SERVER first (requestRunCancel), then drop the connection locally.
  const stopAndCancel = async () => {
    const runId = runIdRef.current
    stop()
    if (!runId) return
    try {
      await fetch('/demo/api/ai/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      })
    } catch {
      // Local stop already took effect; cancel endpoint is best-effort.
    }
  }

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">{blurb}</p>

      {/* Runtime controls: adapter switching + debug logging */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2">
        <label className="flex items-center gap-2 text-xs demo-muted">
          Provider
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--sea-ink)]"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs demo-muted">
          Transport
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value as ChatTransport)}
            className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--sea-ink)]"
          >
            <option value="sse">SSE (HTTP stream)</option>
            <option value="ws">WebSocket (full-duplex)</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs demo-muted">
          <input
            type="checkbox"
            checked={intake}
            onChange={(e) => setIntake(e.target.checked)}
            className="accent-[var(--lagoon-deep)]"
          />
          <RadioTower className="h-3.5 w-3.5" />
          Discovery intake interrupt
        </label>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs demo-muted">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
            className="accent-[var(--lagoon-deep)]"
          />
          <Bug className="h-3.5 w-3.5" />
          Debug logging (server console)
        </label>
      </div>

      {interrupts.map((interrupt) =>
        interrupt.kind === 'generic' &&
        'definitionId' in interrupt &&
        interrupt.definitionId === 'discovery-intake' ? (
          <div
            key={interrupt.binding.key}
            className="demo-card border-2 border-[var(--lagoon-deep)] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-[var(--sea-ink-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Generic interrupt
              </span>
              <code className="text-xs font-semibold text-[var(--sea-ink)]">
                discovery-intake#{interrupt.binding.key}
              </code>
            </div>
            <p className="demo-muted mb-3 text-sm">{interrupt.payload?.topic}</p>
            <IntakeForm
              onSubmit={(answer) => interrupt.resolveInterrupt(answer)}
              onCancel={() => interrupt.cancel()}
            />
          </div>
        ) : null,
      )}

      {interrupts.length > 0 && (
        <div className="mb-4 space-y-3">
          {interrupts.map((interrupt) =>
            interrupt.kind === 'tool-approval' ? (
              <div
                key={interrupt.toolCallId}
                className="demo-card border-2 border-[var(--lagoon-deep)] p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-[var(--lagoon-deep)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Approval required
                  </span>
                  <code className="text-xs font-semibold text-[var(--sea-ink)]">
                    {interrupt.toolName}
                  </code>
                </div>
                <pre className="demo-muted mb-3 overflow-x-auto rounded-lg bg-[var(--chip-bg)] p-3 text-xs">
                  {JSON.stringify(interrupt.originalArgs, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => interrupt.resolveInterrupt(true)}
                    className="demo-button px-4 py-1.5 text-sm"
                  >
                    Approve &amp; Execute
                  </button>
                  <button
                    onClick={() => interrupt.resolveInterrupt(false)}
                    className="demo-button demo-button-danger px-4 py-1.5 text-sm"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => interrupt.cancel()}
                    className="px-3 py-1.5 text-sm demo-muted transition hover:text-[var(--sea-ink)]"
                  >
                    Cancel run
                  </button>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Queued messages: sent while a stream was in flight */}
      {queue.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs demo-muted">Queued:</span>
          {queue.map((q) => (
            <span
              key={q.id}
              className="flex items-center gap-1 rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-xs text-[var(--sea-ink-soft)]"
            >
              {typeof q.content === 'string'
                ? q.content.slice(0, 40)
                : '[attachment]'}
              <button onClick={() => cancelQueued(q.id)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="demo-card flex flex-col p-0" style={{ height: '480px' }}>
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto rounded-xl"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm demo-muted">
                Try one of these, or ask anything:
              </p>
              <div className="flex w-full max-w-md flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2 text-xs text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`py-3 ${
                    message.role === 'assistant'
                      ? 'bg-[var(--chip-bg)]'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2 px-2">
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-medium text-white ${
                        message.role === 'assistant'
                          ? 'bg-[var(--lagoon-deep)]'
                          : 'bg-[var(--sea-ink-soft)]'
                      }`}
                    >
                      {message.role === 'assistant' ? 'AI' : 'Y'}
                    </div>
                    <div className="[&_div]:max-w-none min-w-0 flex-1 text-sm text-[var(--sea-ink)]">
                      {message.parts.map((part, partIndex) => {
                        if (part.type === 'thinking') {
                          return (
                            <details
                              key={partIndex}
                              className="mb-2 rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5"
                            >
                              <summary className="cursor-pointer list-none text-xs italic demo-muted">
                                Thinking...
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap text-xs italic demo-muted">
                                {part.content}
                              </pre>
                            </details>
                          )
                        }
                        if (part.type === 'text' && part.content) {
                          return (
                            <Streamdown key={partIndex}>{part.content}</Streamdown>
                          )
                        }
                        if (
                          part.type === 'tool-call' &&
                          part.name === 'showOffer' &&
                          part.output
                        ) {
                          return (
                            <OfferCard
                              key={part.id}
                              id={String(part.output?.id)}
                            />
                          )
                        }
                        if (part.type === 'tool-call') {
                          return (
                            <p
                              key={part.id}
                              className="demo-muted py-1 text-xs italic"
                            >
                              calling tool: {part.name}...
                            </p>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="border-t border-[var(--line)] p-3"
        >
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isLoading
                  ? 'Streaming... anything you type now gets queued'
                  : 'Describe your business...'
              }
              className="demo-textarea pr-10 text-sm"
              rows={1}
              style={{ minHeight: '36px', maxHeight: '120px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={stopAndCancel}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-red-500"
                title="Stop (also records a durable server-side cancel)"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--lagoon-deep)] transition hover:text-[var(--sea-ink)] disabled:text-[var(--sea-ink-soft)]"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      <HowItWorks
        title={
          focus === 'chat'
            ? 'How this works: streaming chat'
            : focus === 'data'
              ? 'How this works: server-side + lazy tools'
              : focus === 'actions'
                ? 'How this works: client-side tools'
                : 'How this works: tool approval (human-in-the-loop)'
        }
      >
        {focus === 'chat' && (
          <ul className="list-disc space-y-2 pl-4">
            <li>
              Server: <code>chat({'{ adapter, systemPrompts, agentLoopStrategy }'})</code>{' '}
              streams AG-UI events;{' '}
              <code>toServerSentEventsResponse()</code> turns them into SSE — or{' '}
              <code>toWebSocketStream()</code> over the full-duplex{' '}
              <code>WebSocket</code> transport (switch above).
            </li>
            <li>
              The agent loop is governed by composed strategies:{' '}
              <code>combineStrategies([maxIterations(8), untilFinishReason(['stop','length'])])</code>{' '}
              — AND logic that stops the run at the first complete answer.
            </li>
            <li>
              Client: <code>useChat()</code> + <code>fetchServerSentEvents()</code> or{' '}
              <code>webSocket()</code> parse the stream into typed message parts
              automatically.
            </li>
          </ul>
        )}
        {focus === 'data' && (
          <ul className="list-disc space-y-2 pl-4">
            <li>
              <code>getServicesToolDef.server(...)</code> attaches an execute function
              that runs on the server when the model requests it.
            </li>
            <li>
              <strong>Lazy tools:</strong>{' '}
              <code>getCaseStudies</code> sets <code>lazy: true</code>, so its schema is
              NOT sent with every prompt. The model sees a synthetic{' '}
              <code>__lazy__tool__discovery__</code> tool and pulls the schema only
              when needed — then it stays available for the conversation.
            </li>
            <li>
              Swap the static array for your database and you have a real
              data-grounded agent. File:{' '}
              <code>src/lib/studio-tools.ts</code>
            </li>
          </ul>
        )}
        {focus === 'actions' && (
          <ul className="list-disc space-y-2 pl-4">
            <li>
              The definition has NO <code>.server()</code> implementation, so the
              tool call streams to the browser instead of executing.
            </li>
            <li>
              On the client, <code>showOfferToolDef.client(...)</code> runs in this
              page via <code>clientTools()</code>, returning{' '}
              <code>{'{ id, displayed: true }'}</code> back to the model.
            </li>
            <li>
              Meanwhile the UI renders an <code>&lt;OfferCard /&gt;</code> whenever a{' '}
              <code>tool-call</code> part named <code>showOffer</code> appears.
            </li>
          </ul>
        )}
        {focus === 'approvals' && (
          <ul className="list-disc space-y-2 pl-4">
            <li>
              <strong>Tool approval:</strong>{' '}
              <code>scheduleIntroCallDef</code> sets <code>needsApproval: true</code>{' '}
              and a server implementation that writes to a (fake) calendar.
              When the model calls it, the run pauses at an interrupt boundary
              with <code>RUN_FINISHED.outcome = interrupt</code>.
            </li>
            <li>
              <strong>Generic interrupts:</strong> with "Discovery intake" checked,
              a middleware raises a <code>defineInterrupt()</code>-typed question at the{' '}
              <code>beforeTools</code> boundary (payload/response Zod schemas shared by
              server and client). Answering it resumes the batch; cancelling returns{' '}
              <code>toolResume: 'stop'</code>.
            </li>
            <li>
              Approve/Deny calls <code>interrupt.resolveInterrupt(...)</code>; the
              client sends the resume batch and the endpoint forwards it via{' '}
              <code>chatParamsFromRequest()</code> →{' '}
              <code>chat({'{ resume }'})</code>. Pending approvals survive reloads.
            </li>
            <li>
              <strong>Durable cancel:</strong> the stop button first POSTs to{' '}
              <code>/demo/api/ai/cancel</code>, which records an explicit cancel via{' '}
              <code>requestRunCancel</code>; middleware reads it back with{' '}
              <code>AbortInfo.cancelRequested</code> / <code>wasCancelRequested</code>{' '}
              to distinguish "user stopped it" from "viewer left". Files:{' '}
              <code>studio-intake.ts</code>, <code>studio-ws-server.ts</code>,{' '}
              <code>api.ai.cancel.ts</code>
            </li>
          </ul>
        )}
      </HowItWorks>
    </div>
  )
}
