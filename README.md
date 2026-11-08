# Herba Codex 🌿📜

**An agentic pipeline that maps two millennia of herbal medicine onto modern
pharmacological evidence — with provenance on every claim.**

Herba Codex reads early-modern herbals (Nicholas Culpeper's *Complete Herbal*,
1653/1850 — 297 remedy entries), extracts every medicinal claim *exactly as the
text states it* with verbatim quotes, resolves historical plant names to modern
accepted taxonomy via **Kew POWO** and **GBIF**, links each traditional use to
modern evidence (**EMA/HMPC monographs**, **PubMed**, **PubChem**), and grades
the **concordance** between the historical claim and the evidence on an A–D/X
rubric — grading the *agreement*, never asserting that a plant cures anything.

Five specialist agents — **Historian 📜 → Botanist 🌿 → Pharmacologist ⚗️ →
Evidence Scorer ⚖️ → Auditor 🛡️** — run under a deterministic orchestrator with
a full JSONL trace. Every extracted quote is machine-verified against the
source before it enters the knowledge graph. The web app ships three views: an
interactive **graph explorer**, a **Historian's Audit Desk** (every claim
side-by-side with its source text), and an **Agent Trace Viewer** that replays
the multi-agent run — you can see *why* the system said what it said.

> ⚠️ **Research prototype — not medical advice.** Outputs are computational
> correspondences between historical claims and published evidence, graded
> with explicit uncertainty. Unvalidated findings are labelled as such.

---

## Why this exists

Early-modern herbals are a vast, under-computed record of how Europe actually
used plants as medicine — and the field's own literature calls semantic
extraction from these legacy texts the bottleneck (Kew's 2026 LLM pipeline
handles modern literature only; no agentic system exists for historical
Western herbals). Meanwhile, some of history's remedies are *warnings*:
Culpeper praises comfrey — now restricted for its pyrrolizidine alkaloids —
and the pipeline's very first run graded it **D** on its own.

Herba Codex is built for interdisciplinary audit: a historian can check every
quote against the source, a pharmacognosist can check every taxon and
constituent, a data scientist can check every metric — all from the same
artifacts.

## Architecture

```
ORCHESTRATOR (deterministic, checkpointed, traced)
   ├── Historian        extract claims verbatim (names, ailments, preparations, authorities)
   ├── Botanist         historical names → accepted taxa (Kew POWO + GBIF tools)
   ├── Pharmacologist   taxa → modern evidence (EMA index + PubMed + PubChem tools)
   ├── Evidence Scorer  concordance grade A–D/X + uncertainty
   └── Auditor          adversarial gate: verify_quote + grade coherence
        ↓
KNOWLEDGE GRAPH (provenance on every edge)  →  Web app (3 views)
```

Full details, execution modes (guided / interactive) and the provenance model:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quickstart

```bash
# 1. Prereqs: Python 3.12+ (uv), Node 18+, Ollama
uv sync
cp .env.example .env          # defaults: Ollama + qwen3.5:9b

# 2. Ollama (local models — the demo runs fully offline)
ollama pull qwen3.5:9b
ollama serve &                # if not already running

# 3. Run the whole pipeline (segment → 5-agent run → knowledge graph)
uv run herba all              # add --max 20 for a quick run

# 4. Web app
cd web && npm install && npm run dev   # or: npm run build
```

To use a frontier model instead of local Ollama, change only `.env` (e.g.
`LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`,
`LLM_API_KEY=...`, `LLM_MODEL=gemini-2.0-flash`) and re-run — no code changes.

## Repository layout

```
src/herbacodex/
  runtime/    agent.py (JSON ReAct loop) · llm.py (provider-agnostic transport) · trace.py (JSONL)
  agents/     roster.py (role cards) · schemas.py (the shared data contract)
  tools/      botany.py (POWO, GBIF) · medchem.py (EMA index, PubMed, PubChem)
  kg/         build.py (provenance-carrying graph + exports)
  segment.py  Culpeper segmenter (exact char offsets)
  orchestrator.py  five-stage pipeline: guided + interactive modes, caches, backstop
pipelines/    runnable stage scripts
eval/         gold_set.json (30 hand-curated entries) · evaluate.py (P/R, acc@1, calibration, bootstrap CIs) · ablation.py (single-shot vs agents)
web/          Vite+React+TS app: Graph Explorer · Historian's Audit Desk · Agent Trace Viewer
data/         raw corpus (+licences) · processed entries/graph/summary · ema_monographs.json
trace/        JSONL agent traces (replayable)
docs/         ARCHITECTURE.md · DATA_SOURCES.md · METHODOLOGY.md
```

## Validation (summary)

- **Gold set**: 30 hand-curated entries spanning the alphabet, taxon-verified.
- **Metrics with bootstrap 95% CIs**: extraction precision/recall; resolution
  accuracy@1; confidence calibration (binned); quote-integrity rate;
  concordance coverage.
- **Ablation**: single-shot LLM (no tools, no roles, no audit) vs the
  five-agent pipeline — see `eval/ablation.json`.
- Full methodology: [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Numbers
  reported for the demo run: see `eval/results.json` + `data/processed/summary.json`.

## Data & licences

Public-domain corpus (Gutenberg #49513); live APIs used under their open
terms (Kew POWO CC-BY 4.0, GBIF open, NCBI E-utilities, PubChem CC0); EMA
monograph links under EU reuse decision 2011/833/EU. Details and the
traditional-knowledge note: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Team

Team Herba Codex — EthnoHack 2026, Track 🌿 Traditional Knowledge.

## Licence

MIT (code). Corpus and data per the table above.
