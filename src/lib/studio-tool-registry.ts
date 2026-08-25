import { createFrozenRegistry, createToolRegistry } from '@tanstack/ai'

import {
  getCaseStudies,
  getServices,
  scheduleIntroCall,
  showOfferToolDef,
} from './studio-tools'

// MANAGED REGISTRY: one source of truth for the advisor agent's tool set.
// chat() receives registry.getTools() instead of a hand-rolled array, so
// routes/features can add or remove tools dynamically and every consumer
// sees the same set. Group by concern:
//   - catalog: getServices (server) + showOffer (client UI tool)
//   - actions: scheduleIntroCall (approval-gated server tool)
//   - lazy:    getCaseStudies (schema discovered on demand)
export const studioTools = createToolRegistry([
  getServices,
  showOfferToolDef,
  scheduleIntroCall,
  getCaseStudies,
])

// IMMUTABLE SNAPSHOT: freeze the current set for debugging/tests. Add/remove
// calls on this registry are no-ops, so a debug endpoint or test always sees
// exactly the tools that were live when the snapshot was taken.
export const frozenStudioTools = createFrozenRegistry(studioTools.getTools())
