import { memoryStream, toWebSocketStream } from '@tanstack/ai'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'

import { runStudioTurn } from './studio-chat-pipeline'

export const AI_WS_PATH = '/demo/api/ai/ws'

// Full-duplex chat over a conversation-scoped WebSocket. Pairs with the
// client `webSocket()` connection adapter:
//   - each inbound text frame is a RunAgentInput (a turn) or an
//     { type: 'abort', runId } control frame (handled by toWebSocketStream)
//   - outbound chunks are encoded as bare AG-UI events; when durability is
//     configured they carry an opaque offset ({ id, chunk }) so the client
//     can reconnect at ?offset=... after a drop and RESUME via
//     resumeWebSocketStream instead of losing the run.
const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  // Synthesize the WHATWG Request handshake that toWebSocketStream expects
  // (it copies auth/cookie headers into each synthetic per-turn request).
  const url = new URL(req.url ?? '/', 'http://localhost')
  const handshake = new Request(url, {
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
    ),
  })
  toWebSocketStream(ws as never, handshake, {
    // Per-turn durability keyed off the frame's runId. memoryStream reads
    // ?runId/?offset from the synthetic per-turn request that
    // toWebSocketStream builds.
    durability: (ctx) => memoryStream(ctx.request),
    onRun: (ctx) => {
      // forwardedProps carries the runtime flags the SSE route takes from
      // its request body (provider switching, debug logging, intake demo).
      const props = (ctx.forwardedProps ?? {}) as Record<string, unknown>
      console.log(`[ws] run ${ctx.runId} on thread ${ctx.threadId}`)
      return runStudioTurn({
        messages: ctx.messages,
        threadId: ctx.threadId,
        runId: ctx.runId,
        provider: typeof props.provider === 'string' ? props.provider : null,
        debug: props.debug === true,
        intake: props.intake === true,
      })
    },
  })
})

// Called by the dev-server upgrade hook (see vite.config.ts).
export function handleAiUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== AI_WS_PATH) return false
  wss.handleUpgrade(req, socket as never, head, (client) => {
    wss.emit('connection', client, req)
  })
  return true
}
