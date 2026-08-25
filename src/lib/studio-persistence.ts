import { memoryPersistence } from '@tanstack/ai-persistence'

// Single in-process persistence backend shared by the SSE chat route, the
// WebSocket endpoint and the cancel control plane. Swap for a database-backed
// adapter (see @tanstack/ai-persistence store contracts) in production.
export const persistence = memoryPersistence()
