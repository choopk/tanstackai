import { z } from 'zod'

// Shared between the copykit endpoint and the client so useChat's
// outputSchema generic matches exactly what the server validates.
export const CopyKitSchema = z.object({
  businessName: z.string().describe('The business name'),
  tagline: z.string().describe('A short memorable tagline'),
  heroHeadline: z.string().describe('Landing page hero headline'),
  heroSubheadline: z
    .string()
    .describe('One or two sentences expanding on the headline'),
  socialPosts: z
    .array(
      z.object({
        platform: z.enum(['x', 'linkedin', 'instagram']),
        text: z.string(),
      }),
    )
    .describe('Three social posts, one per platform'),
  emailSubject: z.string().describe('Subject line for a launch/promo email'),
  emailBody: z
    .string()
    .describe('Short promotional email body (2-3 short paragraphs)'),
  ctaSuggestions: z
    .array(z.string())
    .describe('Three call-to-action button texts'),
})

export type CopyKit = z.infer<typeof CopyKitSchema>
