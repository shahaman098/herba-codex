# Methodology & validation

## Design principles

1. **Agents propose, the orchestrator disposes.** Every agent output is a
   pydantic-validated structured payload; invalid output triggers one repair
   round, then the entry proceeds with an explicit gap — never a silent
   hallucination.
2. **Quotes are the unit of proof.** Every extracted claim carries a verbatim
   quote; quote integrity is enforced mechanically (Unicode-normalized
   substring check) by the Auditor *and* re-checked by the orchestrator
   before persistence.
3. **Honest uncertainty is a feature.** Name resolution can be `ambiguous`
   or `unresolved`; concordance can be graded `X` (cannot grade honestly).
   Absence of evidence is reported, never padded.
4. **Everything is measured with intervals.** Point estimates without
   bootstrap CIs are theatre; all headline metrics ship with 95% CIs
   (1000 resamples, percentile method, seed fixed for reproducibility).

## Gold set

`eval/gold_set.json`: 30 entries curated across the alphabet where the modern
taxonomic identity is well established (standard references + Kew POWO
verification at annotation time). Each record contains the expected
historical name, the accepted taxon, and Culpeper's recorded uses. The set is
small — we say so — but every pair is verifiable by a third party from the
repo alone.

## Metrics

| Metric | Definition |
|---|---|
| Extraction precision / recall | Historical-name extraction vs gold, fuzzy token-overlap ≥0.6 or substring match |
| Resolution accuracy@1 | Selected accepted taxon equals gold (genus+epithet or fuzzy); also credited if gold appears among tool-verified candidates |
| Confidence calibration | Accuracy within confidence bins [0–0.5, 0.5–0.7, 0.7–0.85, 0.85–1.0] — a well-calibrated resolver is right as often as it claims |
| Quote integrity | Machine-verified share of extracted quotes (agent audit + orchestrator backstop) |
| Concordance coverage | Share of gold entries with a grade (X counts as graded) |
| Status distribution | resolved / ambiguous / unresolved — reported as-is |

## Ablation

`eval/ablation.py` runs a **single-shot baseline**: one unaided LLM call per
gold entry (no tools, no role separation, no audit) asked to extract and
resolve. Compared against the five-agent pipeline on (a) resolution
accuracy@1 and (b) quote fidelity. This isolates what the *architecture*
contributes, not just the model.

## Run-time controls

- **Checkpoints**: one JSON per entry; a run resumes exactly where it stopped.
- **Caches**: name resolutions and taxon evidence are cached across entries
  (early-modern herbals repeat plants); cache hits re-use the audited result.
- **Deterministic parts**: segmentation, KG construction, quote verification,
  metrics and exports are pure Python — reproducible without any LLM.
- **Traces**: every LLM/tool call is JSONL-logged and replayable in the web app.

## Known limitations

- Local 9B model limits extraction depth and occasionally fails schema
  validation (retried, then gap-flagged); the pipeline is model-agnostic and
  a frontier model can be swapped by config only.
- Culpeper is a derivative compiler (Dioscorides, Galen); `authority_citations`
  capture lineage but we do not attempt source-critical attribution of each
  claim to its ultimate origin.
- The EMA index is a curated convenience mapping (~48 substances), not a
  complete scrape; monograph links must be verified at ema.europa.eu.
- The gold set is 30 entries curated by the team; inter-annotator agreement
  was not measured (single team, deadline).
- PubMed relevance is query-driven (taxon + modern-biomedical terms); niche
  uses may be missed → grades may under-report evidence (conservative bias).
