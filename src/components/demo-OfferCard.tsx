import { useNavigate } from '@tanstack/react-router'

import { showAIAssistant } from './demo-AIAssistant'

import services from '#/data/studio-services'

export default function OfferCard({
  id,
  pitch,
}: {
  id: string
  pitch?: string
}) {
  const navigate = useNavigate()
  const service = services.find((service) => service.id === +id)
  if (!service) {
    return null
  }
  return (
    <div className="demo-card my-4 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lagoon-deep)]">
          {service.category}
        </span>
        <span className="text-xs demo-muted">from ${service.priceFrom}</span>
      </div>
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">
          {service.name}
        </h3>
        {pitch && (
          <p className="mb-2 text-sm italic text-[var(--lagoon-deep)]">
            “{pitch}”
          </p>
        )}
        <p className="demo-muted mb-3 line-clamp-2 text-sm">
          {service.shortDescription}
        </p>
        <ul className="mb-4 space-y-1">
          {service.deliverables.slice(0, 3).map((deliverable) => (
            <li
              key={deliverable}
              className="flex items-start gap-2 text-sm text-[var(--sea-ink-soft)]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--lagoon-deep)]" />
              {deliverable}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between">
          <div className="text-sm demo-muted">
            Delivery: {service.timeline}
          </div>
          <button
            onClick={() => {
              navigate({ to: '/studio', search: { tab: 'chat' } })
              showAIAssistant.setState(() => false)
            }}
            className="demo-button px-4 py-1.5 text-sm"
          >
            Discuss This Offer
          </button>
        </div>
      </div>
    </div>
  )
}
