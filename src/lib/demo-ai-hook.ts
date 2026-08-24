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

const chatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/demo/api/ai/chat'),
  tools: clientTools(
    showOfferToolClient,
    // Bare definition: this tool executes on the server, but registering
    // the definition here types its approval interrupts for the UI.
    scheduleIntroCallDef,
  ),
})

export type ChatMessages = InferChatMessages<typeof chatOptions>

export const useStudioChat = () => useChat(chatOptions)
