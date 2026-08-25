import { createFileRoute } from '@tanstack/react-router'
import {
  chatParamsFromRequestBody,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { reconstructChat } from '@tanstack/ai-persistence'

import { runStudioTurn } from '#/lib/studio-chat-pipeline'
import { persistence } from '#/lib/studio-persistence'

export const Route = createFileRoute('/demo/api/ai/chat')({
  server: {
    handlers: {
      // Hydration endpoint for server-authoritative clients: resolves
      // ?threadId= and returns stored transcript + pending interrupts.
      GET: async ({ request }) => {
        return reconstructChat(persistence, request, {
          // Demo only. In production you MUST authorize by session here -
          // without it anyone who guesses ?threadId= reads the thread.
          authorize: async () => true,
        })
      },
      POST: async ({ request }) => {
        // Capture request signal before reading body (it may be aborted after body is consumed)
        const requestSignal = request.signal

        // If request is already aborted, return early
        if (requestSignal.aborted) {
          return new Response(null, { status: 499 }) // 499 = Client Closed Request
        }

        const abortController = new AbortController()

        try {
          // Raw body first: we read custom fields (provider/debug/intake)
          // that are not part of the AG-UI RunAgentInput contract, then
          // validate the rest through the body-level parser.
          const raw = await request.json()
          // Runtime flags may arrive top-level (SSE fetch adapter) or inside
          // forwardedProps (WebSocket frames) — accept both.
          const props = (raw.forwardedProps ?? {}) as Record<string, unknown>
          const flag = (key: string): unknown => raw[key] ?? props[key]
          // Parses messages + threadId + runId + resume batch
          const params = await chatParamsFromRequestBody(raw)

          const stream = runStudioTurn({
            messages: params.messages,
            threadId: params.threadId,
            runId: params.runId,
            ...(params.resume ? { resume: params.resume } : {}),
            provider:
              typeof flag('provider') === 'string'
                ? (flag('provider') as string)
                : null,
            debug: flag('debug') === true,
            intake: flag('intake') === true,
            abortController,
          })

          return toServerSentEventsResponse(stream, { abortController })
        } catch (error: unknown) {
          console.error('[chat] request failed:', error)
          // If request was aborted, return early (don't send error response)
          if (
            (error as { name?: string }).name === 'AbortError' ||
            abortController.signal.aborted
          ) {
            return new Response(null, { status: 499 }) // 499 = Client Closed Request
          }
          return new Response(
            JSON.stringify({ error: 'Failed to process chat request' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
