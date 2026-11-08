import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadEntries } from '../data'
import type { Audit, Candidate, Concordance, Entry, Extraction, Resolution, TaxonEvidence } from '../types'
import {
  Chip,
  ConfidenceBar,
  DataSourceChip,
  EmptyNote,
  ErrorBlock,
  ExternalLink,
  GradeBadge,
  Panel,
  PolarityChip,
  Quote,
  SourceChip,
  Spinner,
  StatusChip,
  VerdictChip,
  cx,
} from './ui'

/* --------------------- quote highlighting (best-effort) ------------------ */

type QuoteKind = 'name' | 'ailment' | 'prep' | 'authority'

interface QuoteRef {
  text: string
  kind: QuoteKind
}

interface Seg {
  start: number
  end: number
  kind: QuoteKind
}

const HL_CLASS: Record<QuoteKind, string> = {
  name: 'hl-name',
  ailment: 'hl-ailment',
  prep: 'hl-prep',
  authority: 'hl-authority',
}

const HL_TITLE: Record<QuoteKind, string> = {
  name: 'extracted plant name',
  ailment: 'extracted ailment claim',
  prep: 'extracted preparation',
  authority: 'authority citation',
}

const LIGATURES: Record<string, string> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\u017F': 's',
}

/** Lowercase, drop punctuation/symbols, collapse whitespace; keep a map back to
 * original character indices so matches can be highlighted in the source. */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  const lowered = s.toLowerCase()
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < lowered.length; i++) {
    const ch = lowered[i]
    const lig = LIGATURES[ch]
    if (lig) {
      for (const c of lig) {
        norm += c
        map.push(i)
      }
      continue
    }
    if (/[\p{P}\p{S}]/u.test(ch)) continue
    if (/\s/u.test(ch)) {
      if (norm.length === 0 || norm.endsWith(' ')) continue
      norm += ' '
      map.push(i)
      continue
    }
    norm += ch
    map.push(i)
  }
  return { norm: norm.trimEnd(), map }
}

function findQuoteRange(source: string, quote: string): [number, number] | null {
  const q = quote.trim()
  if (!q) return null
  const src = normalizeWithMap(source)
  const qn = normalizeWithMap(q).norm
  if (!qn || !src.norm) return null
  let idx = src.norm.indexOf(qn)
  let len = qn.length
  if (idx < 0) {
    // best-effort: try a distinctive leading slice of the normalized quote
    const slice = qn.slice(0, Math.min(qn.length, 48))
    if (slice.length >= 16) {
      idx = src.norm.indexOf(slice)
      len = slice.length
    }
  }
  if (idx < 0 || src.map.length === 0) return null
  const start = src.map[idx]
  const endIdx = Math.min(idx + len - 1, src.map.length - 1)
  const end = src.map[endIdx] + 1
  return [start, Math.max(end, start + 1)]
}

function computeSegments(text: string, quotes: QuoteRef[]): Seg[] {
  const segs: Seg[] = []
  for (const q of quotes) {
    const r = findQuoteRange(text, q.text)
    if (r) segs.push({ start: r[0], end: r[1], kind: q.kind })
  }
  segs.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Seg[] = []
  let cursor = 0
  for (const s of segs) {
    if (s.start < cursor) continue
    out.push(s)
    cursor = s.end
  }
  return out
}

function HighlightedSource({ text, quotes }: { text: string; quotes: QuoteRef[] }) {
  const segs = useMemo(() => computeSegments(text, quotes), [text, quotes])
  const parts: ReactNode[] = []
  let pos = 0
  segs.forEach((s, i) => {
    if (s.start > pos) parts.push(<span key={`t${i}`}>{text.slice(pos, s.start)}</span>)
    parts.push(
      <mark key={`m${i}`} className={cx('hl', HL_CLASS[s.kind])} title={HL_TITLE[s.kind]}>
        {text.slice(s.start, s.end)}
      </mark>,
    )
    pos = s.end
  })
  if (pos < text.length) parts.push(<span key="tail">{text.slice(pos)}</span>)
  return (
    <p className="source-dropcap whitespace-pre-wrap font-display text-[16.5px] leading-relaxed text-ink">
      {parts}
    </p>
  )
}

/* ------------------------------ data helpers ----------------------------- */

function extractionOf(entry: Entry): Extraction | null {
  return entry.extraction && typeof entry.extraction === 'object' ? entry.extraction : null
}

function quoteRefsOf(entry: Entry): QuoteRef[] {
  const ex = extractionOf(entry)
  if (!ex) return []
  const refs: QuoteRef[] = []
  for (const h of ex.historical_names ?? []) {
    if (h?.context_quote) refs.push({ text: h.context_quote, kind: 'name' })
  }
  for (const a of ex.ailments ?? []) {
    if (a?.context_quote) refs.push({ text: a.context_quote, kind: 'ailment' })
  }
  for (const p of ex.preparations ?? []) {
    if (p?.context_quote) refs.push({ text: p.context_quote, kind: 'prep' })
  }
  for (const a of ex.authority_citations ?? []) {
    if (typeof a === 'string') continue
    if (a?.context_quote) refs.push({ text: a.context_quote, kind: 'authority' })
  }
  return refs
}

function taxaCount(entry: Entry): { resolved: number; total: number } {
  const total = extractionOf(entry)?.historical_names?.length ?? entry.resolutions?.length ?? 0
  const resolved = (entry.resolutions ?? []).filter((r) => r?.status === 'resolved').length
  return { resolved, total }
}

function verdictIcon(verdict?: string | null): { glyph: string; color: string; label: string } {
  if (verdict === 'pass') return { glyph: '\u2713', color: '#2f5233', label: 'pass' }
  if (verdict === 'pass_with_issues') return { glyph: '\u26A0', color: '#b7791f', label: 'issues' }
  if (verdict === 'fail') return { glyph: '\u2717', color: '#8b3a2f', label: 'fail' }
  return { glyph: '\u00B7', color: '#8a8069', label: 'pending' }
}

function pubmedUrl(item: { url?: string | null; identifier?: string }): string | null {
  if (item.url) return item.url
  const m = item.identifier?.match(/(\d{5,9})/)
  return m ? `https://pubmed.ncbi.nlm.nih.gov/${m[1]}/` : null
}

/* ------------------------------ component -------------------------------- */

export default function AuditDesk() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadEntries>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadEntries()
      .then((r) => {
        if (!alive) return
        setResult(r)
        const first = (r.data[0]?.id as string) ?? null
        setSelId((cur) => cur ?? first)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  const entries = result?.data ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const hay = [
        e.locator?.heading,
        e.id,
        e.locator?.corpus,
        e.locator?.work,
        e.concordance?.grade,
        e.audit?.verdict,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [entries, query])

  if (error) {
    return <ErrorBlock message={error} hint="Check that /data/entries.json is being served." />
  }
  if (!result) return <Spinner label="Opening the audit desk…" />

  const selected = entries.find((e) => e.id === selId) ?? filtered[0]

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* left: entry list */}
      <aside className="flex w-full shrink-0 flex-col border-b border-ink/10 lg:w-[320px] lg:border-b-0 lg:border-r">
        <div className="border-b border-ink/10 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="rule-title">Entries ({fmtCount(entries.length)})</p>
            <DataSourceChip source={result.source} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter entries…"
            className="mt-2 w-full rounded-md border border-ink/20 bg-parchment-2 px-3 py-1.5 text-sm outline-none placeholder:text-ink-faint focus:border-gold focus:ring-1 focus:ring-gold/40"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-4 py-6">
              <EmptyNote>No entries match this filter.</EmptyNote>
            </li>
          )}
          {filtered.map((e) => {
            const verdict = verdictIcon(e.audit?.verdict)
            const counts = taxaCount(e)
            const active = (selected?.id ?? null) === e.id
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelId(e.id)}
                  className={cx(
                    'w-full border-b border-ink/8 px-3.5 py-3 text-left transition-colors',
                    active ? 'bg-gold-pale/70 shadow-inner' : 'hover:bg-parchment-2/80',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cx('font-display text-[17px] font-semibold leading-tight', active ? 'text-ink' : 'text-ink-soft')}>
                      {e.locator?.heading ?? e.id}
                    </span>
                    <GradeBadge grade={e.concordance?.grade} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-faint">
                    <span className="uppercase tracking-wide">{e.locator?.corpus ?? '?'}</span>
                    <span className="flex items-center gap-1" style={{ color: verdict.color }} title={`audit: ${verdict.label}`}>
                      <span aria-hidden>{verdict.glyph}</span>
                      {verdict.label}
                    </span>
                    <span title="resolved historical names / total">
                      {counts.resolved}/{counts.total} taxa
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* right: entry detail */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? <EntryDetail entry={selected} /> : <Spinner label="Select an entry…" />}
      </div>
    </div>
  )
}

function fmtCount(n: number): string {
  return n.toLocaleString('en-US')
}

/* ------------------------------ detail ----------------------------------- */

function EntryDetail({ entry }: { entry: Entry }) {
  const ex = extractionOf(entry)
  const nameQuotes = quoteRefsOf(entry)
  const loc = entry.locator ?? {}
  return (
    <div key={entry.id} className="hc-fade mx-auto max-w-4xl space-y-4 px-4 py-4 lg:px-6">
      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <h2 className="font-display text-[28px] font-semibold leading-tight text-ink">
            {loc.heading ?? entry.id}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {loc.work ? <span className="font-display italic">{loc.work}</span> : null}
            {loc.work && loc.corpus ? ' · ' : null}
            <span className="uppercase tracking-wide text-ink-faint">{loc.corpus ?? 'unknown corpus'}</span>
            {loc.char_start != null && loc.char_end != null ? (
              <span className="ml-2 font-mono text-[11px] text-ink-faint">
                chars {fmtCount(loc.char_start)}–{fmtCount(loc.char_end)}
              </span>
            ) : null}
          </p>
          <p className="mt-1 font-mono text-[10.5px] text-ink-faint">
            {entry.id}
            {entry.meta?.run_id ? ` · run ${entry.meta.run_id}` : ''}
            {entry.meta?.processed_at ? ` · ${entry.meta.processed_at}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-ink-faint">grade</span>
            <GradeBadge grade={entry.concordance?.grade} size="lg" />
          </div>
          {loc.char_span_url && (
            <ExternalLink href={loc.char_span_url}>view source scan</ExternalLink>
          )}
        </div>
      </header>

      <SourcePanel entry={entry} quotes={nameQuotes} />
      <ExtractionPanel extraction={ex} />
      <ResolutionPanel resolutions={entry.resolutions ?? []} />
      <EvidencePanel evidence={entry.evidence ?? []} />
      <ConcordancePanel concordance={entry.concordance ?? null} />
      <AuditPanel audit={entry.audit ?? null} />
    </div>
  )
}

/* ------------------------------ panels ------------------------------------ */

function SourcePanel({ entry, quotes }: { entry: Entry; quotes: QuoteRef[] }) {
  return (
    <Panel
      title="Source"
      tone="#a67c2e"
      aside={
        quotes.length > 0 ? (
          <span className="text-[11px] text-ink-faint">
            {quotes.length} extracted quote{quotes.length === 1 ? '' : 's'} highlighted
          </span>
        ) : null
      }
    >
      {entry.source_text ? (
        <>
          <HighlightedSource text={entry.source_text} quotes={quotes} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink/8 pt-2 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(201,162,39,0.45)' }} /> plant names
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(139,58,47,0.32)' }} /> ailments
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(31,122,114,0.3)' }} /> preparations
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(107,77,138,0.32)' }} /> authorities
            </span>
          </div>
        </>
      ) : (
        <EmptyNote>No source text available for this entry.</EmptyNote>
      )}
    </Panel>
  )
}

function MiniTitle({ children }: { children: ReactNode }) {
  return <p className="rule-title mb-1.5">{children}</p>
}

function ExtractionPanel({ extraction }: { extraction: Extraction | null }) {
  if (!extraction) {
    return (
      <Panel title="Extraction" tone="#a67c2e">
        <EmptyNote>No extraction record — the Historian has not processed this entry yet.</EmptyNote>
      </Panel>
    )
  }
  const authorities = (extraction.authority_citations ?? []).map((a) =>
    typeof a === 'string' ? { authority: a, context_quote: undefined } : a,
  )
  const counts = [
    extraction.historical_names?.length ?? 0,
    extraction.ailments?.length ?? 0,
    extraction.preparations?.length ?? 0,
    authorities.length,
  ]
  return (
    <Panel
      title="Extraction"
      tone="#a67c2e"
      aside={<span className="text-[11px] text-ink-faint">{counts.join(' / ')} names / ailments / preps / authorities</span>}
    >
      <div className="space-y-4">
        <div>
          <MiniTitle>Plant mentions</MiniTitle>
          {(extraction.historical_names ?? []).length === 0 ? (
            <EmptyNote>None extracted.</EmptyNote>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(extraction.historical_names ?? []).map((h, i) => (
                <div key={i} className="rounded-md border border-gold/25 bg-parchment/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-[16px] font-semibold">{h.name_text}</span>
                    {h.part_used ? <Chip tone="green">part: {h.part_used}</Chip> : null}
                  </div>
                  {h.context_quote ? <Quote className="mt-1 text-[13.5px]">{h.context_quote}</Quote> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <MiniTitle>Ailments</MiniTitle>
          {(extraction.ailments ?? []).length === 0 ? (
            <EmptyNote>None extracted.</EmptyNote>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(extraction.ailments ?? []).map((a, i) => (
                <div key={i} className="rounded-md border border-rust/25 bg-parchment/70 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-display text-[16px] font-semibold">{a.name}</span>
                    <div className="flex items-center gap-1.5">
                      <PolarityChip polarity={a.polarity} />
                      {typeof a.strength === 'number' ? (
                        <Chip tone="gray" title="claim strength as judged by the Historian">
                          strength {Math.round(a.strength * 100)}%
                        </Chip>
                      ) : a.strength ? (
                        <Chip tone="gray">{String(a.strength)}</Chip>
                      ) : null}
                    </div>
                  </div>
                  {a.context_quote ? <Quote className="mt-1 text-[13.5px]">{a.context_quote}</Quote> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <MiniTitle>Preparations</MiniTitle>
          {(extraction.preparations ?? []).length === 0 ? (
            <EmptyNote>None extracted.</EmptyNote>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(extraction.preparations ?? []).map((p, i) => (
                <div key={i} className="rounded-md border border-verdigris/25 bg-parchment/70 px-3 py-2">
                  <Chip tone="teal">{p.kind}</Chip>
                  {p.context_quote ? <Quote className="mt-1.5 max-w-xs text-[13px]">{p.context_quote}</Quote> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {(extraction.cautions ?? []).length > 0 && (
          <div>
            <MiniTitle>Cautions</MiniTitle>
            <ul className="space-y-1">
              {(extraction.cautions ?? []).map((c, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] text-ink-soft">
                  <span aria-hidden className="text-amber">
                    &#9888;
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(extraction.dosage_notes ?? []).length > 0 && (
          <div>
            <MiniTitle>Dosage notes</MiniTitle>
            <ul className="list-inside list-disc space-y-0.5 text-[13.5px] text-ink-soft">
              {(extraction.dosage_notes ?? []).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <MiniTitle>Authority citations</MiniTitle>
          {authorities.length === 0 ? (
            <EmptyNote>None cited.</EmptyNote>
          ) : (
            <div className="flex flex-wrap gap-2">
              {authorities.map((a, i) => (
                <div key={i} className="rounded-md border border-amethyst/25 bg-parchment/70 px-3 py-2">
                  <Chip tone="purple">{a.authority ?? 'unknown'}</Chip>
                  {a.context_quote ? <Quote className="mt-1.5 max-w-xs text-[13px]">{a.context_quote}</Quote> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

function ResolutionPanel({ resolutions }: { resolutions: Resolution[] }) {
  return (
    <Panel
      title="Taxonomic resolution"
      tone="#3e6b48"
      aside={
        resolutions.length > 0 ? (
          <span className="text-[11px] text-ink-faint">
            {resolutions.filter((r) => r?.status === 'resolved').length}/{resolutions.length} resolved
          </span>
        ) : null
      }
    >
      {resolutions.length === 0 ? (
        <EmptyNote>No resolution record — the Botanist has not processed this entry yet.</EmptyNote>
      ) : (
        <div className="space-y-3">
          {resolutions.map((r, i) => (
            <ResolutionCard key={i} resolution={r} />
          ))}
        </div>
      )}
    </Panel>
  )
}

function ResolutionCard({ resolution: r }: { resolution: Resolution }) {
  const selectedCand = r.candidates?.find((c) => c.scientific_name && r.selected && c.scientific_name.startsWith(r.selected))
  return (
    <div className="rounded-lg border border-ink/10 bg-parchment/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-[17px] font-semibold">{r.historical_name}</span>
          <StatusChip status={r.status} />
        </div>
        <ConfidenceBar value={r.confidence ?? null} label="selected" />
      </div>
      {r.selected ? (
        <p className="mt-1.5 font-display text-[15px] italic text-forest-deep">
          &#8594; {r.selected}
          {selectedCand?.authorship ? <span className="not-italic text-ink-faint"> {selectedCand.authorship}</span> : null}
        </p>
      ) : (
        <p className="mt-1.5 text-[13.5px] italic text-ink-faint">No taxon selected.</p>
      )}
      {r.candidates && r.candidates.length > 0 ? (
        <table className="mt-2 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
              <th className="py-1 pr-2 font-medium">Scientific name</th>
              <th className="py-1 pr-2 font-medium">Family</th>
              <th className="py-1 pr-2 font-medium">Source</th>
              <th className="py-1 pr-2 font-medium">Conf.</th>
              <th className="py-1 font-medium">Matched via</th>
            </tr>
          </thead>
          <tbody>
            {r.candidates.map((c: Candidate, j: number) => (
              <tr key={j} className={cx('border-b border-ink/5 last:border-0', c.scientific_name && r.selected && c.scientific_name.startsWith(r.selected) && 'bg-forest-pale/50')}>
                <td className="py-1.5 pr-2 font-display italic">{c.scientific_name}</td>
                <td className="py-1.5 pr-2 text-ink-soft">{c.family}</td>
                <td className="py-1.5 pr-2">
                  <SourceChip source={c.source} />
                </td>
                <td className="py-1.5 pr-2 font-mono text-[11.5px]">{c.confidence != null ? `${Math.round(c.confidence * 100)}%` : '—'}</td>
                <td className="py-1.5 text-[11.5px] text-ink-faint">{c.matched_via}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-[12.5px] text-ink-faint">No candidates returned by any source.</p>
      )}
      {r.reasoning && (
        <p className="mt-2 border-t border-ink/8 pt-2 text-[13px] leading-snug text-ink-soft">{r.reasoning}</p>
      )}
    </div>
  )
}

function EvidencePanel({ evidence }: { evidence: TaxonEvidence[] }) {
  return (
    <Panel title="Modern evidence" tone="#2b5d8a">
      {evidence.length === 0 ? (
        <EmptyNote>No evidence record — the Pharmacologist has not processed this entry yet.</EmptyNote>
      ) : (
        <div className="space-y-4">
          {evidence.map((te, i) => (
            <div key={i} className="space-y-2.5">
              <p className="font-display text-[18px] font-semibold italic text-forest-deep">{te.taxon}</p>
              {te.ema_monograph && <EmaCard item={te.ema_monograph} />}
              {(te.pubmed ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <MiniTitle>PubMed</MiniTitle>
                  {(te.pubmed ?? []).map((p, j) => (
                    <PubmedCard key={j} item={p} />
                  ))}
                </div>
              )}
              {((te.notable_constituents ?? []).length > 0 || (te.pubchem_cids ?? []).length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(te.notable_constituents ?? []).map((c, j) => (
                    <Chip key={j} tone="teal">
                      {c}
                    </Chip>
                  ))}
                  {(te.pubchem_cids ?? []).map((cid, j) => (
                    <ExternalLink
                      key={j}
                      href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`}
                      className="font-mono text-[11.5px]"
                    >
                      PubChem CID {cid}
                    </ExternalLink>
                  ))}
                </div>
              )}
              {te.summary && (
                <p className="border-l-2 border-evidblue/40 pl-3 font-display text-[15px] italic leading-relaxed text-ink-soft">
                  {te.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function EmaCard({ item }: { item: NonNullable<TaxonEvidence['ema_monograph']> }) {
  return (
    <div className="rounded-md border border-evidblue/30 bg-evidblue-pale/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="blue">EMA monograph</Chip>
        {item.year ? <span className="text-[12px] text-ink-soft">{item.year}</span> : null}
        {item.identifier ? <code className="font-mono text-[11px] text-ink-faint">{item.identifier}</code> : null}
      </div>
      <p className="mt-1.5 text-[14px] font-medium leading-snug">
        {item.title} {item.url ? <ExternalLink href={item.url}>open</ExternalLink> : null}
      </p>
      {item.relevance_note && <p className="mt-1 text-[12.5px] text-ink-soft">{item.relevance_note}</p>}
    </div>
  )
}

function PubmedCard({ item }: { item: NonNullable<TaxonEvidence['pubmed']>[number] }) {
  const url = pubmedUrl(item)
  return (
    <div className="rounded-md border border-ink/10 bg-parchment/70 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[13.5px] font-medium leading-snug">{item.title}</span>
        {item.year ? <span className="text-[12px] text-ink-faint">({item.year})</span> : null}
        {url ? (
          <ExternalLink href={url} className="font-mono text-[11.5px]">
            {item.identifier ?? 'PubMed'}
          </ExternalLink>
        ) : item.identifier ? (
          <code className="font-mono text-[11px] text-ink-faint">{item.identifier}</code>
        ) : null}
      </div>
      {item.relevance_note && <p className="mt-0.5 text-[12.5px] text-ink-soft">{item.relevance_note}</p>}
    </div>
  )
}

function ConcordancePanel({ concordance }: { concordance: Concordance | null }) {
  if (!concordance) {
    return (
      <Panel title="Concordance" tone="#6b4d8a">
        <EmptyNote>Not yet scored — no concordance record for this entry.</EmptyNote>
      </Panel>
    )
  }
  return (
    <Panel title="Concordance" tone="#6b4d8a">
      <div className="flex flex-wrap items-center gap-4">
        <GradeBadge grade={concordance.grade} size="xl" title={`Concordance grade ${concordance.grade}`} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {concordance.direction ? (
              <Chip tone="blue" title="Direction of agreement">
                {concordance.direction}
              </Chip>
            ) : null}
            <span className="text-[12px] text-ink-faint">
              A = strong concordance · X = no meaningful modern evidence
            </span>
          </div>
          {concordance.rationale && (
            <p className="font-display text-[15px] leading-relaxed text-ink-soft">{concordance.rationale}</p>
          )}
        </div>
      </div>
      {concordance.uncertainty && (
        <p className="mt-3 rounded-md border border-amber/25 bg-gold-pale/40 px-3 py-2 text-[13px] text-ink-soft">
          <span className="font-semibold text-amber">Uncertainty: </span>
          {concordance.uncertainty}
        </p>
      )}
      {(concordance.caveats ?? []).length > 0 && (
        <div className="mt-3">
          <MiniTitle>Caveats</MiniTitle>
          <ul className="space-y-1">
            {(concordance.caveats ?? []).map((c, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                <span aria-hidden className="text-ink-faint">
                  &#8226;
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

function AuditPanel({ audit }: { audit: Audit | null }) {
  if (!audit) {
    return (
      <Panel title="Audit" tone="#8b3a2f">
        <EmptyNote>Audit pending — the Auditor has not reviewed this entry yet.</EmptyNote>
      </Panel>
    )
  }
  const verified = audit.quotes_verified ?? []
  const failed = audit.quotes_failed ?? []
  const issues = audit.issues ?? []
  return (
    <Panel title="Audit" tone="#8b3a2f">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictChip verdict={audit.verdict} size="lg" />
        <Chip tone={audit.schema_ok ? 'green' : 'red'} title="Passed JSON schema validation">
          schema {audit.schema_ok ? 'ok' : 'invalid'}
        </Chip>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-forest/25 bg-forest-pale/50 px-3 py-2">
          <p className="rule-title !text-forest-deep">Quotes verified</p>
          <p className="font-display text-[26px] font-semibold text-forest-deep">{verified.length}</p>
          {verified.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {verified.map((q, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] text-ink-soft">
                  <span aria-hidden className="text-forest">
                    &#10003;
                  </span>
                  <span className="line-clamp-1">{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border border-rust/25 bg-rust-pale/50 px-3 py-2">
          <p className="rule-title !text-rust">Quotes failed</p>
          <p className="font-display text-[26px] font-semibold text-rust">{failed.length}</p>
          {failed.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {failed.map((q, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] text-ink-soft">
                  <span aria-hidden className="text-rust">
                    &#10007;
                  </span>
                  <span className="line-clamp-1">{q}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] italic text-ink-faint">All extracted quotes verified verbatim.</p>
          )}
        </div>
      </div>
      {issues.length > 0 && (
        <div className="mt-3">
          <MiniTitle>Issues ({issues.length})</MiniTitle>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                <span aria-hidden className="text-amber">
                  &#9888;
                </span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
