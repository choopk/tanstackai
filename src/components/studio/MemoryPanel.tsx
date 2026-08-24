import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { useMemoryChat, MEMORY_THREAD_ID } from '#/lib/memory-ai-hook'

import HowItWorks from './HowItWorks'

export default function MemoryPanel() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading } = useMemoryChat()
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const send = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="demo-muted max-w-2xl">
          This chat is cached in <strong>localStorage</strong> under a stable
          thread ID. Send a message, then{' '}
          <strong>reload the page</strong> — the full transcript repaints.
          Nothing was re-sent to a server to restore it.
        </p>
        <span className="ml-auto rounded-full bg-[var(--chip-bg)] px-3 py-1 font-mono text-xs text-[var(--sea-ink-soft)]">
          threadId: {MEMORY_THREAD_ID}
        </span>
      </div>

      <div className="demo-card flex flex-col p-0" style={{ height: '400px' }}>
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto rounded-xl"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm demo-muted">
              Say hello — this conversation will survive a page reload.
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
                    <div className="[&_div]:max-w-none min-w0 flex-1 text-sm text-[var(--sea-ink)] min-w-0">
                      {message.parts.map((part, i) =>
                        part.type === 'text' && part.content ? (
                          <Streamdown key={i}>{part.content}</Streamdown>
                        ) : null,
                      )}
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
              placeholder="Type a message..."
              className="demo-textarea pr-10 text-sm"
              rows={1}
              style={{ minHeight: '36px', maxHeight: '100px' }}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--lagoon-deep)] transition hover:text-[var(--sea-ink)] disabled:text-[var(--sea-ink-soft)]"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      <HowItWorks title="How this works: client + server persistence">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            <strong>Client mode A:</strong> this panel passes{' '}
            <code>persistence: localStoragePersistence()</code> and a stable{' '}
            <code>threadId</code> to <code>useChat</code> — the browser caches the
            transcript and repaints it on mount. See{' '}
            <code>src/lib/memory-ai-hook.ts</code>.
          </li>
          <li>
            <strong>Server mode B:</strong> the chat endpoint now runs{' '}
            <code>withPersistence(memoryPersistence())</code>, storing transcripts,
            run records, AND pending approvals. Swap the in-memory backend for a
            Postgres adapter for production durability.
          </li>
          <li>
            Setting <code>persistence: true</code> (instead of an adapter) makes
            the client hold nothing: it hydrates by <code>threadId</code> from the
            endpoint's new GET handler, which returns{' '}
            <code>reconstructChat()</code> — transcript + active run + pending
            interrupts. That's multi-device history.
          </li>
          <li>
            Try it with approvals: start a booking in the Approval tab, reload,
            and the approval UI comes back.
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
