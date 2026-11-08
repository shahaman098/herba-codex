import type { ReactNode } from 'react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------ badges/chips ----------------------------- */

export const GRADE_COLORS: Record<string, string> = {
  A: '#2f5233', // green
  B: '#1f7a72', // teal
  C: '#b7791f', // amber
  D: '#8b3a2f', // red
  X: '#6b6a5e', // gray
}

export const NODE_COLORS: Record<string, string> = {
  Entry: '#3e6b48',
  Taxon: '#1f3b27',
  HistoricalName: '#c9a227',
  Ailment: '#8b3a2f',
  Evidence: '#2b5d8a',
  Authority: '#6b4d8a',
  Preparation: '#1f7a72',
  Source: '#6b6a5e',
}

export const AGENT_COLORS: Record<string, string> = {
  Historian: '#a67c2e',
  Botanist: '#3e6b48',
  Pharmacologist: '#2b5d8a',
  'Evidence Scorer': '#6b4d8a',
  Auditor: '#8b3a2f',
}

export function agentColor(agent?: string): string {
  return (agent && AGENT_COLORS[agent]) || '#6b6a5e'
}

export function GradeBadge({
  grade,
  size = 'sm',
  title,
}: {
  grade?: string | null
  size?: 'sm' | 'lg' | 'xl'
  title?: string
}) {
  const g = (grade ?? '?').toUpperCase()
  const color = GRADE_COLORS[g] ?? '#6b6a5e'
  const cls =
    size === 'xl'
      ? 'h-14 w-14 text-3xl'
      : size === 'lg'
        ? 'h-10 w-10 text-xl'
        : 'h-6 w-6 text-[13px]'
  return (
    <span
      title={title ?? `Concordance grade ${g}`}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-parchment shadow-sm ring-1 ring-black/10',
        cls,
      )}
      style={{ backgroundColor: color }}
    >
      {g}
    </span>
  )
}

const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[11px] font-medium leading-tight'

const CHIP_TONES: Record<string, string> = {
  green: 'border-forest/30 bg-forest-pale text-forest-deep',
  teal: 'border-verdigris/30 bg-verdigris-pale text-verdigris',
  amber: 'border-amber/30 bg-gold-pale text-amber',
  red: 'border-rust/30 bg-rust-pale text-rust',
  blue: 'border-evidblue/30 bg-evidblue-pale text-evidblue',
  purple: 'border-amethyst/30 bg-amethyst-pale text-amethyst',
  gray: 'border-ink/15 bg-stone-pale text-ink-soft',
}

export function Chip({
  tone = 'gray',
  children,
  title,
  className,
}: {
  tone?: keyof typeof CHIP_TONES
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <span title={title} className={cx(CHIP_BASE, CHIP_TONES[tone], className)}>
      {children}
    </span>
  )
}

export const VERDICT_META: Record<string, { tone: keyof typeof CHIP_TONES; icon: string; label: string }> = {
  pass: { tone: 'green', icon: '\u2713', label: 'pass' },
  pass_with_issues: { tone: 'amber', icon: '\u26A0', label: 'pass with issues' },
  fail: { tone: 'red', icon: '\u2717', label: 'fail' },
}

export function VerdictChip({ verdict, size = 'sm' }: { verdict?: string | null; size?: 'sm' | 'lg' }) {
  if (!verdict) {
    return (
      <Chip tone="gray" title="Audit has not run for this entry">
        pending
      </Chip>
    )
  }
  const meta = VERDICT_META[verdict] ?? { tone: 'gray' as const, icon: '\u2022', label: verdict }
  return (
    <Chip tone={meta.tone} title={`Audit verdict: ${meta.label}`}>
      <span aria-hidden>{meta.icon}</span>
      {size === 'lg' ? <span className="font-semibold">{meta.label}</span> : meta.label}
    </Chip>
  )
}

const STATUS_META: Record<string, keyof typeof CHIP_TONES> = {
  resolved: 'green',
  ambiguous: 'amber',
  unresolved: 'gray',
}

export function StatusChip({ status }: { status?: string | null }) {
  const s = status ?? 'unknown'
  return <Chip tone={STATUS_META[s] ?? 'gray'}>{s}</Chip>
}

const SOURCE_TONES: Record<string, keyof typeof CHIP_TONES> = {
  POWO: 'green',
  GBIF: 'blue',
  EMA: 'blue',
  PubMed: 'blue',
  PubChem: 'teal',
  LLM_knowledge: 'purple',
}

export function SourceChip({ source }: { source?: string | null }) {
  const s = source ?? '?'
  return <Chip tone={SOURCE_TONES[s] ?? 'gray'}>{s.replace('_', ' ')}</Chip>
}

export function PolarityChip({ polarity }: { polarity?: string | null }) {
  const p = (polarity ?? 'unstated').toLowerCase()
  const tone = p === 'positive' ? 'green' : p === 'negative' ? 'red' : 'gray'
  return (
    <Chip tone={tone} title={`Claim polarity: ${p}`}>
      {p === 'positive' ? '+' : p === 'negative' ? '\u2212' : '\u00B7'} {p}
    </Chip>
  )
}

/* ------------------------------ structure -------------------------------- */

export function Panel({
  title,
  aside,
  children,
  className,
  tone,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  tone?: string
}) {
  return (
    <section
      className={cx(
        'rounded-lg border border-ink/10 bg-parchment-2/80 shadow-sm',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-2.5">
        <h3 className="rule-title flex items-center gap-2">
          {tone && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />}
          {title}
        </h3>
        {aside}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

export function ConfidenceBar({
  value,
  label,
}: {
  value?: number | null
  label?: string
}) {
  if (value == null || Number.isNaN(value)) {
    return <span className="text-xs italic text-ink-faint">no confidence recorded</span>
  }
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const color = pct >= 80 ? '#2f5233' : pct >= 50 ? '#b7791f' : '#8b3a2f'
  return (
    <div className="flex items-center gap-2" title={`confidence ${pct}%`}>
      <div className="h-2 w-28 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[11px] text-ink-soft">
        {pct}%{label ? ` ${label}` : ''}
      </span>
    </div>
  )
}

export function Spinner({ label = 'Loading\u2026' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-soft">
      <div className="hc-spinner h-8 w-8 rounded-full border-2 border-gold/30 border-t-gold" />
      <p className="font-display text-lg italic">{label}</p>
    </div>
  )
}

export function ErrorBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="mx-auto my-10 max-w-lg rounded-lg border border-rust/30 bg-rust-pale/60 px-5 py-4 text-center">
      <p className="font-display text-lg text-rust">Something went wrong</p>
      <p className="mt-1 font-mono text-xs text-ink-soft">{message}</p>
      {hint && <p className="mt-2 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-[15px] italic text-ink-faint">
      {children}
    </p>
  )
}

export function ExternalLink({
  href,
  children,
  className,
}: {
  href?: string | null
  children: ReactNode
  className?: string
}) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(
        'inline-flex items-center gap-0.5 text-evidblue underline decoration-evidblue/30 underline-offset-2 transition-colors hover:decoration-evidblue',
        className,
      )}
    >
      {children}
      <span aria-hidden className="text-[10px]">
        &#8599;
      </span>
    </a>
  )
}

export function Quote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <blockquote
      className={cx(
        'border-l-2 border-gold/50 pl-2.5 font-display text-[15px] italic leading-snug text-ink-soft',
        className,
      )}
    >
      {children}
    </blockquote>
  )
}

export function DataSourceChip({ source }: { source: 'remote' | 'bundled' }) {
  return source === 'remote' ? (
    <Chip tone="green" title="Loaded from the pipeline's /data endpoint">
      live /data
    </Chip>
  ) : (
    <Chip tone="amber" title="Pipeline data not found — showing bundled sample data">
      sample data
    </Chip>
  )
}

/* ------------------------------ formatting ------------------------------- */

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 90) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function titleCaseKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase())
}

/* Renders a value from an arbitrary property bag. */
export function PropValue({ value }: { value: unknown }) {
  if (value == null) return <span className="text-ink-faint">null</span>
  if (typeof value === 'boolean')
    return <Chip tone={value ? 'green' : 'red'}>{String(value)}</Chip>
  if (typeof value === 'number') return <span className="font-mono text-[13px]">{value}</span>
  if (typeof value === 'object') {
    return <code className="rounded bg-ink/5 px-1 font-mono text-[11px]">{JSON.stringify(value)}</code>
  }
  const s = String(value)
  if (/^https?:\/\//i.test(s)) {
    return <ExternalLink href={s}>{s.length > 48 ? `${s.slice(0, 48)}\u2026` : s}</ExternalLink>
  }
  return <span>{s}</span>
}
