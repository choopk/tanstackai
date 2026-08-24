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

// APPROVAL-GATED SERVER TOOL: needsApproval pauses execution until the
// user approves it in the UI. The server only runs it after approval.
export const scheduleIntroCallDef = toolDefinition({
  name: 'scheduleIntroCall',
  description:
    'Schedule a free 30-minute discovery call with the studio. Requires explicit user approval before the calendar entry is created.',
  inputSchema: z.object({
    topic: z
      .string()
      .describe('What the discovery call will cover (the automation goal)'),
    preferredTime: z
      .string()
      .describe('The proposed time slot, e.g. "Tuesday 2pm"'),
  }),
  outputSchema: z.object({
    confirmed: z.boolean(),
    slot: z.string(),
  }),
  needsApproval: true,
})

const bookedCalls: Array<{ topic: string; slot: string; bookedAt: number }> = []

export const scheduleIntroCall = scheduleIntroCallDef.server(
  async ({ topic, preferredTime }) => {
    // In production this would write to Google Calendar / Cal.com etc.
    bookedCalls.push({ topic, slot: preferredTime, bookedAt: Date.now() })
    return { confirmed: true, slot: preferredTime }
  },
)

export function getBookedCalls() {
  return [...bookedCalls]
}
