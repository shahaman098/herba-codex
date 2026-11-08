# Devpost project page copy — Herba Codex

## Title
Herba Codex — from Culpeper to contemporary evidence, one audited claim at a time

## Track
🌿 Traditional knowledge: NLP/AI on historical & folklore texts

## Problem statement
Europe's early-modern herbals are a vast, under-computed record of traditional
plant medicine — and the field's own 2026 literature names semantic extraction
from legacy texts as the bottleneck (Kew's 2026 LLM pipeline covers modern
literature only; no agentic system exists for historical Western herbals).
The harder problem is trust: LLM extractions of historical claims are easy to
generate and hard to audit, and presenting unvalidated computational findings
as medical facts is exactly what this hackathon's rules — and good science —
forbid. Teams that want to use historical corpora at scale currently have no
end-to-end, provenance-carrying, honestly-validated pipeline to do it with.

## Our solution
**Herba Codex** is an agentic-driven pipeline that:
1. **Reads** Culpeper's *Complete Herbal* (1653/1850, public domain, 297 remedy
   entries) with exact character offsets per entry.
2. **Extracts** every medicinal claim *exactly as the text states it* — plants,
   ailments (with polarity: treats/denies/causes), preparations, cautions, and
   the older authorities the text cites (Dioscorides, Galen) — each backed by a
   verbatim quote.
3. **Resolves** historical names to modern accepted taxonomy using Kew POWO and
   GBIF as tools, with calibrated confidence and honest ambiguity.
4. **Links** each resolved plant to modern evidence: EMA/HMPC herbal monographs,
   PubMed, PubChem — reporting absence of evidence as a finding, never padding.
5. **Grades concordance** between the historical claim and the evidence on an
   A–D/X rubric — grading the *agreement*, never asserting a therapy.
6. **Audits** every entry adversarially: mechanical quote verification plus a
   coherence check; failures stay in the dataset, flagged.

All of it runs under a deterministic orchestrator with a full JSONL trace of
every LLM call and tool call, and ships in a three-view web app: **Graph
Explorer** (provenance-carrying knowledge graph), **Historian's Audit Desk**
(every claim side-by-side with its source text), and **Agent Trace Viewer**
(the multi-agent run, replayed).

## Technology
Python 3.12 · a ~200-line purpose-built agent runtime (JSON ReAct loop with
batched tool calls; guided + interactive modes) · pydantic data contracts ·
Ollama (qwen3.5-9B, local, offline, reproducible) with any OpenAI-compatible
endpoint swappable via config · Kew POWO + GBIF APIs · EMA monograph index ·
NCBI E-utilities · PubChem · networkx knowledge graph · Vite + React +
TypeScript + cytoscape.js web app.

## Data sources (all open; details in docs/DATA_SOURCES.md)
Culpeper 1850 via Project Gutenberg #49513 (public domain) · Kew POWO (CC-BY
4.0) · GBIF (open) · EMA/HMPC monographs (EU reuse 2011/833/EU) · PubMed
E-utilities · PubChem (CC0).

## Results
- ⟨N⟩ entries processed end-to-end; ⟨taxa⟩ taxa resolved (accuracy@1 ⟨x.xx⟩,
  bootstrap 95% CI ⟨lo⟩–⟨hi⟩ on a 30-entry hand-curated gold set).
- Quote integrity: ⟨xx%⟩ of extracted quotes machine-verified as verbatim
  substrings of the source.
- Confidence calibration across bins; status distribution
  resolved/ambiguous/unresolved reported honestly.
- Ablation: single-shot LLM vs five-agent pipeline (agents win on both
  resolution accuracy and quote fidelity — see eval/ablation.json).
- Headline cases: comfrey graded **D** (pyrrolizidine-alkaloid risk vs
  Culpeper's wound claims); yarrow graded **A/B** (EMA monograph concordant
  with recorded uses); ⟨X⟩ entries honestly graded **X** (identity unresolved).

## Impact
Herba Codex is reusable infrastructure for the field's stated priority:
FAIR, semi-automatic knowledge construction from legacy texts, with audit as
a first-class feature. It extends directly to other corpora (Pliny's medical
books, Dioscorides translations), other languages, and community gold sets —
and its provenance model (quote + agent + confidence on every edge) is a
template for responsible AI on traditional-knowledge data. For researchers:
a computable bridge from historical claims to modern evidence. For the
public: a demonstration that historical remedies can be surfaced *with their
warnings*, not despite them.

## Responsible-research statement
We do not present computational findings as medical facts; the app carries a
persistent disclaimer and every concordance grade includes uncertainty and
caveats. The corpus is public-domain and contains no restricted Indigenous
knowledge; we state our commitment to CARE principles for future corpora.
All dataset licences are documented; all external data is attributed at the
point of use.

## Team
Team Herba Codex — ⟨members⟩.
