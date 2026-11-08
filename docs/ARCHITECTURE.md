# Herba Codex — Architecture

## The one-picture version

```
                    ┌──────────────────────────────────────────────────────┐
                    │  ORCHESTRATOR  (deterministic, checkpointed, traced) │
                    │  fixed five-stage sequence · per-entry resume ·      │
                    │  cross-entry caches · deterministic quote backstop   │
                    └──┬───────────┬──────────────┬───────────┬────────────┘
                       ▼           ▼              ▼           ▼
 ┌──────────┐   ┌───────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────┐ ┌─────────┐
 │  CORPUS  │──▶│ HISTORIAN │▶│ BOTANIST │▶│PHARMACOLOGIST│▶│ SCORER  │▶│ AUDITOR │
 │ Culpeper │   │  📜       │ │  🌿      │ │     ⚗️        │ │  ⚖️     │ │  🛡️     │
 │  (1653)  │   │ extract   │ │ resolve  │ │ link modern  │ │ grade   │ │ verify  │
 └──────────┘   │ claims    │ │ names    │ │ evidence     │ │ A–D/X   │ │ + gate  │
                └───────────┘ └────┬─────┘ └──────┬───────┘ └─────────┘ └────┬────┘
                                   ▼              ▼                          ▼
                             Kew POWO · GBIF   EMA index · PubMed         verify_quote
                             (tools)           · PubChem (tools)          (mechanical)
                                   └──────────────┬─────────────────────────┘
                                                  ▼
                            KNOWLEDGE GRAPH  (provenance on every edge)
                                                  ▼
                     Web app: Graph Explorer · Historian's Audit Desk · Agent Trace Viewer
```

Five specialist agents run under a deterministic orchestrator. The agents are
the only non-deterministic components; the orchestrator owns control flow,
validation, caching, checkpoints and the final integrity gate. Every agent
output is a pydantic-validated structured payload; every derived claim in the
knowledge graph carries its source quote, producing agent and confidence.

## Agent roster (role cards)

| Agent | Model key | Mandate | Tools | Output schema |
|---|---|---|---|---|
| **Historian** 📜 | `LLM_MODEL_HISTORIAN` | Extract medicinal claims *exactly as the text states them* — plant names, ailments (with polarity + strength), preparations, cautions, and the older authorities the text cites (Dioscorides, Galen) — every claim backed by a verbatim ≤25-word quote | — (single schema-guided call) | `Extraction` |
| **Botanist** 🌿 | `LLM_MODEL_BOTANIST` | Resolve historical names to modern accepted taxonomy (APG era) with calibrated confidence; honest ambiguity is a result, not a failure | Kew **POWO** search, **GBIF** species-match | `NameResolution[]` |
| **Pharmacologist** ⚗️ | `LLM_MODEL_PHARMACOLOGIST` | Gather modern evidence per resolved taxon: EU **EMA/HMPC** herbal monographs (curated index), **PubMed** (E-utilities), **PubChem**; absence of evidence is reported, never padded | EMA index, PubMed, PubChem | `ModernEvidence[]` |
| **Evidence Scorer** ⚖️ | `LLM_MODEL_SCORER` | Grade the *concordance* between the historical claim and the modern evidence (A–D/X rubric) — grades the agreement, never the therapy | — | `Concordance` |
| **Auditor** 🛡️ | `LLM_MODEL_AUDITOR` | Adversarial integrity gate: verify every quote against the source, check grade coherence and completeness; verdict pass / pass_with_issues / fail | `verify_quote` (deterministic) | `AuditReport` |

## Execution modes

- **Guided** (default): the orchestrator executes each agent's tool plan
  deterministically (parallel HTTP, cached across entries) and the agent
  reasons over the returned documents. One LLM call per stage — fast enough
  to process the full corpus on a laptop with a local model.
- **Interactive**: each agent drives its own JSON ReAct loop with native
  tool calls (`--interactive`), used for the demo subset and debugging.

Both modes are logged to the same trace format and produce identical schemas.

## Provenance model

Every edge in the knowledge graph carries `provenance = {quote, agent,
confidence, …}`. Quote integrity is enforced twice: the Auditor agent runs a
deterministic `verify_quote` tool, and the orchestrator re-runs the check as
a backstop before persisting (normalized Unicode-aware substring match).
Entries can fail audit — they stay in the dataset, flagged, because hiding
failures would be the opposite of the project's point.

## Concordance rubric (grades the *agreement*, never the therapy)

| Grade | Meaning |
|---|---|
| **A** | strong concordance — EMA well-established use or consistent clinical evidence matches the recorded use |
| **B** | partial — preclinical/pharmacological evidence plausibly supports the recorded use |
| **C** | weak — little or inconclusive modern evidence either way |
| **D** | contradicted or risk-bearing — evidence contradicts the use or flags serious safety concerns |
| **X** | cannot grade honestly — taxon unresolved or evidence absent |

Unvalidated computational findings are never presented as medical facts; all
outputs are labelled research prototypes (see the banner in the web app).

## Reproducibility

- Local-first: the demo runs end-to-end on Ollama (qwen3.5-9B, `think:false`
  for structured output) — no API keys, no cost, no rate limits.
- Provider-agnostic: any OpenAI-compatible endpoint via `.env` (the same
  pipeline can be replayed with a frontier model by config change only).
- Per-entry JSON checkpoints: a crashed run resumes where it stopped.
- Full JSONL trace of every LLM call and tool call → replayable in the web
  app's Agent Trace Viewer.
- Deterministic segmentation and KG build (pure Python, no LLM).
