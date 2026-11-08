/* Shared data contracts for Herba Codex.
 * All shapes are deliberately permissive: extra properties are preserved and
 * missing/null sections must render gracefully. */

/* ------------------------------ graph.json ------------------------------ */

export type NodeType =
  | 'Entry'
  | 'Taxon'
  | 'HistoricalName'
  | 'Ailment'
  | 'Evidence'
  | 'Authority'
  | 'Preparation'
  | 'Source'

export interface Provenance {
  quote?: string
  agent?: string
  confidence?: number
  note?: string
  [key: string]: unknown
}

export interface GraphNode {
  id: string
  type: NodeType | string
  label: string
  [key: string]: unknown
}

export interface GraphEdge {
  source: string
  target: string
  key?: string
  type?: string
  provenance?: Provenance
  [key: string]: unknown
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/* ------------------------------ entries.json ---------------------------- */

export interface HistoricalNameX {
  name_text?: string
  context_quote?: string
  part_used?: string | null
  [key: string]: unknown
}

export interface AilmentX {
  name?: string
  context_quote?: string
  polarity?: string
  strength?: number | string | null
  [key: string]: unknown
}

export interface PreparationX {
  kind?: string
  context_quote?: string
  [key: string]: unknown
}

export interface AuthorityCite {
  authority?: string
  context_quote?: string
  [key: string]: unknown
}

export interface Extraction {
  historical_names?: HistoricalNameX[]
  ailments?: AilmentX[]
  preparations?: PreparationX[]
  dosage_notes?: string[]
  cautions?: string[]
  authority_citations?: AuthorityCite[] | string[]
  [key: string]: unknown
}

export interface Candidate {
  scientific_name?: string
  authorship?: string
  family?: string
  source?: string
  confidence?: number | null
  matched_via?: string
  [key: string]: unknown
}

export interface Resolution {
  historical_name?: string
  candidates?: Candidate[]
  selected?: string | null
  confidence?: number | null
  status?: string
  reasoning?: string
  [key: string]: unknown
}

export interface EvidenceItem {
  kind?: string
  title?: string
  identifier?: string
  year?: number | null
  url?: string | null
  relevance_note?: string | null
  [key: string]: unknown
}

export interface TaxonEvidence {
  taxon?: string
  ema_monograph?: EvidenceItem | null
  pubmed?: EvidenceItem[]
  pubchem_cids?: Array<number | string>
  notable_constituents?: string[]
  summary?: string
  [key: string]: unknown
}

export interface Concordance {
  grade?: string
  direction?: string
  rationale?: string
  uncertainty?: string
  caveats?: string[]
  [key: string]: unknown
}

export interface Audit {
  schema_ok?: boolean
  quotes_verified?: string[]
  quotes_failed?: string[]
  issues?: string[]
  verdict?: string
  [key: string]: unknown
}

export interface EntryLocator {
  corpus?: string
  work?: string
  heading?: string
  char_start?: number
  char_end?: number
  char_span_url?: string
  [key: string]: unknown
}

export interface EntryMeta {
  run_id?: string
  models?: Record<string, string>
  processed_at?: string
  [key: string]: unknown
}

export interface Entry {
  id: string
  locator?: EntryLocator
  source_text?: string
  extraction?: Extraction | null
  resolutions?: Resolution[] | null
  evidence?: TaxonEvidence[] | null
  concordance?: Concordance | null
  audit?: Audit | null
  meta?: EntryMeta | null
  [key: string]: unknown
}

/* --------------------------- trace_sample.jsonl -------------------------- */

export type TraceKind =
  | 'run_start'
  | 'agent_run_start'
  | 'llm_call'
  | 'tool_call'
  | 'tool_result'
  | 'agent_final'
  | 'agent_run_end'
  | 'stage_retry'
  | 'entry_done'
  | 'entry_error'
  | 'progress'
  | 'run_end'

export interface TraceEvent {
  ts: string
  run_id?: string
  kind: TraceKind | string
  payload?: Record<string, unknown>
  agent?: string
  entry_id?: string
  stage?: string
  mode?: string
  tool?: string
  [key: string]: unknown
}

export interface LlmUsage {
  prompt_tokens?: number
  completion_tokens?: number
}
