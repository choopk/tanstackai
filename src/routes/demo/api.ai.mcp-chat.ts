import { createFileRoute } from '@tanstack/react-router'
import { chat, maxIterations, toServerSentEventsResponse } from '@tanstack/ai'
import { createMCPClient } from '@tanstack/ai-mcp'
import { openaiText } from '@tanstack/ai-openai'
import { openRouterText } from '@tanstack/ai-openrouter'

import { studioUsageMiddleware } from '#/lib/studio-usage'

const FREE_MODEL = 'openrouter/free'

// Public DeepWiki MCP server - exposes tools that answer questions about
// GitHub repositories. No API key required.
const DEEPWIKI_MCP_URL = 'https://mcp.deepwiki.com/mcp'

const SYSTEM_PROMPT = `You are a TanStack AI documentation expert. You have access to DeepWiki tools that can look up information about open-source repositories.

When asked about a library or framework:
1. Use the DeepWiki tools to fetch accurate, up-to-date information about the relevant repository (e.g. "TanStack/ai", "TanStack/router")
2. Answer with specific, code-level detail where possible
3. If tool discovery or lookup fails, say so honestly instead of guessing

Keep answers concise and practical.`

function resolveAdapter() {
  if (process.env.OPENROUTER_API_KEY) {
    return openRouterText(FREE_MODEL as any)
  }
  return openaiText('gpt-4o')
}

export const Route = createFileRoute('/demo/api/ai/mcp-chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const messages = body.messages

          // 1. Connect to the external MCP server (streamable HTTP)
          const mcp = await createMCPClient({
            transport: { type: 'http', url: DEEPWIKI_MCP_URL },
          })

          // 2. chat() discovers the server's tools at run start and closes
          //    the client when the run ends (connection: 'close' default).
          const stream = chat({
            adapter: resolveAdapter(),
            modelOptions:
              process.env.OPENROUTER_API_KEY
                ? { maxCompletionTokens: 1024 }
                : undefined,
            messages,
            systemPrompts: [SYSTEM_PROMPT],
            agentLoopStrategy: maxIterations(5),
            mcp: {
              clients: [mcp],
              connection: 'close',
              // Skip a source that fails discovery instead of failing the run
              onDiscoveryError: () => {},
            },
            middleware: [studioUsageMiddleware],
          })

          return toServerSentEventsResponse(stream)
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error:
                error.message ||
                'Failed to reach the MCP server. Check network access.',
            }),
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
