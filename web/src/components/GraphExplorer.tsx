import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, StylesheetJson } from 'cytoscape'
import { loadGraph } from '../data'
import type { GraphData, GraphEdge, GraphNode } from '../types'
import {
  Chip,
  ConfidenceBar,
  DataSourceChip,
  EmptyNote,
  ErrorBlock,
  ExternalLink,
  GradeBadge,
  NODE_COLORS,
  PropValue,
  Spinner,
  VerdictChip,
  cx,
  fmtInt,
  titleCaseKey,
} from './ui'

/* ------------------------------ helpers ---------------------------------- */

const edgeIdOf = (e: GraphEdge): string => `${e.source}|${e.type ?? e.key ?? ''}|${e.target}`

function entryGradeColor(n: GraphNode): string {
  const g = String(n.grade ?? '').toUpperCase()
  const map: Record<string, string> = {
    A: '#2f5233',
    B: '#1f7a72',
    C: '#b7791f',
    D: '#8b3a2f',
    X: '#6b6a5e',
  }
  return map[g] ?? '#2f5233'
}

function buildElements(data: GraphData): ElementDefinition[] {
  const nodes: ElementDefinition[] = data.nodes.map((n) => ({
    data: {
      ...n,
      bg: NODE_COLORS[n.type] ?? '#6b6a5e',
      gradeColor: entryGradeColor(n),
    },
  }))
  const edges: ElementDefinition[] = data.edges.map((e) => ({
    data: {
      id: edgeIdOf(e),
      source: e.source,
      target: e.target,
      key: e.type ?? e.key ?? 'related',
      provenance: e.provenance ?? {},
    },
  }))
  return [...nodes, ...edges]
}

const CY_STYLE: StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'background-color': 'data(bg)',
      'border-width': 1.5,
      'border-color': 'rgba(38,33,26,0.35)',
      color: '#26211a',
      'font-family': 'Inter Variable, sans-serif',
      'font-size': 11,
      'font-weight': 500,
      'text-valign': 'bottom',
      'text-margin-y': 7,
      'text-wrap': 'wrap',
      'text-max-width': '150',
      'text-background-color': '#f7f3e9',
      'text-background-opacity': 0.88,
      'text-background-padding': '2',
      width: '26',
      height: '26',
    },
  },
  {
    selector: 'node[type = "Entry"]',
    style: {
      shape: 'round-rectangle',
      width: '124',
      height: '46',
      'background-color': '#3e6b48',
      'border-color': 'data(gradeColor)',
      'border-width': 3,
      color: '#f7f3e9',
      'text-valign': 'center',
      'text-margin-y': 0,
      'font-size': 13,
      'font-weight': 600,
      'text-background-opacity': 0,
    },
  },
  {
    selector: 'node[type = "Taxon"]',
    style: { width: '30', height: '30', 'font-style': 'italic' },
  },
  {
    selector: 'node[type = "Source"]',
    style: { shape: 'diamond', width: '34', height: '34', color: '#57503f' },
  },
  {
    selector: 'node[type = "Authority"]',
    style: { shape: 'hexagon', width: '28', height: '28' },
  },
  {
    selector: 'node[type = "Evidence"]',
    style: { shape: 'round-tag', width: '26', height: '26' },
  },
  {
    selector: 'edge',
    style: {
      width: '2',
      'curve-style': 'bezier',
      'line-color': '#b0a488',
      'target-arrow-shape': 'vee',
      'target-arrow-color': '#b0a488',
      'arrow-scale': 1.1,
      label: 'data(key)',
      'font-size': 9,
      'font-family': 'Inter Variable, sans-serif',
      color: '#57503f',
      'text-background-color': '#f1ead9',
      'text-background-opacity': 0.92,
      'text-background-padding': '2',
      'text-rotation': 'autorotate',
      'text-opacity': 0,
    },
  },
  {
    selector: 'edge.incident',
    style: {
      'line-color': '#8fae8f',
      'target-arrow-color': '#8fae8f',
      width: '2.5',
    },
  },
  {
    selector: 'edge.edge-selected',
    style: {
      'line-color': '#c9a227',
      'target-arrow-color': '#c9a227',
      width: '3.5',
      'text-opacity': 1,
      'z-index': 10,
    },
  },
  {
    selector: 'node.node-selected',
    style: {
      'border-color': '#c9a227',
      'border-width': '4',
      'overlay-color': '#c9a227',
      'overlay-opacity': 0.14,
      'overlay-padding': 6,
    },
  },
  {
    selector: 'node.search-hit',
    style: {
      'border-color': '#c9a227',
      'border-width': 3.5,
      'overlay-color': '#c9a227',
      'overlay-opacity': 0.1,
      'overlay-padding': 4,
    },
  },
  { selector: '.dimmed', style: { opacity: 0.12 } },
  { selector: '.type-hidden', style: { display: 'none' } },
]

/* ------------------------------ component -------------------------------- */

interface Badge {
  id: string
  label: string
  grade: string
  x: number
  y: number
  top: number
}

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

/** cytoscape's bundled typings only accept strings for padding; runtime accepts numbers. */
function fitPad(cy: Core, padding: number): void {
  ;(cy.fit as unknown as (pad?: number) => void)(padding)
}

export default function GraphExplorer() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadGraph>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [badges, setBadges] = useState<Badge[]>([])
  const [cyReady, setCyReady] = useState(0)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)

  useEffect(() => {
    let alive = true
    loadGraph()
      .then((r) => alive && setResult(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  const data = result?.data

  /* ---- create / recreate the cytoscape instance ---- */
  useEffect(() => {
    if (!data || !containerRef.current) return
    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(data),
      style: CY_STYLE,
      wheelSensitivity: 0.2,
      minZoom: 0.15,
      maxZoom: 3,
    })
    cyRef.current = cy

    // Badge overlay: cytoscape does not reliably emit a core "render" event on
    // every redraw, so track Entry-node screen positions via viewport events
    // plus a light polling interval (cheap: one item per entry).
    const updateBadges = () => {
      const zoom = cy.zoom()
      const half = (46 * zoom) / 2
      const items: Badge[] = []
      cy.nodes('[type = "Entry"]').forEach((n) => {
        const p = n.renderedPosition()
        items.push({
          id: n.id(),
          label: String(n.data('label') ?? ''),
          grade: String(n.data('grade') ?? '?'),
          x: p.x,
          y: p.y,
          top: p.y - half - 12,
        })
      })
      setBadges(items)
    }
    cy.on('pan zoom resize', updateBadges)
    const badgeTimer = window.setInterval(updateBadges, 200)
    updateBadges()

    cy.on('tap', 'node', (evt) => setSelection({ kind: 'node', id: evt.target.id() }))
    cy.on('tap', 'edge', (evt) => setSelection({ kind: 'edge', id: evt.target.id() }))
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelection(null)
    })

    const runLayout = () => {
      cy.layout({
        name: 'cose',
        randomize: true,
        animate: true,
        animationDuration: 450,
        padding: 36,
        nodeRepulsion: 16000,
        idealEdgeLength: () => 170,
        gravity: 0.6,
      }).run()
    }
    runLayout()
    cy.one('layoutstop', () => {
      fitPad(cy, 48)
      updateBadges()
    })

    const ro = new ResizeObserver(() => cy.resize())
    ro.observe(containerRef.current)

    setCyReady((v) => v + 1)
    return () => {
      ro.disconnect()
      window.clearInterval(badgeTimer)
      cy.destroy()
      cyRef.current = null
      setBadges([])
    }
  }, [data])

  /* ---- apply search highlighting ---- */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !data) return []
    return data.nodes.filter((n) => String(n.label ?? '').toLowerCase().includes(q))
  }, [query, data])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('dimmed search-hit')
    cy.edges().removeClass('dimmed')
    const q = query.trim().toLowerCase()
    if (!q) return
    const hit = cy.nodes().filter((n) => String(n.data('label') ?? '').toLowerCase().includes(q))
    hit.addClass('search-hit')
    cy.nodes().not(hit).addClass('dimmed')
    cy.edges().addClass('dimmed')
    hit.connectedEdges().removeClass('dimmed')
  }, [matches, cyReady])

  /* ---- apply type visibility ---- */
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('type-hidden')
    for (const t of hiddenTypes) {
      cy.nodes(`[type = "${t}"]`).addClass('type-hidden')
    }
  }, [hiddenTypes, cyReady])

  /* ---- apply selection styling ---- */
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('node-selected')
    cy.edges().removeClass('edge-selected incident')
    if (!selection) return
    if (selection.kind === 'node') {
      const n = cy.getElementById(selection.id)
      n.addClass('node-selected')
      n.connectedEdges().addClass('incident')
    } else {
      cy.getElementById(selection.id).addClass('edge-selected')
    }
  }, [selection, cyReady])

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (const n of data?.nodes ?? []) m.set(n.id, n)
    return m
  }, [data])

  const typeCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const n of data?.nodes ?? []) c.set(n.type, (c.get(n.type) ?? 0) + 1)
    return c
  }, [data])

  if (error) {
    return <ErrorBlock message={error} hint="Check that /data/graph.json is being served." />
  }
  if (!result || !data) return <Spinner label="Unrolling the folios…" />

  const selNode = selection?.kind === 'node' ? nodeById.get(selection.id) : undefined
  const selEdge: GraphEdge | undefined =
    selection?.kind === 'edge'
      ? data.edges.find((e) => edgeIdOf(e) === selection.id)
      : undefined
  const connectedEdges = selNode
    ? data.edges.filter((e) => e.source === selNode.id || e.target === selNode.id)
    : []

  const selectFirstMatch = () => {
    if (matches.length > 0) setSelection({ kind: 'node', id: matches[0].id })
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="relative flex min-h-[380px] flex-1 flex-col lg:min-h-0">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-4 py-2.5">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && selectFirstMatch()}
              placeholder="Search nodes (label substring)…"
              className="w-64 rounded-md border border-ink/20 bg-parchment-2 px-3 py-1.5 pr-8 text-sm outline-none placeholder:text-ink-faint focus:border-gold focus:ring-1 focus:ring-gold/40"
            />
            <span aria-hidden className="pointer-events-none absolute right-2.5 top-1.5 text-ink-faint">
              &#8981;
            </span>
          </div>
          {query.trim() ? (
            <span className="text-xs text-ink-soft">
              {matches.length} match{matches.length === 1 ? '' : 'es'}
              {matches.length > 0 && <span className="text-ink-faint"> · press Enter to inspect first</span>}
            </span>
          ) : (
            <span className="text-xs text-ink-faint">{fmtInt(data.nodes.length)} nodes · {fmtInt(data.edges.length)} edges</span>
          )}
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const cy = cyRef.current
                if (!cy) return
                cy.layout({ name: 'cose', randomize: true, animate: true, animationDuration: 400, padding: 36, nodeRepulsion: 16000, idealEdgeLength: () => 170, gravity: 0.6 }).run()
                cy.one('layoutstop', () => fitPad(cy, 48))
              }}
              className="rounded border border-ink/15 bg-parchment-2 px-2.5 py-1 text-xs text-ink-soft hover:border-gold/60 hover:text-ink"
            >
              Re-layout
            </button>
            <button
              type="button"
              onClick={() => {
                const cy = cyRef.current
                if (cy) fitPad(cy, 48)
              }}
              className="rounded border border-ink/15 bg-parchment-2 px-2.5 py-1 text-xs text-ink-soft hover:border-gold/60 hover:text-ink"
            >
              Fit
            </button>
          </div>
        </div>

        {/* graph canvas */}
        <div className="parchment-bg relative flex-1 overflow-hidden">
          {/* note: cytoscape forces its container to position:relative, so size it
              with h-full/w-full rather than absolute inset-0 */}
          <div ref={containerRef} className="cy-canvas h-full w-full" />
          {/* grade badges over Entry nodes */}
          {badges.map((b) => (
            <div
              key={b.id}
              className="pointer-events-none absolute z-10"
              style={{ left: b.x, top: b.top, transform: 'translate(-50%, -50%)' }}
            >
              <GradeBadge grade={b.grade} title={`${b.label} — grade ${b.grade}`} />
            </div>
          ))}
          {/* legend */}
          <div className="absolute bottom-3 left-3 z-10 max-w-[240px] rounded-md border border-ink/10 bg-parchment-2/95 p-2.5 shadow-md backdrop-blur-sm">
            <p className="rule-title mb-1.5">Node types</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.keys(NODE_COLORS)
                .filter((t) => (typeCounts.get(t) ?? 0) > 0)
                .map((t) => {
                  const hidden = hiddenTypes.has(t)
                  return (
                    <li key={t}>
                      <button
                        type="button"
                        onClick={() =>
                          setHiddenTypes((prev) => {
                            const next = new Set(prev)
                            if (next.has(t)) next.delete(t)
                            else next.add(t)
                            return next
                          })
                        }
                        className={cx(
                          'flex items-center gap-1.5 text-[11px] transition-opacity',
                          hidden ? 'opacity-35 line-through' : 'hover:opacity-80',
                        )}
                        title={hidden ? `Show ${t} nodes` : `Hide ${t} nodes`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ backgroundColor: NODE_COLORS[t] }} />
                        <span className="text-ink-soft">{t}</span>
                        <span className="font-mono text-[10px] text-ink-faint">{typeCounts.get(t)}</span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        </div>
      </div>

      {/* side panel */}
      <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-ink/10 bg-parchment-2/60 lg:w-[360px] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <p className="rule-title">Inspector</p>
          <DataSourceChip source={result.source} />
        </div>

        {selNode ? (
          <NodeDetails node={selNode} edges={connectedEdges} onEdgeSelect={(e) => setSelection({ kind: 'edge', id: edgeIdOf(e) })} />
        ) : (
          <div className="px-4 pt-3">
            <EmptyNote>Select a node to inspect its properties and provenance.</EmptyNote>
          </div>
        )}

        {selEdge && <EdgeDetails edge={selEdge} nodeById={nodeById} />}
      </aside>
    </div>
  )
}

/* ------------------------------ sub-panels ------------------------------- */

function NodeDetails({
  node,
  edges,
  onEdgeSelect,
}: {
  node: GraphNode
  edges: GraphEdge[]
  onEdgeSelect: (e: GraphEdge) => void
}) {
  const color = NODE_COLORS[node.type] ?? '#6b6a5e'
  const propEntries = Object.entries(node).filter(([k]) => !['id', 'type', 'label', 'gradeColor', 'bg'].includes(k))
  return (
    <div className="hc-fade px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: color }} />
        <Chip tone="gray">{node.type}</Chip>
      </div>
      <h2 className="mt-1.5 font-display text-[22px] font-semibold leading-tight text-ink">{String(node.label ?? node.id)}</h2>
      <p className="mt-0.5 break-all font-mono text-[10.5px] text-ink-faint">{node.id}</p>

      {/* highlighted attributes */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {'grade' in node && node.grade != null && <GradeBadge grade={String(node.grade)} title="Concordance grade" />}
        {'grade' in node && node.grade != null && (
          <Chip tone="gray" className="uppercase">grade {String(node.grade)}</Chip>
        )}
        {'direction' in node && node.direction != null && (
          <Chip tone="blue" title="Direction of agreement between historical claim and modern evidence">
            {String(node.direction)}
          </Chip>
        )}
        {'audit_verdict' in node && node.audit_verdict != null && <VerdictChip verdict={String(node.audit_verdict)} />}
      </div>

      {/* full property table */}
      <dl className="mt-3 divide-y divide-ink/8 overflow-hidden rounded-md border border-ink/10 bg-parchment/60">
        {propEntries.length === 0 && (
          <div className="px-3 py-2">
            <EmptyNote>No additional properties.</EmptyNote>
          </div>
        )}
        {propEntries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[112px_1fr] gap-2 px-3 py-1.5 text-[13px]">
            <dt className="pt-0.5 text-[11px] uppercase tracking-wide text-ink-faint">{titleCaseKey(k)}</dt>
            <dd className="min-w-0 break-words">
              {k === 'grade' && v != null ? (
                <GradeBadge grade={String(v)} />
              ) : k === 'audit_verdict' && v != null ? (
                <VerdictChip verdict={String(v)} />
              ) : k === 'confidence' && typeof v === 'number' ? (
                <ConfidenceBar value={v} />
              ) : k === 'url' && typeof v === 'string' ? (
                <ExternalLink href={v}>{v}</ExternalLink>
              ) : (
                <PropValue value={v} />
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* incident edges */}
      <p className="rule-title mt-4 mb-1.5">Edges ({edges.length})</p>
      <ul className="space-y-1">
        {edges.length === 0 && <EmptyNote>No edges recorded.</EmptyNote>}
        {edges.map((e, i) => {
          const isIncoming = e.target === node.id
          const other = isIncoming ? e.source : e.target
          return (
            <li key={`${e.source}-${e.type}-${e.target}-${i}`}>
              <button
                type="button"
                onClick={() => onEdgeSelect(e)}
                className="flex w-full items-center gap-2 rounded border border-ink/10 bg-parchment/70 px-2.5 py-1.5 text-left text-[12.5px] hover:border-gold/60"
              >
                <span className="text-ink-faint" aria-hidden>{isIncoming ? '\u2190' : '\u2192'}</span>
                <Chip tone="gray">{e.type ?? e.key ?? 'related'}</Chip>
                <span className="truncate text-ink-soft">{other}</span>
                {e.provenance?.quote && (
                  <span aria-hidden className="ml-auto font-display text-[13px] text-gold" title="has provenance quote">
                    &#8220;
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EdgeDetails({ edge, nodeById }: { edge: GraphEdge; nodeById: Map<string, GraphNode> }) {
  const prov = (edge.provenance ?? {}) as Record<string, unknown>
  const conf = typeof prov.confidence === 'number' ? prov.confidence : undefined
  const agent = typeof prov.agent === 'string' ? prov.agent : undefined
  const quote = typeof prov.quote === 'string' ? prov.quote : undefined
  const note = typeof prov.note === 'string' ? prov.note : undefined
  const rest = Object.entries(prov).filter(
    ([k]) => !['quote', 'agent', 'confidence', 'note'].includes(k),
  )
  return (
    <div className="hc-fade border-t border-ink/10 px-4 py-3">
      <p className="rule-title">Provenance</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
        <Chip tone="gray">{String(edge.type ?? edge.key ?? 'related')}</Chip>
        <span className="text-ink-faint">
          {nodeById.get(edge.source)?.label ?? edge.source}
          <span aria-hidden> &#8594; </span>
          {nodeById.get(edge.target)?.label ?? edge.target}
        </span>
      </div>
      {quote && (
        <blockquote className="mt-2.5 border-l-2 border-gold/60 pl-3 font-display text-[15px] italic leading-snug text-ink-soft">
          &#8220;{quote}&#8221;
        </blockquote>
      )}
      <div className="mt-3 space-y-2">
        {agent && (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[11px] uppercase tracking-wide text-ink-faint">Producing agent</span>
            <Chip tone="purple">{agent}</Chip>
          </div>
        )}
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[11px] uppercase tracking-wide text-ink-faint">Confidence</span>
          <ConfidenceBar value={conf} />
        </div>
        {note && <p className="text-[13px] leading-snug text-ink-soft">{note}</p>}
        {rest.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[112px_1fr] gap-2 text-[13px]">
            <span className="pt-0.5 text-[11px] uppercase tracking-wide text-ink-faint">{titleCaseKey(k)}</span>
            <span className="break-words">
              <PropValue value={v} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
