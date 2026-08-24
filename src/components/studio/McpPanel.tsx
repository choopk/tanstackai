import { useEffect, useRef, useState } from 'react'
import { Send, Globe, Loader2 } from 'lucide-react'
import { Streamdown } from 'streamdown'

import {
  createChatClientOptions,
  fetchServerSentEvents,
  useChat,
} from '@tanstack/ai-react'

import HowItWorks from './HowItWorks'

const mcpChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/demo/api/ai/mcp-chat'),
})

export default function McpPanel() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading } = useChat(mcpChatOptions)
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

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        This chat connects to the public <strong>DeepWiki MCP server</strong> —
        an external tool provider the model discovers at run start. Ask it about
        open-source repositories; it calls external tools to fetch real answers.
      </p>

      <div className="demo-card flex flex-col p-0" style={{ height: '440px' }}>
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto rounded-xl"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm demo-muted">Try asking:</p>
              <div className="flex w-full max-w-md flex-col gap-2">
                {[
                  'How does TanStack Router validate search params?',
                  "What's new in the TanStack/ai repo?",
                  'Explain TanStack Start server functions',
                ].map((s) => (
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
                      {message.parts.map((part, i) => {
                        if (part.type === 'text' && part.content) {
                          return (
                            <Streamdown key={i}>{part.content}</Streamdown>
                          )
                        }
                        if (part.type === 'tool-call') {
                          return (
                            <p
                              key={i}
                              className="demo-muted py-1 text-xs italic"
                            >
                              <Globe className="mr-1 inline h-3 w-3" />
                              calling MCP tool: {part.name}...
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
              placeholder="Ask about any major GitHub repository..."
              className="demo-textarea pr-10 text-sm"
              rows={1}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {isLoading ? (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--lagoon-deep)]" />
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

      <HowItWorks title="How this works: MCP tool discovery">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            The endpoint opens one <code>createMCPClient</code> to{' '}
            <code>mcp.deepwiki.com</code> per run — no hand-written tools.
          </li>
          <li>
            Passing <code>chat({'{ mcp: { clients: [mcp] } }'})</code> makes chat()
            discover every tool the server exposes and merge them into the model's
            toolset for that run.
          </li>
          <li>
            <code>connection: 'close'</code> (default) tears the client down when
            the run ends; use <code>'keep-alive'</code> to reuse warm connections.
          </li>
          <li>
            This is how you'd wire client systems (GitHub, Linear, internal APIs)
            without writing integrations yourself. File:{' '}
            <code>src/routes/demo/api.ai.mcp-chat.ts</code>
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
