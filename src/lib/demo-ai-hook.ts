import {
  fetchServerSentEvents,
  useChat,
  createChatClientOptions,
} from '@tanstack/ai-react'
import type { InferChatMessages } from '@tanstack/ai-react'
import { clientTools } from '@tanstack/ai-client'

import { showOfferToolDef } from '#/lib/studio-tools'

// Client-side tool implementation: runs in the browser when the model
// emits a showOffer call. We normalize the id and confirm display.
const showOfferToolClient = showOfferToolDef.client(({ id }) => ({
  id: +id,
  displayed: true,
}))

const chatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/demo/api/ai/chat'),
  tools: clientTools(showOfferToolClient),
})

export type ChatMessages = InferChatMessages<typeof chatOptions>

export const useStudioChat = () => useChat(chatOptions)
