/* Data loading for Herba Codex.
 *
 * Strategy: try to fetch the pipeline-produced files at /data/<file> first
 * (works when the app is served behind the pipeline's data dir, or in a
 * production build with public/data populated). If that fails — including the
 * dev-server SPA fallback that returns HTML — fall back to the bundled mock
 * data in src/mock/, which has exactly the same shape. The UI therefore never
 * white-screens on missing data.
 */
import type { Entry, GraphData, TraceEvent } from './types'
import graphMockJson from './mock/graph.json'
import entriesMockJson from './mock/entries.json'
import traceRaw from './mock/trace_sample.jsonl?raw'

export type DataSource = 'remote' | 'bundled'

export interface LoadResult<T> {
  data: T
  source: DataSource
  error?: string
}

export interface TraceLoadResult extends LoadResult<TraceEvent[]> {
  skipped: number
}

export function dataUrl(file: string): string {
  return `/data/${file}`
}

const mockGraph = graphMockJson as unknown as GraphData
const mockEntries = entriesMockJson as unknown as Entry[]

export function parseTraceJsonl(text: string): { events: TraceEvent[]; skipped: number } {
  const events: TraceEvent[] = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (!s) continue
    try {
      events.push(JSON.parse(s) as TraceEvent)
    } catch {
      skipped += 1
    }
  }
  return { events, skipped }
}

const mockTraceParsed = parseTraceJsonl(traceRaw)

/** Pre-parsed bundled trace, reused as the fallback payload. */
export function bundledTrace(): { events: TraceEvent[]; skipped: number } {
  return mockTraceParsed
}

function looksLikeGraph(x: unknown): boolean {
  return !!x && typeof x === 'object' && Array.isArray((x as GraphData).nodes)
}

function looksLikeEntries(x: unknown): boolean {
  return Array.isArray(x)
}

async function loadJson<T>(
  file: string,
  fallback: T,
  validate: (x: unknown) => boolean,
): Promise<LoadResult<T>> {
  try {
    const res = await fetch(dataUrl(file), { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${dataUrl(file)}`)
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      throw new Error(`${dataUrl(file)} not found (dev-server SPA fallback)`)
    }
    const parsed: unknown = await res.json()
    if (!validate(parsed)) throw new Error(`unexpected shape in ${dataUrl(file)}`)
    return { data: parsed as T, source: 'remote' }
  } catch (err) {
    return {
      data: fallback,
      source: 'bundled',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function loadText(file: string, fallback: string): Promise<{ text: string; source: DataSource; error?: string }> {
  try {
    const res = await fetch(dataUrl(file))
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${dataUrl(file)}`)
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      throw new Error(`${dataUrl(file)} not found (dev-server SPA fallback)`)
    }
    return { text: await res.text(), source: 'remote' }
  } catch (err) {
    return {
      text: fallback,
      source: 'bundled',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function loadGraph(): Promise<LoadResult<GraphData>> {
  return loadJson<GraphData>('graph.json', mockGraph, looksLikeGraph)
}

export async function loadEntries(): Promise<LoadResult<Entry[]>> {
  return loadJson<Entry[]>('entries.json', mockEntries, looksLikeEntries)
}

export async function loadTrace(): Promise<TraceLoadResult> {
  const { text, source, error } = await loadText('trace_sample.jsonl', traceRaw)
  const { events, skipped } = parseTraceJsonl(text)
  return { data: events, source, skipped, error }
}
