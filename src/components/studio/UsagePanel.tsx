import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import HowItWorks from './HowItWorks'

interface ThreadUsage {
  threadId: string
  requests: number
  toolCalls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  provider: string
  model: string
  lastActive: number
}

interface BookedCall {
  topic: string
  slot: string
  bookedAt: number
}

export default function UsagePanel() {
  const [threads, setThreads] = useState<Array<ThreadUsage>>([])
  const [bookedCalls, setBookedCalls] = useState<Array<BookedCall>>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/demo/api/ai/usage')
      const data = await response.json()
      setThreads(data.threads ?? [])
      setBookedCalls(data.bookedCalls ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        Every chat run on this site flows through a usage-tracking{' '}
        <strong>middleware</strong> that meters requests, tool calls, and tokens
        per thread — the exact pattern behind usage-based billing. Chat in any
        other tab, then refresh here.
      </p>

      <button
        onClick={refresh}
        disabled={isLoading}
        className="demo-button demo-button-secondary px-4 py-2 text-sm"
      >
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
        />
        Refresh
      </button>

      {threads.length === 0 ? (
        <p className="demo-muted mt-6 text-sm">
          No usage recorded yet — send a message in any chat tab first.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide demo-muted">
                <th className="px-3 py-2">Thread</th>
                <th className="px-3 py-2">Requests</th>
                <th className="px-3 py-2">Tool calls</th>
                <th className="px-3 py-2">Prompt tok</th>
                <th className="px-3 py-2">Completion tok</th>
                <th className="px-3 py-2">Total tok</th>
                <th className="px-3 py-2">Model</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.threadId} className="border-b border-[var(--line)]">
                  <td className="px-3 py-2 font-mono text-xs">{t.threadId}</td>
                  <td className="px-3 py-2">{t.requests}</td>
                  <td className="px-3 py-2">{t.toolCalls}</td>
                  <td className="px-3 py-2">{t.promptTokens}</td>
                  <td className="px-3 py-2">{t.completionTokens}</td>
                  <td className="px-3 py-2 font-semibold">{t.totalTokens}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {t.provider}/{t.model}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bookedCalls.length > 0 && (
        <div className="demo-card mt-6 p-4">
          <h4 className="mb-2 text-sm font-semibold text-[var(--sea-ink)]">
            Approved bookings (written by the approval-gated tool)
          </h4>
          <ul className="space-y-1">
            {bookedCalls.map((call) => (
              <li key={call.bookedAt} className="text-sm demo-muted">
                <span className="font-medium text-[var(--sea-ink)]">
                  {call.slot}
                </span>{' '}
                — {call.topic}
              </li>
            ))}
          </ul>
        </div>
      )}

      <HowItWorks title="How this works: middleware">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            A <code>ChatMiddleware</code> is a plain object of lifecycle hooks:{' '}
            <code>onStart</code>, <code>onBeforeToolCall</code>,{' '}
            <code>onAfterToolCall</code>, <code>onUsage</code>, <code>onFinish</code>{' '}
            and more.
          </li>
          <li>
            This one keys on <code>ctx.threadId</code> and accumulates{' '}
            <code>usage.promptTokens / completionTokens / totalTokens</code> as the
            run streams.
          </li>
          <li>
            It's attached in the endpoint's{' '}
            <code>chat({'{ middleware: [...studioUsage] }'})</code> array —
            every client (advisor, memory, MCP chats) is metered automatically.
          </li>
          <li>
            Same pattern powers rate limiting, cost caps, analytics, and{' '}
            <code>toolCacheMiddleware()</code>. File:{' '}
            <code>src/lib/studio-usage.ts</code>,{' '}
            <code>src/routes/demo/api.ai.usage.ts</code>
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
