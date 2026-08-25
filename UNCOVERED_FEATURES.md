# TanStack AI — Uncovered Features

Features exported from `@tanstack/ai` 0.48.0 that are **not yet demonstrated** in the AI Business Studio.

---

## 1. Generation APIs (not just `chat()`)

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **Audio generation** | `generateAudio()` | Non-speech audio — jingles, sound effects, ambient | Needs OpenAI audio model |
| **Video generation** | `generateVideo()` + `getVideoJobStatus()` | Text/image → video clips | Needs Sora or similar adapter |
| **Summarization** | `summarize()` | Dedicated summarization pipeline (not just asking the LLM to summarize) | Needs adapter with summarize capability |
| **Reranking** | `rerank()` | Re-order retrieved results by relevance | Needs Cohere reranker or similar |
| **Embeddings** | `embed()` | Vectorize text for semantic search, RAG, clustering | Needs OpenAI embedding or local model |

---

## 2. Streaming & Real-time

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **~~WebSocket streaming~~** | `toWebSocketStream` / `toWebSocketResponse` | ✅ COVERED — full-duplex chat at `/demo/api/ai/ws` (`studio-ws-server.ts` + vite upgrade hook); Node has no `WebSocketPair`, so we upgrade via `ws` + `ssrLoadModule`. SSE/WS toggle in AgentPanel | Done |
| **Real-time mode** | `RealtimeAdapter` | Live voice/video conversation (VAD, streaming audio in/out) | Needs OpenAI Realtime API ($$$) |
| **Real-time events** | `RealtimeEvent`, `RealtimeMessage`, etc. | Event types for real-time sessions | Tied to RealtimeAdapter |
| **~~Stream durability~~** | `memoryStream`, `StreamDurability` | ✅ COVERED — WS runs persist per-turn via `memoryStream(ctx.request)`; offset-tagged frames enable client resume at `?offset=` | Done |

---

## 3. Interrupts & Approval (explicit API)

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **~~`defineInterrupt`~~** | Explicit interrupt definition helper | ✅ COVERED — `discoveryIntake` generic interrupt raised by middleware at the `beforeTools` boundary (`studio-intake.ts`); typed form UI in AgentPanel; shared definition registered on `chat({ interrupts })` + `useChat({ interrupts })` | Done |
| **~~`createInterruptBinding`~~** | Interrupt binding creation | ✅ COVERED — pre-emission binding metadata logged as an audit trail when the intake interrupt is emitted | Done |
| **`readInterruptBinding`** | Read binding metadata | Engine calls this internally when validating resume batches; app-level demo pending | For audit/logging of approval decisions |
| **Generic interrupt continuation** | `GenericInterruptContinuation` | Resume chat after arbitrary (non-approval) interrupts | For long-running human workflows |

---

## 4. Tool Management

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **~~`createToolRegistry`~~** | Managed tool set | ✅ COVERED — `studioTools` registry is the single source of truth for the advisor agent's tools (`studio-tool-registry.ts`); passed to both SSE and WS pipelines via `.getTools()` | Done |
| **~~`createFrozenRegistry`~~** | Immutable tool set | ✅ COVERED — `frozenStudioTools` snapshot exported alongside the live registry (add/remove are no-ops) | Done |
| **`ToolCallManager`** | Tool call state machine | Track in-flight tool calls, retry, timeout | Advanced agent reliability |
| **`convertSchemaToJsonSchema`** | Schema conversion | Convert Zod/Valibot/ArkType → JSON Schema | Internal utility, rarely needed directly |
| **`validateWithStandardSchema`** | Schema validation | Validate data against any Standard Schema | Utility for custom middleware |

---

## 5. Middleware (composable)

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **~~`defineChatMiddleware`~~** | Composable middleware builder | ✅ COVERED — usage ledger provider + meter + cancel watcher all authored with `defineChatMiddleware`, typed `requires`/`provides` (`studio-usage.ts`) | Done |
| **~~`createChatMiddleware`~~** | Middleware factory | ✅ COVERED — order-aware builder composes the stack: `createChatMiddleware().use(ledgerProvider).use(usageMeter).use(cancelWatcher).build()`; missing capabilities fail at compile time | Done |
| **~~Capability system~~** | `createCapability`, `CapabilityProvider` | ✅ COVERED — `usageLedger` capability published in `setup`, consumed by the meter middleware | Done |
| **Sandbox hooks** | `SandboxFileEvent`, `ChatSandboxHooks` | File change events in sandboxed code execution | Needs sandbox runtime (Vercel/Cloudflare) |
| **Interrupt boundary** | `InterruptBoundaryPhase` | Middleware hooks around interrupt lifecycle | ✅ COVERED — intake middleware uses `onInterruptBoundary` (`beforeTools`) + `onInterruptResolution` with `toolResume: 'stop'` on cancel-all |
| **~~Run cancel~~** | `requestRunCancel`, `wasCancelRequested` | ✅ COVERED — POST `/demo/api/ai/cancel` records durable intent; cancel-watcher middleware polls the flag per iteration/chunk and aborts with `RUN_CANCEL_REASON`; stop button wires it end-to-end; `onAbort` logs `AbortInfo.cancelRequested` | Done |

---

## 6. Run Lifecycle

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **`defineRunStore`** | Run record store | Track run status, errors, history | For admin dashboards |
| **`InMemoryRunStore`** | Default run store | In-memory implementation of RunStore | Server-side only (used indirectly via `memoryPersistence().stores.runs` by the cancel flow) |
| **`DetachableRunCapability`** | Detachable runs | Detach a run to continue in background | Long-running agent tasks |
| **`RunDetachedCapability`** | Detached run state | Check/track detached run status | Follow-up to detach |
| **~~Agent loop strategies~~** | `untilFinishReason`, `combineStrategies` | ✅ COVERED — `combineStrategies([maxIterations(8), untilFinishReason(['stop', 'length'])])` in the shared pipeline (`studio-chat-pipeline.ts`): keep iterating for tools, stop at the first complete answer | Done |

---

## 7. Client-side (useChat extensions)

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **Thread management** | `threadId` explicit control | Create/switch/archive threads | Beyond current persistence demo |
| **Session management** | `sessionId` | Multi-session within one thread | For user/auth scoping |
| **Abort control** | `abort()` with reason | Graceful cancellation with reason codes | Current `stop()` is basic |
| **`useChatStreamOptions`** | Stream configuration | Fine-grained stream behavior (buffering, flush) | Advanced streaming control |
| **`useChatQueue`** | Queue management API | Explicit queue control beyond basic `cancelQueued` | Better queue UX |

---

## 8. Custom Events & Integrations

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **`WellKnownCustomEventName`** | Event catalog | FileChanged, ProcessOutput, PortOpened, ApprovalRequested, ArtifactCreated | Sandbox/code execution context |
| **`FileChangedPayload`** | File change event | Emitted when a tool modifies a file | Code agent use case |
| **`ArtifactCreatedPayload`** | Artifact creation | Emitted when a tool generates a file/artifact | For download UI |
| **`ProcessOutputPayload`** | Process output | Stdout/stderr from tool processes | Dev tooling |
| **`PortOpenedPayload`** | Port event | Port opened by a tool (dev server, etc.) | Dev tooling |

---

## 9. Adapter Internals

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **`extendAdapter`** | Adapter extension | Extend an existing adapter with custom behavior | For custom provider quirks |
| **`ExtendedModelDef`** | Model capability metadata | Query what a model supports (vision, tools, streaming) | Feature detection |
| **`ModelCapabilities`** | Capability flags | Structured capability info per model | For UI hints |

---

## 10. System Prompts

| Feature | Export | Notes | Feasibility |
|---------|--------|-------|-------------|
| **`SystemPrompt`** type | Typed system prompt | Structured system prompt (not just a string) | Cleaner prompt engineering |
| **`NormalizedSystemPrompt`** | Normalized prompt | Provider-agnostic prompt format | For multi-adapter setups |

---

## Prioritization

**High impact, feasible now (no extra API keys):**
1. ~~`defineInterrupt` / `createInterruptBinding` — cleaner approval flows~~ ✅ (generic intake interrupt + audit trail)
2. ~~`defineChatMiddleware` — composable middleware~~ ✅ (+ `createChatMiddleware` builder, capability system)
3. ~~`createToolRegistry` — multi-tool management~~ ✅ (+ `createFrozenRegistry`)
4. ~~`untilFinishReason` / `combineStrategies` — agent loop control~~ ✅
5. ~~`streamToWebSocket` — real-time streaming demo~~ ✅ (actual exports: `toWebSocketStream`/`toWebSocketResponse`, SSE/WS toggle in AgentPanel)
6. ~~`requestRunCancel` — graceful cancellation with reasons~~ ✅ (+ `wasCancelRequested`, cancel-watcher middleware)

**High impact, needs additional APIs:**
7. `embed()` — semantic search / RAG
8. `rerank()` — result reranking
9. `summarize()` — dedicated summarization
10. `generateAudio()` — audio jingles/SFX
11. `generateVideo()` — video generation

**Low priority / advanced:**
12. Real-time mode (OpenAI Realtime API)
13. Sandbox hooks / custom events
14. Run store / detached runs
15. Adapter internals / model capabilities

---

## Coverage notes (updated 2026-08-25)

New files in this batch:
- `src/lib/studio-persistence.ts` — shared `memoryPersistence()` instance
- `src/lib/studio-usage.ts` — rewritten: capability-backed ledger + meter + cancel watcher via `defineChatMiddleware`/`createChatMiddleware`
- `src/lib/studio-intake.ts` — `defineInterrupt` generic interrupt middleware (+ `createInterruptBinding` audit)
- `src/lib/studio-tool-registry.ts` — `createToolRegistry` + `createFrozenRegistry`
- `src/lib/studio-chat-pipeline.ts` — shared turn pipeline (adapters, registry tools, loop strategies, interrupts, middleware) used by both transports
- `src/lib/studio-ws-server.ts` — WebSocket endpoint handler (`toWebSocketStream` + `memoryStream` durability)
- `src/routes/demo/api.ai.cancel.ts` — out-of-band cancel control plane (`requestRunCancel`)
- `vite.config.ts` — dev-server WS upgrade hook for `/demo/api/ai/ws` (Node has no `WebSocketPair`; handler loaded via `ssrLoadModule` so it shares the app's module graph). Production deploys need the equivalent upgrade route on the host runtime.
- Client: `webSocket()` transport toggle, generic interrupt form, durable stop button in AgentPanel; interrupts registered in `demo-ai-hook.ts`.
