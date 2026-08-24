import { createFileRoute } from '@tanstack/react-router'

import { getUsageSnapshot } from '#/lib/studio-usage'
import { getBookedCalls } from '#/lib/studio-tools'

export const Route = createFileRoute('/demo/api/ai/usage')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            threads: getUsageSnapshot(),
            bookedCalls: getBookedCalls(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    },
  },
})
