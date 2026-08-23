<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Project Context

## Scaffold provenance

- Created with the exact TanStack CLI command (run in scratch dir, then merged to repo root):
  `npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager pnpm --tailwind --add-ons ai,shadcn,store`
- Follow-up TanStack Intent commands (run at repo root):
  - `npx @tanstack/intent@latest install` — rewrote AGENTS.md skill-loading block above
  - `npx @tanstack/intent@latest list` — surfaced skills for @tanstack/ai, react-start, router-core, devtools, etc.
  - Skills loaded before editing: `@tanstack/ai#ai-core/adapter-configuration`, `@tanstack/router-core#router-core/search-params`
- Starter: ai-chat base template. Add-ons: ai, shadcn, store. Tailwind v4 (the `--tailwind` flag is deprecated/no-op).
- Toolchain kept at CLI defaults: Vite 8 + `vite dev --port 3000`, tsr route generation, pnpm.

## Stack & integrations (all represented)

| Library | Where demonstrated |
|---|---|
| TanStack Start | Whole app (`src/routes/__root.tsx`, server routes in `src/routes/demo/api.*`) |
| TanStack Router | File-based routes; typed params + validated search demo at `/demo/router/$snippetId` (`src/routes/demo/router/$snippetId.tsx`) |
| TanStack AI | Chat via `chat()` + `toServerSentEventsResponse()` server-side, `useChat` client-side; OpenRouter adapter wired in `src/routes/demo/api.ai.chat.ts`; guitar tool-calling demo (`demo-guitar-tools.ts`) |
| TanStack Store | `src/lib/demo-store.ts` + store devtools panel + `/demo/store` route |
| TanStack Intent | Skill mappings in the block above; run `load <pkg>#<skill>` before library-specific edits |
| TanStack CLI | Scaffold command above; also `pnpm generate-routes` after adding routes |

## Environment variables

- `.env.local` (gitignored via `*.local`): `OPENROUTER_API_KEY` (primary provider), optional `ANTHROPIC_API_KEY`.
- Provider precedence: OPENROUTER (`openrouter/free`) → ANTHROPIC → OPENAI → GEMINI → Ollama fallback. Applies to both `/demo/api/ai/chat` and `/demo/api/ai/structured`.
- Never commit keys. `openrouter.md` is documentation only (key was moved out of it into `.env.local`).

## Key architectural decisions

- Added `@tanstack/ai-openrouter` and made it the preferred provider; capped `modelOptions.maxCompletionTokens: 1024` because the default 16384 exceeds free-tier credit on OpenRouter (caused RUN_ERROR 402).
- Primary model is OpenRouter's Free Models Router (`openrouter/free`, https://openrouter.ai/openrouter/free): $0 inference, 200k context, auto-selects free variants supporting needed features (tool calling, structured outputs). Zero-balance accounts are limited to ~50 requests/day and 20 req/min — expect RUN_ERROR if exceeded.
- Kept the generated project structure untouched except for additions (`src/routes/demo/router/$snippetId.tsx`, Header "Router Params" link) and the provider wiring.
- Zod v4 is installed: use plain `.catch()` in `validateSearch` schemas (no `@tanstack/zod-adapter` / `fallback()` needed).

## Known gotchas

- pnpm 11 ignores the `"pnpm"` field in package.json; build-script approvals live in `pnpm-workspace.yaml` under `allowBuilds`. If a new dep fails with ERR_PNPM_IGNORED_BUILDS, add it there (use `false` unless scripts are truly needed).
- `npx tsc --noEmit` reports pre-existing type errors shipped by the CLI scaffold (server-route handler typings in `api.ai.*`, unused import in `ai-image.tsx`, `demo-store-devtools.tsx` event-name mismatch). `pnpm build` (vite build) passes regardless; don't chase these unless asked.
- Route tree is generated: run `pnpm generate-routes` after adding/removing route files.

## Verification status (as of setup)

- `pnpm build` ✓ · dev server boots on :3000 ✓ · home + router-demo routes return 200 ✓
- POST `/demo/api/ai/chat` streams RUN_STARTED → TEXT_MESSAGE_* → RUN_FINISHED via OpenRouter (`openrouter/free`) ✓

## Next steps / deployment notes

- Deploy target per scaffold: Vite build output in `dist/` (Start's default Nitro-style output); see `start-core/deployment` intent skill before configuring Cloudflare/Vercel/etc.
- Consider a paid OpenRouter tier or lower maxCompletionTokens for long chats; add more models via `openRouterText('<provider/model>')`.
- Remaining scaffold type errors could be cleaned up in a follow-up pass.

