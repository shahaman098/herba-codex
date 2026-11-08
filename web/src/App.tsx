import { useEffect, useState } from 'react'
import GraphExplorer from './components/GraphExplorer'
import AuditDesk from './components/AuditDesk'
import TraceViewer from './components/TraceViewer'
import { cx } from './components/ui'

type TabId = 'graph' | 'audit' | 'trace'

const TABS: Array<{ id: TabId; label: string; sub: string }> = [
  { id: 'graph', label: 'Graph Explorer', sub: 'claims \u2192 taxa \u2192 evidence' },
  { id: 'audit', label: "Historian's Audit Desk", sub: 'per-entry provenance' },
  { id: 'trace', label: 'Agent Trace Viewer', sub: 'pipeline run events' },
]

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#f7f3e9" stroke="#a67c2e" strokeOpacity="0.5" />
      <path d="M16 27c0-9 1.5-14 10-19-1 8-2 17-10 19z" fill="#2f5233" />
      <path d="M16 27C13 20 9 16 5 14c5-1 9 3 11 13z" fill="#a67c2e" />
      <path d="M16 27v-9" stroke="#26211a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  const [tab, setTab] = useState<TabId>('graph')

  /* Keyboard shortcuts: 1/2/3 switch views (ignored while typing in inputs) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const idx = ['1', '2', '3'].indexOf(e.key)
      if (idx >= 0) setTab(TABS[idx].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="parchment-bg flex h-full min-h-0 flex-col">
      {/* REQUIRED persistent disclaimer banner */}
      <div
        role="alert"
        className="border-b border-gold/40 bg-forest-deep px-4 py-1.5 text-center text-[12.5px] font-medium tracking-wide text-gold-pale"
      >
        <span aria-hidden className="mr-1.5">
          &#9940;
        </span>
        Research prototype &mdash; computational evidence mapping, not medical advice.
      </div>

      {/* header + tabs */}
      <header className="border-b border-ink/10 bg-parchment-2/70 px-4 pt-3 lg:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-bold leading-none tracking-tight text-ink">
              Herba Codex
            </h1>
            <p className="mt-1 truncate text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              EthnoHack 2026 &middot; historical herbal texts &rarr; modern pharmacological evidence
            </p>
          </div>
          <div className="ml-auto hidden text-right md:block">
            <p className="font-display text-[13.5px] italic text-ink-soft">Culpeper 1653 &rarr; Kew POWO &rarr; EMA</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">agentic evidence mapping</p>
          </div>
        </div>
        <nav className="mx-auto mt-3 flex max-w-[1400px] gap-1 overflow-x-auto" aria-label="Views">
          {TABS.map((t, i) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'rounded-t-lg border border-b-0 px-4 pb-2.5 pt-2 text-left transition-colors',
                  active
                    ? 'border-ink/15 bg-parchment text-ink shadow-[inset_0_3px_0_#c9a227]'
                    : 'border-transparent text-ink-soft hover:bg-parchment-2/80 hover:text-ink',
                )}
              >
                <span className="block whitespace-nowrap font-display text-[16px] font-semibold leading-tight">
                  {t.label}
                  <span className="ml-1.5 align-middle font-mono text-[10px] font-normal text-ink-faint" aria-hidden>
                    {i + 1}
                  </span>
                </span>
                <span className="block whitespace-nowrap text-[10px] uppercase tracking-wide text-ink-faint">
                  {t.sub}
                </span>
              </button>
            )
          })}
        </nav>
      </header>

      {/* active view */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'graph' && <GraphExplorer />}
        {tab === 'audit' && <AuditDesk />}
        {tab === 'trace' && <TraceViewer />}
      </main>

      <footer className="border-t border-ink/10 bg-parchment-2/70 px-4 py-1.5 text-center text-[10.5px] tracking-wide text-ink-faint lg:px-6">
        Herba Codex &middot; research prototype built for EthnoHack 2026 &middot; press 1 / 2 / 3 to switch views
        &middot; sample data shown when pipeline output is absent at <code className="font-mono">/data/</code>
      </footer>
    </div>
  )
}
