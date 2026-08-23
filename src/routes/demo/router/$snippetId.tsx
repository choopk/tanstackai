import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

const snippetSearchSchema = z.object({
  q: z.string().default('').catch(''),
  page: z.number().default(1).catch(1),
  lang: z.enum(['ts', 'tsx', 'js']).default('tsx').catch('tsx'),
})

export const Route = createFileRoute('/demo/router/$snippetId')({
  validateSearch: snippetSearchSchema,
  component: RouterDemo,
})

function RouterDemo() {
  const { snippetId } = Route.useParams()
  const { q, page, lang } = Route.useSearch()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10">
        <p className="island-kicker mb-3">TanStack Router Demo</p>
        <h1 className="display-title mb-5 max-w-3xl text-3xl leading-tight font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Typed path &amp; search params
        </h1>
        <ul className="mb-8 list-disc space-y-2 pl-5 text-sm text-[var(--sea-ink-soft)]">
          <li>
            Path param <code>snippetId</code> (validated as string):{' '}
            <strong>{snippetId}</strong>
          </li>
          <li>
            Search param <code>q</code>: <strong>{q || '(empty)'}</strong>
          </li>
          <li>
            Search param <code>page</code> (number):{' '}
            <strong>{page}</strong>
          </li>
          <li>
            Search param <code>lang</code> (enum): <strong>{lang}</strong>
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          {[1, 2, 3].map((p) => (
            <Link
              key={p}
              to="/demo/router/$snippetId"
              params={{ snippetId }}
              search={{ q, page: p, lang }}
              activeProps={{ 'data-active': true } as never}
              className="nav-link rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2 no-underline"
            >
              Page {p}
            </Link>
          ))}
          {(['ts', 'tsx', 'js'] as const).map((l) => (
            <Link
              key={l}
              to="/demo/router/$snippetId"
              params={{ snippetId }}
              search={{ q, page, lang: l }}
              className="nav-link rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-4 py-2 no-underline"
            >
              {l}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/demo/router/$snippetId"
            params={{ snippetId: 'hello-world' }}
            search={{ q: 'router', page: 1, lang: 'tsx' }}
            className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.24)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5"
          >
            Jump to snippet "hello-world"
          </Link>
          <Link
            to="/demo/ai-chat"
            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline"
          >
            Back to AI chat demo
          </Link>
        </div>
      </section>
    </main>
  )
}
