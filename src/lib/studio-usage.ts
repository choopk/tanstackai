import {
  createCapability,
  createChatMiddleware,
  defineChatMiddleware,
  RUN_CANCEL_REASON,
  wasCancelRequested,
} from '@tanstack/ai'

import { persistence } from './studio-persistence'

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

// The shared state two middlewares need is published as a typed CAPABILITY
// instead of reaching into each other's internals. `usageLedger` is a
// [get, provide] tuple; the provider middleware calls it in `setup`, the
// meter middleware reads it in its lifecycle hooks.
export const usageLedger =
  createCapability<UsageLedger>()('studio-usage-ledger')

export interface UsageLedger {
  thread(threadId: string): ThreadUsage
}

// PROVIDER: publishes the ledger capability. Declared with
// defineChatMiddleware so `provides`/`requires` are checked at compile time.
const ledgerProvider = defineChatMiddleware({
  name: 'studio-ledger-provider',
  provides: [usageLedger],
  setup(ctx) {
    usageLedger[1](ctx, { thread: getThread })
  },
})

// METER: consumes the capability and records per-thread usage.
const usageMeter = defineChatMiddleware({
  name: 'studio-usage-meter',
  requires: [usageLedger],
  onStart(ctx) {
    const ledger = usageLedger[0](ctx)
    const thread = ledger.thread(ctx.threadId)
    thread.requests += 1
    thread.provider = ctx.provider
    thread.model = ctx.model
    thread.lastActive = Date.now()
  },
  onAfterToolCall(ctx) {
    usageLedger[0](ctx).thread(ctx.threadId).toolCalls += 1
  },
  onUsage(ctx, usage) {
    const ledger = usageLedger[0](ctx)
    const thread = ledger.thread(ctx.threadId)
    thread.promptTokens += usage.promptTokens ?? 0
    thread.completionTokens += usage.completionTokens ?? 0
    thread.totalTokens += usage.totalTokens ?? 0
    thread.lastActive = Date.now()
  },
  // #6 run-cancel observability: AbortInfo.cancelRequested is true only for
  // an explicit out-of-band cancel (requestRunCancel), never a plain
  // disconnect. wasCancelRequested re-reads the durable record — the check
  // that catches a cancel recorded from ANOTHER host/process.
  onAbort(ctx, info) {
    console.log(
      `[usage] run ${ctx.runId} aborted after ${info.duration}ms ` +
        `(reason: ${info.reason ?? 'none'}, cancelRequested: ${info.cancelRequested})`,
    )
    ctx.defer(
      wasCancelRequested(persistence.stores.runs!, ctx.runId).then(
        (requested) => {
          if (requested) {
            console.log(`[usage] durable cancel confirmed for run ${ctx.runId}`)
          }
        },
      ),
    )
  },
})

// CANCEL WATCHER: requestRunCancel only RECORDS intent on the run record —
// the driver owns stopping. Plain chat() streams have no external driver
// polling them, so we check the durable flag at each agent-loop boundary and
// abort with RUN_CANCEL_REASON when an out-of-band cancel lands. Every
// teardown path then sees cancelRequested = true.
const cancelWatcher = defineChatMiddleware({
  name: 'studio-cancel-watcher',
  onIteration(ctx) {
    checkCancel(ctx)
  },
  // Single-iteration runs never cross another loop boundary, so also sample
  // the durable flag every 25 streamed chunks.
  onChunk(ctx) {
    if (ctx.chunkIndex % 25 === 0) checkCancel(ctx)
  },
})

function checkCancel(ctx: { runId: string; abort: (reason?: string) => void }) {
  void wasCancelRequested(persistence.stores.runs!, ctx.runId).then(
    (requested) => {
      if (requested) ctx.abort(RUN_CANCEL_REASON)
    },
  )
}

// Order-aware builder: `.use()` enforces at COMPILE TIME that every required
// capability is provided by an earlier middleware. Returns the array passed
// to chat({ middleware }).
export const studioUsage = createChatMiddleware()
  .use(ledgerProvider)
  .use(usageMeter)
  .use(cancelWatcher)
  .build()

export function getUsageSnapshot(): Array<ThreadUsage> {
  return [...threads.values()].sort((a, b) => b.lastActive - a.lastActive)
}
