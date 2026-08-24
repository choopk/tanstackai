import type { ChatMiddleware } from '@tanstack/ai'

// In-memory usage ledger keyed by AG-UI threadId. Swap the Map for your
// database and you have per-customer metered billing.
export interface ThreadUsage {
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

const threads = new Map<string, ThreadUsage>()

function getThread(threadId: string): ThreadUsage {
  let thread = threads.get(threadId)
  if (!thread) {
    thread = {
      threadId,
      requests: 0,
      toolCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      provider: '',
      model: '',
      lastActive: Date.now(),
    }
    threads.set(threadId, thread)
  }
  return thread
}

export const studioUsageMiddleware: ChatMiddleware = {
  name: 'studio-usage',
  onStart(ctx) {
    const thread = getThread(ctx.threadId)
    thread.requests += 1
    thread.provider = ctx.provider
    thread.model = ctx.model
    thread.lastActive = Date.now()
  },
  onAfterToolCall(ctx) {
    getThread(ctx.threadId).toolCalls += 1
  },
  onUsage(ctx, usage) {
    const thread = getThread(ctx.threadId)
    thread.promptTokens += usage.promptTokens ?? 0
    thread.completionTokens += usage.completionTokens ?? 0
    thread.totalTokens += usage.totalTokens ?? 0
    thread.lastActive = Date.now()
  },
}

export function getUsageSnapshot(): Array<ThreadUsage> {
  return [...threads.values()].sort((a, b) => b.lastActive - a.lastActive)
}
