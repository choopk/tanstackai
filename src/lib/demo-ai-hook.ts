import {
  fetchServerSentEvents,
  useChat,
  createChatClientOptions,
} from '@tanstack/ai-react'
import type { InferChatMessages } from '@tanstack/ai-react'
import { clientTools } from '@tanstack/ai-client'

import { showOfferToolDef, scheduleIntroCallDef } from '#/lib/studio-tools'

// Client-side tool implementation: runs in the browser when the model
// emits a showOffer call. We normalize the id and confirm display.
const showOfferToolClient = showOfferToolDef.client(({ id }) => ({
  id: +id,
  displayed: true,
}))

export interface StudioChatRuntimeOptions {
  // Runtime adapter switching: the endpoint falls back to the best
  // configured provider if the requested one has no API key.
  provider?: string
  // Turns on server-side debug logging (request/provider/output/tools...)
  debug?: boolean
}

export function createStudioChatOptions(
  runtime?: StudioChatRuntimeOptions,
) {
  const body: Record<string, unknown> = {}
  if (runtime?.provider) body.provider = runtime.provider
  if (runtime?.debug) body.debug = true

  return createChatClientOptions({
    connection: fetchServerSentEvents('/demo/api/ai/chat'),
    tools: clientTools(
      showOfferToolClient,
      // Bare definition: this tool executes on the server, but registering
      // the definition here types its approval interrupts for the UI.
      scheduleIntroCallDef,
    ),
    ...(Object.keys(body).length > 0 ? { body } : {}),
  })
}

type StudioChatOptions = ReturnType<typeof createStudioChatOptions>

export type ChatMessages = InferChatMessages<StudioChatOptions>

// Static-options variant used by the floating assistant.
const defaultChatOptions = createStudioChatOptions()
export const useStudioChat = () => useChat(defaultChatOptions)
