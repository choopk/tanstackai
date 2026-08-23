import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import {
  FileText,
  MessagesSquare,
  Database,
  MousePointerClick,
  ImageIcon,
  Mic,
  ArrowRight,
} from 'lucide-react'

import CopyKitPanel from '#/components/studio/CopyKitPanel'
import AgentPanel from '#/components/studio/AgentPanel'
import ImagePanel from '#/components/studio/ImagePanel'
import VoicePanel from '#/components/studio/VoicePanel'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'copy', label: 'Copy Kit' },
  { id: 'chat', label: 'Advisor Chat' },
  { id: 'data', label: 'Data Agent' },
  { id: 'actions', label: 'Action Agent' },
  { id: 'ads', label: 'Ad Studio' },
  { id: 'voice', label: 'Voice Desk' },
] as const

export const Route = createFileRoute('/studio')({
  validateSearch: z.object({
    tab: z
      .enum(['overview', 'copy', 'chat', 'data', 'actions', 'ads', 'voice'])
      .default('overview')
      .catch('overview'),
  }),
  component: StudioPage,
})

const MODULES = [
  {
    tab: 'copy' as const,
    icon: FileText,
    feature: 'Structured Output',
    title: 'Copy Kit Generator',
    description:
      'Zod schema in, validated marketing kit out — landing copy, social posts, email sequence.',
    sell: '$300–800 per client kit',
  },
  {
    tab: 'chat' as const,
    icon: MessagesSquare,
    feature: 'Streaming Chat',
    title: 'AI Solutions Advisor',
    description:
      'Token-by-token streaming consultant with a business persona via system prompts.',
    sell: '$1k+ per support chatbot',
  },
  {
    tab: 'data' as const,
    icon: Database,
    feature: 'Server Tools',
    title: 'Data Agent',
    description:
      'The model calls getServices mid-conversation; your server executes it and grounds the answer.',
    sell: 'Grounding = real product, not a toy',
  },
  {
    tab: 'actions' as const,
    icon: MousePointerClick,
    feature: 'Client Tools',
    title: 'Action Agent',
    description:
      'The LLM triggers showOffer in the browser to render an interactive offer card inside chat.',
    sell: 'Conversational checkout flows',
  },
  {
    tab: 'ads' as const,
    icon: ImageIcon,
    feature: 'Image Generation',
    title: 'Ad Creative Studio',
    description:
      'Product visuals and ad variants from text prompts, sized for every platform.',
    sell: '$50–200/month creative retainers',
  },
  {
    tab: 'voice' as const,
    icon: Mic,
    feature: 'Speech-to-Text + TTS',
    title: 'Voice Notes → Insights',
    description:
      'Record audio, transcribe with Whisper, extract action items, hear them read back.',
    sell: 'Meeting-notes SaaS territory',
  },
] as const

function OverviewTab() {
  return (
    <div>
      <p className="demo-muted mb-2 max-w-2xl">
        Every module below teaches one TanStack AI capability by building it
        into something a business would actually pay for. Learn the framework
        and your first service offering at the same time.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(({ tab, icon: Icon, feature, title, description, sell }) => (
          <Link
            key={tab}
            to="/studio"
            search={{ tab }}
            className="block no-underline"
          >
            <article className="demo-card flex h-full flex-col p-5 transition hover:-translate-y-0.5">
              <div className="mb-3 flex items-center justify-between">
                <Icon className="h-6 w-6 text-[var(--lagoon-deep)]" />
                <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                  {feature}
                </span>
              </div>
              <h3 className="mb-1 font-semibold text-[var(--sea-ink)]">{title}</h3>
              <p className="demo-muted mb-3 flex-1 text-sm">{description}</p>
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                <span className="text-xs font-medium text-[var(--lagoon-deep)]">
                  {sell}
                </span>
                <ArrowRight className="h-4 w-4 text-[var(--sea-ink-soft)]" />
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StudioPage() {
  const { tab } = Route.useSearch()

  return (
    <main className="demo-page demo-page-wide">
      <h1 className="demo-title mb-1">AI Business Studio</h1>
      <p className="demo-muted mb-6 max-w-2xl">
        Interactive lessons on the TanStack AI framework, where each feature is
        built as a monetizable service.
      </p>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-[var(--line)] pb-4">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to="/studio"
            search={{ tab: t.id }}
            className={`rounded-full px-4 py-1.5 text-sm no-underline transition ${
              tab === t.id
                ? 'bg-[var(--lagoon-deep)] font-semibold text-white'
                : 'border border-[var(--line)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="min-h-[480px]">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'copy' && <CopyKitPanel />}
        {(tab === 'chat' || tab === 'data' || tab === 'actions') && (
          <AgentPanel key={tab} focus={tab} />
        )}
        {tab === 'ads' && <ImagePanel />}
        {tab === 'voice' && <VoicePanel />}
      </div>
    </main>
  )
}
