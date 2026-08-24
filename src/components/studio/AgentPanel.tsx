import { useEffect, useRef, useState } from 'react'
import { Send, Square } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { useStudioChat } from '#/lib/demo-ai-hook'
import type { ChatMessages } from '#/lib/demo-ai-hook'
import OfferCard from '#/components/demo-OfferCard'

import HowItWorks from './HowItWorks'

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
      'The model calls the getServices SERVER tool to fetch live catalog data mid-conversation. The server executes it and feeds results back into the loop — the browser never sees your data source.',
    suggestions: [
      'What services do you offer?',
      'Which package is best for automating invoices?',
      'Compare your cheapest and most complete offerings',
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

export default function AgentPanel({
  focus,
}: {
  focus: keyof typeof FOCUS
}) {
  const { blurb, suggestions } = FOCUS[focus]
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading, stop, interrupts } =
    useStudioChat()
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const send = (text: string) => {
    if (!text.trim() || isLoading) return
    sendMessage(text)
    setInput('')
  }

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">{blurb}</p>

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
              <div className="flex flex-col gap-2 w-full max-w-md">
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
              {(messages as ChatMessages).map((message) => (
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
                    <div className="min-w-0 flex-1 text-sm text-[var(--sea-ink)] [&_div]:max-w-none">
                      {message.parts.map((part, partIndex) => {
                        if (part.type === 'text' && part.content) {
                          return (
                            <Streamdown key={partIndex}>
                              {part.content}
                            </Streamdown>
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
            send(input)
          }}
          className="border-t border-[var(--line)] p-3"
        >
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your business..."
              className="demo-textarea pr-10 text-sm"
              rows={1}
              style={{ minHeight: '36px', maxHeight: '120px' }}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                  e.preventDefault()
                  send(input)
                }
              }}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-red-500"
                title="Stop"
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
              ? 'How this works: server-side tools'
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
              <code>toServerSentEventsResponse()</code> turns them into SSE.
            </li>
            <li>
              Client: <code>useChat()</code> + <code>fetchServerSentEvents()</code> parse
              the stream into typed message parts automatically.
            </li>
            <li>
              The consultant persona comes entirely from{' '}
              <code>systemPrompts</code> in{' '}
              <code>src/routes/demo/api.ai.chat.ts</code>.
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
              The result is validated by <code>outputSchema</code> and fed back so
              the model can reason over fresh data — no hallucinated catalogs.
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
              <code>scheduleIntroCallDef</code> sets <code>needsApproval: true</code>{' '}
              and a server implementation that writes to a (fake) calendar.
            </li>
            <li>
              When the model calls it, the run pauses at an interrupt boundary
              with <code>RUN_FINISHED.outcome = interrupt</code>;{' '}
              <code>useChat</code> surfaces it in the <code>interrupts</code> array.
            </li>
            <li>
              Approve/Deny calls <code>interrupt.resolveInterrupt(...)</code>; the
              client sends the resume batch and the endpoint forwards it via{' '}
              <code>chatParamsFromRequest()</code> →{' '}
              <code>chat({'{ resume }'})</code>.
            </li>
            <li>
              Pending approvals survive reloads when persistence is wired — the
              approval UI repaints on mount. Files:{' '}
              <code>studio-tools.ts</code>, <code>api.ai.chat.ts</code>
            </li>
          </ul>
        )}
      </HowItWorks>
    </div>
  )
}
