import { createFileRoute } from '@tanstack/react-router'
import { RUN_CANCEL_REASON, requestRunCancel } from '@tanstack/ai'

import { persistence } from '#/lib/studio-persistence'

// OUT-OF-BAND CANCEL CONTROL PLANE.
//
// A client disconnect and a user pressing "stop" look identical on the wire,
// so the framework never infers intent from the abort alone. This endpoint
// records an EXPLICIT cancel on the run record (RunRecord.cancelRequested)
// via requestRunCancel — the durable channel that middleware reads back with
// wasCancelRequested / AbortInfo.cancelRequested.
//
// Accepts { runId } for a precise cancel, or { threadId } to cancel the
// thread's currently-active run (found via RunStore.findActiveRun).
export const Route = createFileRoute('/demo/api/ai/cancel')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            runId?: string
            threadId?: string
          }

          let runId = body.runId
          const runs = persistence.stores.runs
          if (!runId && body.threadId && runs) {
            const record = await runs
              .findActiveRun?.(body.threadId)
              .catch(() => undefined)
            runId = record?.runId
          }

          if (!runId) {
            return Response.json(
              { ok: false, error: 'runId or threadId required' },
              { status: 400 },
            )
          }

          // Marks intent only — never a terminal status. The driver owns the
          // actual 'aborted' transition when the agent loop stops.
          if (!runs) {
            return Response.json(
              { ok: false, error: 'no run store configured' },
              { status: 500 },
            )
          }
          await requestRunCancel(runs, runId)

          const record = await runs.get(runId).catch(() => null)
          return Response.json({
            ok: true,
            runId,
            reason: RUN_CANCEL_REASON,
            cancelRequested: Boolean(record?.cancelRequested),
            status: record?.status ?? 'unknown',
          })
        } catch (error) {
          console.error('[cancel] failed:', error)
          return Response.json({ ok: false }, { status: 500 })
        }
      },
    },
  },
})
