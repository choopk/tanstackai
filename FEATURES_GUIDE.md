# TanStack AI — New Feature Guide

Detailed walkthrough of the features added in this batch, all built on
`@tanstack/ai` 0.48.x. Every feature is live in the app at `/studio` and
crossed out in `UNCOVERED_FEATURES.md`.

**Run it:**

```bash
pnpm dev        # http://localhost:3000 → AI Studio
```

---

## Table of contents

1. [Shared chat pipeline](#1-shared-chat-pipeline-the-foundation)
2. [Composable middleware + capability system](#2-composable-middleware--capability-system)
3. [Managed tool registry](#3-managed-tool-registry)
4. [Agent loop strategies](#4-agent-loop-strategies)
5. [WebSocket streaming + stream durability](#5-websocket-streaming--stream-durability)
6. [Generic interrupts (`defineInterrupt`)](#6-generic-interrupts-defineinterrupt)
7. [Durable run cancel (`requestRunCancel`)](#7-durable-run-cancel-requestruncancel)
8. [File map](#8-file-map)
9. [Quick test matrix](#9-quick-test-matrix)

---

## 1. Shared chat pipeline (the foundation)

**File:** `src/lib/studio-chat-pipeline.ts`

Before this batch, the SSE route owned everything inline: the system
prompt, the provider/model table, adapter factories, the tools array and
the loop strategy. The WebSocket endpoint would have needed a full copy.

`runStudioTurn(input)` now owns the entire turn configuration:

```
runStudioTurn({ messages, threadId, runId, resume, provider, debug, intake })
  ├── resolveProvider()   → adapter per vendor (OpenRouter → Anthropic → OpenAI → Gemini → Ollama)
  ├── tools               → studioTools.getTools()        (registry, §3)
  ├── agentLoopStrategy   → combineStrategies([...])      (§4)
  ├── interrupts          → [discoveryIntake]             (§6)
  ├── context             → { intake }                    (runtime flag for middleware)
  └── middleware          → [...studioUsage,              (§2 + §7)
                             intakeMiddleware,            (§6)
                             withPersistence(persistence)]
```

Both transports call this one function:

- **SSE:** `src/routes/demo/api.ai.chat.ts` → `toServerSentEventsResponse(stream)`
- **WS:** `src/lib/studio-ws-server.ts` → returned from `onRun(ctx)` inside `toWebSocketStream`

The SSE route accepts runtime flags (`provider`, `debug`, `intake`) from
**either** the top-level body (fetch adapter) **or** `forwardedProps`
(WS frames) via a small `flag()` helper.

`persistence` lives in `src/lib/studio-persistence.ts` so the SSE route,
the WS handler and the cancel endpoint all share **one** in-process
`memoryPersistence()` instance — one transcript store, one run store, one
usage ledger.

---

## 2. Composable middleware + capability system

**File:** `src/lib/studio-usage.ts`

**Exports used:** `defineChatMiddleware`, `createChatMiddleware`,
`createCapability`

The old usage middleware was a raw `ChatMiddleware` object with a
module-level `Map`. The rewrite demonstrates the full typed stack:

### a) Capabilities — typed shared state

```ts
export const usageLedger = createCapability<UsageLedger>()('studio-usage-ledger')
```

`createCapability` returns a `[get, provide]` tuple. It is the *identity*
of a piece of middleware-provided state. Capability names must be unique
literals — the compiler tracks them.

### b) Provider middleware — publishes state in `setup`

```ts
const ledgerProvider = defineChatMiddleware({
  name: 'studio-ledger-provider',
  provides: [usageLedger],
  setup(ctx) {
    usageLedger[1](ctx, { thread: getThread })   // provide()
  },
})
```

`setup` runs **first**, before `onConfig`, across all middleware.

### c) Consumer middleware — declares what it needs

```ts
const usageMeter = defineChatMiddleware({
  name: 'studio-usage-meter',
  requires: [usageLedger],
  onStart(ctx) {
    const ledger = usageLedger[0](ctx)   // get() — typed!
  },
  onAfterToolCall(ctx) { /* ... */ },
  onUsage(ctx, usage)   { /* ... */ },
  onAbort(ctx, info)    { /* ... */ },   // see §7
})
```

If nothing in the array `provides` a required capability, you get a
**compile-time error at the `middleware` option** (plus a runtime throw
as backstop).

### d) Order-aware builder

```ts
export const studioUsage = createChatMiddleware()
  .use(ledgerProvider)   // provides the capability…
  .use(usageMeter)       // …so this `.use()` type-checks
  .use(cancelWatcher)    // §7
  .build()               // → the middleware[] for chat()
```

`.use()` refuses (at the type level) a consumer whose requirements were
not provided by an *earlier* middleware.

**Where to see it:** the **Usage Metering** panel on `/studio` —
per-thread requests/tool calls/tokens now flow through the capability.
The MCP chat route reuses the same `[...studioUsage]` stack.

---

## 3. Managed tool registry

**File:** `src/lib/studio-tool-registry.ts`

**Exports used:** `createToolRegistry`, `createFrozenRegistry`

```ts
export const studioTools = createToolRegistry([
  getServices,        // server tool (catalog)
  showOfferToolDef,   // client tool (renders OfferCard in the browser)
  scheduleIntroCall,  // approval-gated server tool
  getCaseStudies,     // lazy tool (schema discovered on demand)
])

export const frozenStudioTools = createFrozenRegistry(studioTools.getTools())
```

- The **live registry** is the single source of truth. `chat()` receives
  `studioTools.getTools()` instead of a hand-rolled array, so any route
  can `add()`/`remove()` tools dynamically and every consumer sees the
  same set. Grouped by concern: catalog / actions / lazy.
- The **frozen registry** is an immutable snapshot — `add`/`remove` are
  no-ops. Use it for tests or debug endpoints that must see exactly the
  toolset live at snapshot time.

**Where to see it:** invisible by design — every chat turn (SSE *and* WS)
resolves its tools through the registry.

---

## 4. Agent loop strategies

**File:** `src/lib/studio-chat-pipeline.ts`

**Exports used:** `combineStrategies`, `untilFinishReason`, `maxIterations`

```ts
const agentLoopStrategy = combineStrategies([
  maxIterations(8),
  untilFinishReason(['stop', 'length']),
])
```

Strategies answer one question each iteration: *"continue?"*.

| Strategy | Semantics |
|---|---|
| `maxIterations(8)` | continue only while fewer than 8 **model turns** (not tool calls) |
| `untilFinishReason(['stop','length'])` | stop the moment the model produces a final answer (`stop`) or hits the token cap (`length`) |
| `combineStrategies([...])` | **AND logic** — every strategy must agree to continue |

Net effect: the agent can chain tools (getServices → showOffer → lazy
discovery) for up to 8 turns, but the run ends at the *first complete
user-visible answer* instead of burning spare iterations.

**Where to see it:** any multi-tool answer (e.g. *"Show me proof of past
results, then offer me a package"*). Documented under the **Advisor Chat**
tab's "How this works" section.

---

## 5. WebSocket streaming + stream durability

**Files:** `src/lib/studio-ws-server.ts`, `vite.config.ts`,
`src/lib/demo-ai-hook.ts`

**Exports used:** `toWebSocketStream`, `memoryStream` (server);
`webSocket` (client adapter)

### Why not `toWebSocketResponse`?

That helper requires a runtime with `WebSocketPair` (Cloudflare
Workers/Durable Objects). Vite dev runs on **Node**, which has no native
upgrade path — so we upgrade the socket ourselves with the `ws` package
and call `toWebSocketStream(socket, request, init)` directly.

### Server side

```ts
// vite.config.ts (dev server)
configureServer(server) {
  server.httpServer.on('upgrade', async (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/demo/api/ai/ws') return
    // ssrLoadModule = handler runs in the SAME module graph as the app:
    // shared persistence, usage ledger and tool registry across SSE and WS.
    const mod = await server.ssrLoadModule('/src/lib/studio-ws-server.ts')
    mod.handleAiUpgrade(req, socket, head)
  })
}
```

```ts
// studio-ws-server.ts
wss.on('connection', (ws, req) => {
  toWebSocketStream(ws, handshake, {
    // Per-turn durability: each run's event log keyed by its runId
    durability: (ctx) => memoryStream(ctx.request),
    // One inbound frame = one turn. ctx carries parsed messages /
    // threadId / runId / forwardedProps / abort signal already.
    onRun: (ctx) => runStudioTurn({ /* ... */ }),
  })
})
```

`toWebSocketStream` handles the wire protocol for you:

- inbound `{ type: 'abort', runId }` control frames → aborts that run's signal
- handshakes carrying `?offset=` → routed to `resumeWebSocketStream`
  (replay only, no model call)
- outbound chunks → bare AG-UI events, or **offset-tagged `{ id, chunk }`
  envelopes** when durability is configured

### Durability = resumable runs

Because `memoryStream(ctx.request)` backs each turn, every frame carries
an opaque offset. If the socket drops mid-run, the client `webSocket()`
adapter automatically reconnects at `?runId=…&offset=<lastEventId>` and
the server replays from the log instead of re-generating. Verified in
testing: frames arrive envelope-tagged and `RUN_FINISHED` closes cleanly.

### Client side

```ts
// demo-ai-hook.ts
connection:
  runtime.transport === 'ws'
    ? webSocket('/demo/api/ai/ws')
    : fetchServerSentEvents('/demo/api/ai/chat')
```

`webSocket()` is conversation-scoped and full-duplex: `send()` writes a
`RunAgentInput` frame (your `body` options ride along as
`forwardedProps`); reconnect/resume is built in.

**Where to see it:** the **Transport dropdown** in the chat toolbar
(`/studio`, Advisor Chat tab) — switch to *WebSocket (full-duplex)* and
chat. Same UI, different pipe. Drop your network briefly mid-answer to
watch resume kick in.

---

## 6. Generic interrupts (`defineInterrupt`)

**File:** `src/lib/studio-intake.ts`

**Exports used:** `defineInterrupt`, `createInterruptBinding`

### The concept

Tool approval (`needsApproval: true`) asks *"may this TOOL run?"*.
A **generic interrupt** asks the user for *application data* at a chat
lifecycle boundary — a form mid-run, defined once, typed on both sides
of the wire.

### The definition

```ts
export const discoveryIntake = defineInterrupt({
  id: 'discovery-intake',
  payloadSchema: z.object({ topic: z.string() }),   // server → user
  responseSchema: z.object({
    teamSize: z.enum(['1-5', '6-20', '21-100', '100+']),
    biggestTimeDrain: z.string().min(3),
  }),                                               // user → server
})
```

The same definition is registered on **both** sides:

```ts
chat({ interrupts: [discoveryIntake] })    // server (pipeline)
useChat({ interrupts: [discoveryIntake] }) // client (demo-ai-hook.ts)
```

### Raising it — middleware at a boundary

```ts
export const intakeMiddleware = defineChatMiddleware({
  name: 'discovery-intake',
  onInterruptBoundary(ctx) {
    if (ctx.phase !== 'beforeTools') return       // right before tools run
    if (ctx.iteration > 0) return                 // once per run
    if (ctx.context?.intake !== true) return      // client opt-in flag
    if (intakeDone.has(ctx.threadId)) return      // once per thread, ever

    const request = discoveryIntake.interrupt({
      key: `intake-${ctx.threadId}`,
      reason: 'context-missing',
      message: 'Before I pull packages: how big is your team…',
      payload: { topic: 'AI automation discovery' },
    })

    // Audit trail: binding metadata (definitionId, key, threadId) the
    // engine will stamp onto the descriptor.
    const pre = createInterruptBinding(request, { threadId: ctx.threadId })
    console.log(`[intake] emitted ${pre.descriptor.definitionId}#${pre.descriptor.key}`)

    return { interrupts: [request] }
  },
  onInterruptResolution(ctx, resolutions) {
    const results = resolutions.for(discoveryIntake)
    // r.status === 'resolved' → r.response is TYPED (responseSchema)
    // r.status === 'cancelled'
    if (results.every((r) => r.status === 'cancelled')) {
      return { toolResume: 'stop' }   // all cancelled → don't run tools on resume
    }
  },
})
```

Key mechanics:

- Boundary phases: `beforeModel | afterModel | beforeTools | afterTools`.
- Interrupts from all middleware at one boundary form **one AG-UI
  interrupt batch** with any tool approvals; the run pauses
  (`RUN_FINISHED.outcome = interrupt`) until every bound item is resolved
  or cancelled.
- With persistence wired, the pending interrupt **survives page reloads**
  and the form repaints on mount.

### The UI

AgentPanel renders a **"Generic interrupt" card** (team-size select +
time-drain input). `interrupt.resolveInterrupt({ teamSize,
biggestTimeDrain })` sends the typed response; `interrupt.cancel()`
cancels it.

**Where to see it:** check **"Discovery intake interrupt"** in the chat
toolbar → **Approval-Gated Agent** tab → ask to book a call. The intake
form appears *first* (beforeTools); after answering, the classic tool
approval card for `scheduleIntroCall` follows — two interrupt kinds in
one flow.

---

## 7. Durable run cancel (`requestRunCancel`)

**Files:** `src/routes/demo/api.ai.cancel.ts`,
`src/lib/studio-usage.ts`, `src/components/studio/AgentPanel.tsx`

**Exports used:** `requestRunCancel`, `wasCancelRequested`,
`RUN_CANCEL_REASON`, `AbortInfo.cancelRequested` (via `onAbort`)

### The problem

A user pressing "stop" and a viewer closing the tab are **the same TCP
close** on the wire. The framework refuses to guess intent from an abort
alone — an explicit cancel must be *recorded* durably and *observed* by
the run.

### The control plane — `POST /demo/api/ai/cancel`

```ts
await requestRunCancel(persistence.stores.runs, runId)
```

- Accepts `{ runId }` or `{ threadId }` (resolves the active run via
  `RunStore.findActiveRun`).
- Writes `RunRecord.cancelRequested = true` — **intent only**, never a
  terminal status. The driver owns the actual `'aborted'` transition.
- Returns `{ ok, runId, reason: 'tanstack-ai:cancel-requested',
  cancelRequested, status }`.

### The observer — cancel-watcher middleware

`requestRunCancel` only *records* intent; a plain `chat()` stream has no
external driver polling it, so `studio-usage.ts` adds one:

```ts
const cancelWatcher = defineChatMiddleware({
  name: 'studio-cancel-watcher',
  onIteration(ctx) { checkCancel(ctx) },           // agent-loop boundaries
  onChunk(ctx) {                                    // single-turn runs never
    if (ctx.chunkIndex % 25 === 0) checkCancel(ctx) // cross another boundary
  },
})

function checkCancel(ctx) {
  void wasCancelRequested(persistence.stores.runs!, ctx.runId).then((requested) => {
    if (requested) ctx.abort(RUN_CANCEL_REASON)
  })
}
```

Aborting **with** `RUN_CANCEL_REASON` (a namespaced reason string matched
with `===`, so no provider error can masquerade as a cancel) is what lets
every teardown path see the truth:

```ts
onAbort(ctx, info) {
  // info.cancelRequested === true  → explicit out-of-band cancel
  // info.cancelRequested === false → plain disconnect
  console.log(`[usage] run ${ctx.runId} aborted (reason: ${info.reason},
    cancelRequested: ${info.cancelRequested})`)
  ctx.defer(wasCancelRequested(/* ... */).then(/* cross-host double-check */))
}
```

### The UI

The red ■ stop button in the chat box now does both halves:

```ts
const stopAndCancel = async () => {
  stop()                                  // drop the connection locally
  await fetch('/demo/api/ai/cancel', {    // record durable server-side intent
    method: 'POST',
    body: JSON.stringify({ runId: runIdRef.current }),
  })
}
```

(The current `runId` is captured via `onRunIdChange` in the chat options.)

**Where to see it:** send any message, click ■ mid-stream, then read the
**dev-server console**:

```
[usage] run <id> aborted after 1573ms (reason: tanstack-ai:cancel-requested, cancelRequested: true)
[usage] durable cancel confirmed for run <id>
```

You can also cancel out-of-band (simulating an admin console):

```bash
curl -X POST localhost:3000/demo/api/ai/cancel \
  -H 'Content-Type: application/json' \
  -d '{"threadId": "<thread-id>"}'
```

---

## 8. File map

| File | Purpose |
|---|---|
| `src/lib/studio-chat-pipeline.ts` | Shared turn pipeline: adapters, registry tools, loop strategies, interrupts, middleware — used by SSE **and** WS |
| `src/lib/studio-persistence.ts` | Single shared `memoryPersistence()` instance |
| `src/lib/studio-usage.ts` | Capability-backed usage ledger + meter + cancel watcher (`defineChatMiddleware`, `createChatMiddleware`, `wasCancelRequested`) |
| `src/lib/studio-intake.ts` | `defineInterrupt` generic interrupt + emission middleware + `createInterruptBinding` audit |
| `src/lib/studio-tool-registry.ts` | `createToolRegistry` + `createFrozenRegistry` |
| `src/lib/studio-ws-server.ts` | WebSocket endpoint: `toWebSocketStream` + `memoryStream` durability |
| `src/routes/demo/api.ai.chat.ts` | SSE route (now thin; flags accepted top-level or in `forwardedProps`) |
| `src/routes/demo/api.ai.cancel.ts` | Out-of-band cancel control plane (`requestRunCancel`) |
| `vite.config.ts` | Dev-server WS upgrade hook for `/demo/api/ai/ws` (handler via `ssrLoadModule`) |
| `src/lib/demo-ai-hook.ts` | Client: `webSocket()` transport toggle, interrupt registration, `onRunIdChange` |
| `src/components/studio/AgentPanel.tsx` | Transport select, intake checkbox, generic-interrupt form, durable stop button |

> **Production note:** the WS upgrade hook is dev-server only. Deploying
> needs the equivalent upgrade route on the host runtime (e.g. a Durable
> Object on Cloudflare, where `toWebSocketResponse` works directly).

---

## 9. Quick test matrix

| # | Feature | UI path | Expected result |
|---|---|---|---|
| 1 | WebSocket transport | Advisor Chat tab → Transport: *WebSocket* → send a message | Same chat UX over WS; server logs `[ws] run … on thread …` |
| 2 | Stream durability/resume | WS mode → disconnect network mid-answer → reconnect | Client resumes at last offset; no duplicate/garbled text |
| 3 | Generic interrupt | Check *Discovery intake interrupt* → Approval-Gated tab → "book a call" | "Generic interrupt" card first; typed form; run pauses |
| 4 | Interrupt resolution | Answer the intake form | Run resumes; tools execute; approval card appears next |
| 5 | `toolResume: 'stop'` | Cancel the intake form instead of answering | Run finishes without executing tools |
| 6 | Durable cancel | Any tab → click ■ mid-stream | Console: `cancelRequested: true` + `durable cancel confirmed` |
| 7 | Loop strategies | "Show proof, then offer a package" | Multi-tool chain stops at first complete answer |
| 8 | Registry + middleware | Usage Metering panel after a few chats | Per-thread requests/tools/tokens updated |

