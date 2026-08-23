import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function HowItWorks({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="demo-card mt-6 p-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--sea-ink)]">
        {title}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4 text-sm text-[var(--sea-ink-soft)] [&_code]:rounded [&_code]:bg-[var(--chip-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs">
        {children}
      </div>
    </details>
  )
}
