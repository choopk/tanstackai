import {
  createInterruptBinding,
  defineChatMiddleware,
  defineInterrupt,
} from '@tanstack/ai'
import { z } from 'zod'

// A GENERIC interrupt: typed, application-data question raised at a chat
// lifecycle boundary — distinct from tool approval (needsApproval), which
// asks whether a TOOL may run. defineInterrupt gives the payload/response
// schemas; the same definition is registered on BOTH chat({ interrupts })
// and useChat({ interrupts }) so client and server share one contract.
export const discoveryIntake = defineInterrupt({
  id: 'discovery-intake',
  payloadSchema: z.object({
    topic: z.string(),
  }),
  responseSchema: z.object({
    teamSize: z.enum(['1-5', '6-20', '21-100', '100+']),
    biggestTimeDrain: z.string().min(3),
  }),
})

// Threads that already answered (or cancelled) the intake. In production
// this lives in your database next to the thread record.
const intakeDone = new Set<string>()

// The middleware that raises the interrupt at the beforeTools boundary.
// Emitted interrupts join one AG-UI interrupt batch with any tool approvals;
// the run pauses until the client resolves or cancels every bound item.
export const intakeMiddleware = defineChatMiddleware<
  unknown,
  readonly [],
  readonly [],
  typeof discoveryIntake
>({
  name: 'discovery-intake',
  onInterruptBoundary(ctx) {
    // Only once per run, before tools execute, and only when the client
    // opted in via forwardedProps (`intake: true`).
    if (ctx.phase !== 'beforeTools') return
    if (ctx.iteration > 0) return
    if ((ctx.context as { intake?: boolean } | undefined)?.intake !== true) {
      return
    }
    if (intakeDone.has(ctx.threadId)) return

    const request = discoveryIntake.interrupt({
      key: `intake-${ctx.threadId}`,
      reason: 'context-missing',
      message:
        'Before I pull packages: how big is your team and what eats your time?',
      payload: { topic: 'AI automation discovery' },
    })

    // createInterruptBinding builds the pre-emission binding metadata the
    // engine stamps onto the descriptor (definitionId + key + correlation
    // fields). Log it as an audit trail of what we asked and when.
    const preEmission = createInterruptBinding(request, {
      threadId: ctx.threadId,
    })
    console.log(
      `[intake] emitted ${preEmission.descriptor.definitionId}#${preEmission.descriptor.key} ` +
        `for thread ${ctx.threadId} (reason: ${request.reason})`,
    )

    return { interrupts: [request] }
  },
  onInterruptResolution(ctx, resolutions) {
    const results = resolutions.for(discoveryIntake)
    if (results.length === 0) return

    for (const result of results) {
      intakeDone.add(ctx.threadId)
      if (result.status === 'resolved') {
        console.log(
          `[intake] answered for thread ${ctx.threadId}:`,
          JSON.stringify(result.response),
        )
      } else {
        console.log(`[intake] cancelled by user for thread ${ctx.threadId}`)
      }
    }

    // Every answer cancelled → don't bother running tools on resume.
    if (results.every((r) => r.status === 'cancelled')) {
      return { toolResume: 'stop' }
    }
  },
})
