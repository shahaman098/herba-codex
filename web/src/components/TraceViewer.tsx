import { useEffect, useMemo, useState } from 'react'
import { loadTrace } from '../data'
import type { TraceEvent } from '../types'
import {
  Chip,
  DataSourceChip,
  EmptyNote,
  ErrorBlock,
  Spinner,
  agentColor,
  cx,
  fmtDuration,
  fmtInt,
  fmtTokens,
} from './ui'

/* ------------------------------ constants -------------------------------- */

const AGENT_ORDER = ['Historian', 'Botanist', 'Pharmacologist', 'Evidence Scorer', 'Auditor'] as const

const AGENT_ICONS: Record<string, string> = {
  Historian: '\u{1F4DC}',
  Botanist: '\u{1F33F}',
  Pharmacologist: '\u2697\uFE0F',
  'Evidence Scorer': '\u2696\uFE0F',
  Auditor: '\u{1F6E1}\uFE0F',
}

const AGENT_BLURBS: Record<string, string> = {
  Historian: 'Extracts claims verbatim from the historical text',
  Botanist: 'Resolves names to modern taxonomy via Kew POWO / GBIF',
  Pharmacologist: 'Links taxa to EMA, PubMed & PubChem evidence',
  'Evidence Scorer': 'Grades concordance A\u2013D / X between claim and evidence',
  Auditor: 'Verifies quotes & grades \u2014 adversarial second pass',
}

const KIND_GLYPHS: Record<string, string> = {
  run_start: '\u25B6',
  agent_run_start: '\u25C6',
  llm_call: '\u2733',
  tool_call: '\u2699',
  tool_result: '\u21B3',
  agent_final: '\u2714',
  agent_run_end: '\u25CB',
  stage_retry: '\u21BB',
  entry_done: '\u25A0',
  entry_error: '\u2715',
  progress: '\u2026',
  run_end: '\u25FC',
}

const KIND_TONES: Record<string, string> = {
  llm_call: '#6b4d8a',
  tool_call: '#1f7a72',
  tool_result: '#8a8069',
  agent_final: '#2f5233',
  stage_retry: '#b7791f',
  entry_done: '#2f5233',
  entry_error: '#8b3a2f',
  run_start: '#57503f',
  run_end: '#57503f',
  progress: '#8a8069',
  agent_run_start: '#57503f',
  agent_run_end: '#8a8069',
}

interface Group {
  id: string
  title: string
  events: TraceEvent[]
}

function groupEvents(events: TraceEvent[]): Group[] {
  const groups = new Map<string, Group>()
  const agentCurrent = new Map<string, string>()
  const ensure = (id: string, title?: string): Group => {
    let g = groups.get(id)
    if (!g) {
      g = { id, title: title ?? (id === 'run' ? 'Run orchestration' : id), events: [] }
      groups.set(id, g)
    } else if (title && g.title === id) {
      g.title = title
    }
    return g
  }
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>
    const meta = typeof p.meta === 'object' && p.meta ? (p.meta as Record<string, unknown>) : {}
    const eid =
      (e.entry_id as string | undefined) ??
      (p.entry_id as string | undefined) ??
      (meta.entry_id as string | undefined)
    if (eid) {
      const title = (p.entry as string | undefined) ?? (p.heading as string | undefined)
      ensure(eid, title)
    }
    const gid = eid ?? (e.agent ? agentCurrent.get(e.agent) : undefined) ?? 'run'
    const g = ensure(gid, gid === 'run' ? undefined : gid)
    g.events.push(e)
    if (e.agent && eid) agentCurrent.set(e.agent, eid)
  }
  return [...groups.values()]
}

function usageOf(e: TraceEvent): { prompt: number; completion: number } {
  const u = (e.payload?.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number }
  return { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0 }
}

function eventSummary(e: TraceEvent): string {
  const p = (e.payload ?? {}) as Record<string, unknown>
  switch (e.kind) {
    case 'run_start':
      return `${p.corpus ?? 'corpus'} \u00B7 ${fmtInt(Number(p.entries ?? 0))} entries \u00B7 ${p.mode ?? ''}`
    case 'progress':
      return String(p.message ?? 'progress')
    case 'agent_run_start':
      return `${p.entry ?? p.heading ?? ''} \u00B7 stage ${e.stage ?? p.stage ?? '?'}`
    case 'llm_call': {
      const u = usageOf(e)
      return `${p.step ?? 'call'} \u00B7 ${p.model ?? '?'} \u00B7 ${fmtInt(u.prompt)}\u2192${fmtInt(u.completion)} tok`
    }
    case 'tool_call':
      return `${e.tool ?? p.tool ?? '?'} (${e.mode ?? p.mode ?? 'guided'})`
    case 'tool_result': {
      const r = p.result
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>
        if ('n' in o) return `${e.tool ?? ''} \u2192 ${o.n} results`
        if ('verified' in o) return `${e.tool ?? ''} \u2192 ${o.verified} verified${o.failed ? `, ${o.failed} failed` : ''}`
        if ('matched' in o) return `${e.tool ?? ''} \u2192 ${o.matched} matched`
        if ('found' in o) return `${e.tool ?? ''} \u2192 ${o.found ? 'found' : 'not found'}`
        if ('ok' in o) return `${e.tool ?? ''} \u2192 ${o.ok ? 'ok' : 'errors'}`
        return `${e.tool ?? ''} \u2192 ${JSON.stringify(r).slice(0, 60)}\u2026`
      }
      return `${e.tool ?? ''} \u2192 done`
    }
    case 'agent_final': {
      const inner = p.payload as Record<string, unknown> | undefined
      const bits: string[] = []
      if (inner) {
        if ('verdict' in inner) bits.push(`verdict ${inner.verdict}`)
        if ('grade' in inner) bits.push(`grade ${inner.grade}`)
        if ('resolved' in inner) bits.push(`${inner.resolved} resolved`)
        if ('historical_names' in inner) bits.push(`${inner.historical_names} names`)
        if ('pubmed' in inner) bits.push(`${inner.pubmed} pubmed`)
      }
      return `${e.agent ?? ''} finished${bits.length ? ` \u00B7 ${bits.join(', ')}` : ''}`
    }
    case 'agent_run_end':
      return `${e.agent ?? p.agent ?? ''} done${p.elapsed_s != null ? ` \u00B7 ${p.elapsed_s}s` : ''}`
    case 'stage_retry':
      return `attempt ${p.attempt ?? '?'} \u00B7 ${String(p.reason ?? '').slice(0, 70)}`
    case 'entry_done':
      return `grade ${p.grade ?? '?'} \u00B7 ${p.verdict ?? ''} \u00B7 ${p.elapsed_s ?? '?'}s`
    case 'entry_error':
      return String(p.error ?? 'entry failed')
    case 'run_end':
      return `${fmtInt(Number(p.entries_done ?? 0))} entries done \u00B7 ${p.duration_s ?? '?'}s`
    default:
      return JSON.stringify(p).slice(0, 70)
  }
}

/* --------------------------- JSON pretty-print --------------------------- */

function highlightJson(src: string): string {
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m: string) => {
      let cls = 'text-[#d9b96a]'
      if (m.startsWith('"')) cls = m.trimEnd().endsWith(':') ? 'text-[#8fb6d9]' : 'text-[#a8c99a]'
      else if (m === 'true' || m === 'false') cls = 'text-[#c8a2cf]'
      else if (m === 'null') cls = 'text-[#8a8069]'
      return `<span class="${cls}">${m}</span>`
    },
  )
}

function JsonBlock({ value, title }: { value: unknown; title?: string }) {
  const { html, isPretty } = useMemo(() => {
    let text: string
    let pretty = true
    if (typeof value === 'string') {
      try {
        text = JSON.stringify(JSON.parse(value), null, 2)
      } catch {
        text = value
        pretty = false
      }
    } else {
      try {
        text = JSON.stringify(value, null, 2) ?? 'null'
      } catch {
        text = String(value)
        pretty = false
      }
    }
    return { html: highlightJson(text), isPretty: pretty }
  }, [value])
  return (
    <div className="overflow-hidden rounded-md border border-ink/20">
      {title && (
        <div className="border-b border-white/10 bg-[#171310] px-3 py-1 text-[10.5px] uppercase tracking-wide text-[#8a8069]">
          {title}
          {!isPretty && <span className="ml-2 normal-case text-[#6b6a5e]">(raw preview)</span>}
        </div>
      )}
      <pre
        className="max-h-72 overflow-auto bg-[#201b14] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-[#cfc8b8]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

/* ------------------------------ component -------------------------------- */

export default function TraceViewer() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadTrace>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selIndex, setSelIndex] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    loadTrace()
      .then((r) => alive && setResult(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  const events = result?.data ?? []

  const stats = useMemo(() => {
    let llm = 0
    let tools = 0
    let tokens = 0
    const perAgent = new Map<string, { events: number; tokens: number }>()
    for (const e of events) {
      if (e.kind === 'llm_call') {
        llm += 1
        const u = usageOf(e)
        tokens += u.prompt + u.completion
      }
      if (e.kind === 'tool_call') tools += 1
      const a = e.agent ?? (typeof e.payload?.agent === 'string' ? (e.payload.agent as string) : undefined)
      if (a) {
        const rec = perAgent.get(a) ?? { events: 0, tokens: 0 }
        rec.events += 1
        if (e.kind === 'llm_call') {
          const u = usageOf(e)
          rec.tokens += u.prompt + u.completion
        }
        perAgent.set(a, rec)
      }
    }
    const first = events.length ? Date.parse(events[0].ts) : NaN
    const last = events.length ? Date.parse(events[events.length - 1].ts) : NaN
    return {
      llm,
      tools,
      tokens,
      duration: Number.isFinite(first) && Number.isFinite(last) ? last - first : 0,
      perAgent,
    }
  }, [events])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (agentFilter !== 'all') {
        const a = e.agent ?? (typeof e.payload?.agent === 'string' ? (e.payload.agent as string) : undefined)
        if (a !== agentFilter && e.kind !== 'run_start' && e.kind !== 'run_end' && e.kind !== 'progress') return false
      }
      if (!q) return true
      const hay = [
        e.kind,
        e.agent ?? '',
        e.tool ?? '',
        e.stage ?? '',
        e.entry_id ?? '',
        eventSummary(e),
        JSON.stringify(e.payload ?? {}),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [events, query, agentFilter])

  const groups = useMemo(() => groupEvents(filtered), [filtered])

  const selEvent: TraceEvent | null = selIndex != null ? (filtered[selIndex] ?? null) : null

  if (error) {
    return <ErrorBlock message={error} hint="Check that /data/trace_sample.jsonl is being served." />
  }
  if (!result) return <Spinner label="Replaying the agent run…" />

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* stats header */}
      <div className="border-b border-ink/10 px-4 pb-3 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="rule-title">Run {events[0]?.run_id ?? ''}</p>
          <DataSourceChip source={result.source} />
          {result.skipped > 0 && (
            <Chip tone="amber" title="Malformed JSONL lines were skipped">
              {result.skipped} malformed line{result.skipped === 1 ? '' : 's'} skipped
            </Chip>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatTile label="Events" value={fmtInt(events.length)} />
          <StatTile label="LLM calls" value={fmtInt(stats.llm)} />
          <StatTile label="Tool calls" value={fmtInt(stats.tools)} />
          <StatTile label="Tokens" value={fmtTokens(stats.tokens)} />
          <StatTile label="Duration" value={fmtDuration(stats.duration)} />
        </div>
        {/* agent role cards */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {AGENT_ORDER.map((a) => {
            const rec = stats.perAgent.get(a) ?? { events: 0, tokens: 0 }
            return (
              <button
                type="button"
                key={a}
                onClick={() => setAgentFilter(agentFilter === a ? 'all' : a)}
                className={cx(
                  'rounded-lg border bg-parchment-2/80 px-3 py-2 text-left transition-all',
                  agentFilter === a ? 'border-transparent shadow-md' : 'border-ink/10 hover:border-gold/50',
                )}
                style={agentFilter === a ? { borderColor: agentColor(a), boxShadow: `inset 3px 0 0 ${agentColor(a)}` } : { boxShadow: `inset 3px 0 0 ${agentColor(a)}` }}
                title={agentFilter === a ? `Click to clear the ${a} filter` : `Show only ${a} events`}
              >
                <div className="flex items-center gap-1.5">
                  <span aria-hidden className="text-[15px]">{AGENT_ICONS[a]}</span>
                  <span className="font-display text-[14.5px] font-semibold" style={{ color: agentColor(a) }}>
                    {a}
                  </span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-faint">{rec.events} ev</span>
                </div>
                <p className="mt-0.5 text-[10.5px] leading-tight text-ink-soft">{AGENT_BLURBS[a]}</p>
                <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{fmtTokens(rec.tokens)} tok</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* main split */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* event stream */}
        <aside className="flex min-h-0 w-full flex-col border-b border-ink/10 lg:w-[420px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter events (kind, tool, agent, text)…"
              className="w-full rounded-md border border-ink/20 bg-parchment-2 px-3 py-1.5 text-sm outline-none placeholder:text-ink-faint focus:border-gold focus:ring-1 focus:ring-gold/40"
            />
            {agentFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setAgentFilter('all')}
                className="shrink-0 rounded border px-2 py-1 text-[11px]"
                style={{ borderColor: agentColor(agentFilter), color: agentColor(agentFilter) }}
              >
                {agentFilter} &#215;
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups.length === 0 && (
              <div className="px-4 py-6">
                <EmptyNote>No events match this filter.</EmptyNote>
              </div>
            )}
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.id)
              return (
                <div key={g.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev)
                        if (next.has(g.id)) next.delete(g.id)
                        else next.add(g.id)
                        return next
                      })
                    }
                    className="flex w-full items-center gap-2 border-b border-ink/8 bg-parchment-3/40 px-3 py-1.5 text-left"
                  >
                    <span aria-hidden className={cx('text-[10px] text-ink-faint transition-transform', isCollapsed && '-rotate-90')}>
                      &#9662;
                    </span>
                    <span className="truncate font-display text-[14.5px] font-semibold text-ink">{g.title}</span>
                    <span className="truncate font-mono text-[10px] text-ink-faint">{g.id}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[10px] text-ink-soft">
                      {g.events.length}
                    </span>
                  </button>
                  {!isCollapsed &&
                    g.events.map((e) => {
                      const idx = filtered.indexOf(e)
                      const active = selIndex === idx
                      const color = agentColor(e.agent ?? (typeof e.payload?.agent === 'string' ? (e.payload.agent as string) : undefined))
                      const rel = events.length ? (Date.parse(e.ts) - Date.parse(events[0].ts)) / 1000 : 0
                      return (
                        <button
                          key={`${e.ts}-${e.kind}-${idx}`}
                          type="button"
                          onClick={() => setSelIndex(idx)}
                          className={cx(
                            'flex w-full items-start gap-2 border-b border-ink/5 px-3 py-1.5 text-left transition-colors',
                            active ? 'bg-gold-pale/70' : 'hover:bg-parchment-2/70',
                          )}
                        >
                          <span
                            aria-hidden
                            className="mt-[3px] w-4 shrink-0 text-center text-[11px]"
                            style={{ color: KIND_TONES[e.kind] ?? '#57503f' }}
                            title={e.kind}
                          >
                            {KIND_GLYPHS[e.kind] ?? '\u2022'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} title={e.agent ?? 'system'} />
                              <span className="truncate text-[12.5px] font-medium text-ink">{e.kind}</span>
                              <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">
                                +{rel.toFixed(1)}s
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[11.5px] text-ink-soft">{eventSummary(e)}</span>
                          </span>
                        </button>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </aside>

        {/* event detail */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selEvent ? (
            <EventDetail
              event={selEvent}
              index={selIndex ?? 0}
              total={filtered.length}
              onNavigate={(delta) =>
                setSelIndex((i) => {
                  const next = Math.min(filtered.length - 1, Math.max(0, (i ?? 0) + delta))
                  return next
                })
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="font-display text-xl italic text-ink-faint">Select an event to inspect its payload.</p>
              <p className="max-w-md text-[13px] text-ink-soft">
                The trace shows five specialised agents collaborating per entry: extraction &#8594; taxonomic
                resolution &#8594; evidence lookup &#8594; concordance scoring &#8594; adversarial audit.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-parchment-2/80 px-3 py-1.5">
      <p className="text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="font-display text-[19px] font-semibold leading-tight text-ink">{value}</p>
    </div>
  )
}

function EventDetail({
  event,
  index,
  total,
  onNavigate,
}: {
  event: TraceEvent
  index: number
  total: number
  onNavigate: (delta: number) => void
}) {
  const p = (event.payload ?? {}) as Record<string, unknown>
  const agent = event.agent ?? (typeof p.agent === 'string' ? (p.agent as string) : undefined)
  const tool = event.tool ?? (typeof p.tool === 'string' ? (p.tool as string) : undefined)
  const mode = event.mode ?? (typeof p.mode === 'string' ? (p.mode as string) : undefined)
  const stage = event.stage ?? (typeof p.stage === 'string' ? (p.stage as string) : undefined)
  const eid = event.entry_id ?? (typeof p.entry_id === 'string' ? (p.entry_id as string) : undefined)

  return (
    <div className="hc-fade mx-auto max-w-3xl space-y-3 px-4 py-4 lg:px-6">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-3">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-md text-[14px]"
          style={{ backgroundColor: 'rgba(38,33,26,0.06)', color: KIND_TONES[event.kind] ?? '#57503f' }}
          title={event.kind}
        >
          {KIND_GLYPHS[event.kind] ?? '\u2022'}
        </span>
        <h2 className="font-display text-[22px] font-semibold">{event.kind}</h2>
        {agent && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium text-parchment"
            style={{ backgroundColor: agentColor(agent) }}
          >
            <span aria-hidden>{AGENT_ICONS[agent] ?? ''}</span>
            {agent}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            disabled={index <= 0}
            className="rounded border border-ink/15 px-2 py-0.5 text-xs text-ink-soft disabled:opacity-30 hover:border-gold/60"
          >
            &#8592; prev
          </button>
          <span className="font-mono text-[10.5px] text-ink-faint">
            {index + 1}/{total}
          </span>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            disabled={index >= total - 1}
            className="rounded border border-ink/15 px-2 py-0.5 text-xs text-ink-soft disabled:opacity-30 hover:border-gold/60"
          >
            next &#8594;
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 text-[12px]">
        {eid && <Chip tone="gray" className="font-mono">{eid}</Chip>}
        {stage && <Chip tone="gray">stage: {stage}</Chip>}
        {tool && <Chip tone="teal">tool: {tool}</Chip>}
        {mode && (
          <Chip tone={mode === 'guided' ? 'green' : 'amber'} title="Execution mode of this span">
            {mode}
          </Chip>
        )}
        <Chip tone="gray" className="font-mono">{event.ts}</Chip>
        {event.run_id && <Chip tone="gray" className="font-mono">{event.run_id}</Chip>}
      </div>

      {event.kind === 'llm_call' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <StatTile label="Model" value={String(p.model ?? '?')} />
          <StatTile label="Prompt tokens" value={fmtInt(usageOf(event).prompt)} />
          <StatTile label="Completion tokens" value={fmtInt(usageOf(event).completion)} />
        </div>
      )}

      {event.kind === 'llm_call' && typeof p.response_preview === 'string' && (
        <JsonBlock title="Response preview" value={p.response_preview} />
      )}

      {event.kind === 'tool_call' && p.args != null && <JsonBlock title="Tool arguments" value={p.args} />}
      {event.kind === 'tool_call' && p.names != null && <JsonBlock title="Requested names" value={p.names} />}
      {event.kind === 'tool_call' && p.n_quotes != null && (
        <p className="text-[13px] text-ink-soft">
          Auditor requested verification of <strong>{String(p.n_quotes)}</strong> quotes.
        </p>
      )}

      {event.kind === 'tool_result' && p.result != null && <JsonBlock title="Tool result" value={p.result} />}

      {event.kind === 'agent_final' && p.payload != null && <JsonBlock title="Final agent payload" value={p.payload} />}

      {(event.kind === 'stage_retry' || event.kind === 'entry_error') && typeof p.reason === 'string' && (
        <p className="rounded-md border border-amber/30 bg-gold-pale/50 px-3 py-2 text-[13.5px] text-ink-soft">
          {String(p.reason)}
        </p>
      )}
      {event.kind === 'entry_error' && typeof p.error === 'string' && (
        <p className="rounded-md border border-rust/30 bg-rust-pale/60 px-3 py-2 font-mono text-[12.5px] text-rust">
          {String(p.error)}
        </p>
      )}
      {event.kind === 'progress' && typeof p.message === 'string' && (
        <p className="text-[14px] text-ink-soft">{String(p.message)}</p>
      )}

      <details className="rounded-md border border-ink/10 bg-parchment/60 px-3 py-2">
        <summary className="cursor-pointer text-[12px] uppercase tracking-wide text-ink-faint">Raw event JSON</summary>
        <div className="mt-2">
          <JsonBlock value={event} />
        </div>
      </details>
    </div>
  )
}
