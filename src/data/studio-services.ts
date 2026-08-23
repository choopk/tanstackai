export interface ServicePackage {
  id: number
  name: string
  category: string
  shortDescription: string
  description: string
  priceFrom: number
  timeline: string
  deliverables: Array<string>
}

const services: Array<ServicePackage> = [
  {
    id: 1,
    name: 'Customer Support Chatbot',
    category: 'Automation',
    shortDescription: '24/7 AI agent that answers customer questions from your own docs.',
    description:
      'A trained AI support agent embedded on your website that answers FAQs, qualifies leads, and escalates complex tickets to humans. Learns from your docs, pricing pages, and past tickets.',
    priceFrom: 1500,
    timeline: '2-3 weeks',
    deliverables: [
      'Website-embedded chat widget',
      'Knowledge base ingestion',
      'Human handoff flow',
      'Conversation analytics dashboard',
    ],
  },
  {
    id: 2,
    name: 'Content & Copy Engine',
    category: 'Marketing',
    shortDescription: 'On-brand blog posts, social captions, and email sequences on demand.',
    description:
      'A structured-output content pipeline tuned to your brand voice. Generates landing page copy, weekly social calendars, and email sequences that you review and ship in minutes instead of days.',
    priceFrom: 800,
    timeline: '1 week',
    deliverables: [
      'Brand voice profile',
      'Landing copy generator',
      'Social post calendar template',
      'Email sequence pack (5 emails)',
    ],
  },
  {
    id: 3,
    name: 'Document Intelligence',
    category: 'Operations',
    shortDescription: 'Extract structured data from invoices, contracts, and forms automatically.',
    description:
      'Turns unstructured documents into validated JSON your systems can use. Handles invoices, purchase orders, intake forms, and contracts with schema validation and exception queues for low-confidence fields.',
    priceFrom: 2000,
    timeline: '3-4 weeks',
    deliverables: [
      'Custom extraction schemas',
      'Upload portal or email intake',
      'Exception review queue',
      'Export to CSV/ERP/webhooks',
    ],
  },
  {
    id: 4,
    name: 'AI Voice Receptionist',
    category: 'Voice',
    shortDescription: 'Answers calls, books appointments, and takes messages around the clock.',
    description:
      'A phone-based voice agent that greets callers, answers common questions via speech recognition, books appointments into your calendar, and sends you transcripts and summaries of every call.',
    priceFrom: 1200,
    timeline: '2 weeks',
    deliverables: [
      'Phone number provisioning',
      'Call script & FAQ training',
      'Calendar booking integration',
      'Call transcript summaries',
    ],
  },
  {
    id: 5,
    name: 'Workflow Automation Agent',
    category: 'Automation',
    shortDescription: 'Tool-calling agent that executes multi-step business workflows.',
    description:
      'An agentic workflow that connects your existing tools (CRM, spreadsheets, email) and executes multi-step processes like lead routing, report generation, and follow-up sequences with human approval gates.',
    priceFrom: 2500,
    timeline: '3-5 weeks',
    deliverables: [
      'Workflow discovery workshop',
      'Custom tool integrations (up to 5)',
      'Approval & audit trail',
      'Run monitoring dashboard',
    ],
  },
  {
    id: 6,
    name: 'Ad Creative Studio',
    category: 'Marketing',
    shortDescription: 'Product visuals and ad variations generated at scale.',
    description:
      'A pipeline that generates product photography styles, ad creative variants, and seasonal campaign visuals from simple prompts, sized and formatted for every platform you advertise on.',
    priceFrom: 600,
    timeline: '1 week',
    deliverables: [
      'Brand style presets',
      '50 ad creative variants/month',
      'Platform-size export pack',
      'Monthly refresh batch',
    ],
  },
]

export default services
