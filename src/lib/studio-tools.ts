import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

import services from '#/data/studio-services'

// SERVER TOOL: the model calls this, the server executes it and feeds
// the result back into the conversation. The client never runs this code.
export const getServicesToolDef = toolDefinition({
  name: 'getServices',
  description: 'Get all service packages available to offer clients',
  inputSchema: z.object({}),
  outputSchema: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      category: z.string(),
      shortDescription: z.string(),
      priceFrom: z.number(),
    }),
  ),
})

export const getServices = getServicesToolDef.server(() =>
  services.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    shortDescription: s.shortDescription,
    priceFrom: s.priceFrom,
  })),
)

// CLIENT TOOL: the model emits the call, it streams down to the browser,
// and the client-side implementation renders UI for it.
export const showOfferToolDef = toolDefinition({
  name: 'showOffer',
  description:
    'REQUIRED tool to present a service package to the user. This tool MUST be used whenever recommending or presenting a service - do NOT write out package details yourself. This displays the offer as an interactive card with a booking button.',
  inputSchema: z.object({
    id: z
      .union([z.string(), z.number()])
      .describe('The ID of the service package (from getServices results)'),
    pitch: z
      .string()
      .describe('One sentence on why this package fits the client'),
  }),
  outputSchema: z.object({
    id: z.number(),
    displayed: z.boolean(),
  }),
})
