import {
  createChatClientOptions,
  fetchServerSentEvents,
  localStoragePersistence,
  useChat,
} from '@tanstack/ai-react'

// A stable threadId is the chat's identity - persistence keys on it.
// Randomizing it per mount would make every reload a "new" chat.
export const MEMORY_THREAD_ID = 'studio-memory-demo'

const memoryChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/demo/api/ai/chat'),
  threadId: MEMORY_THREAD_ID,
  // Mode A (client-authoritative): the full transcript is cached in
  // localStorage under this threadId and repainted after a reload.
  persistence: localStoragePersistence(),
})

export const useMemoryChat = () => useChat(memoryChatOptions)
