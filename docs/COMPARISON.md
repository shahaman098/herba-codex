# Herba Codex vs. prior art and competing entries

Honest comparison against the closest published work and the strongest indexed
EthnoHack 2026 entry. Sources listed at the bottom.

## 1 · Closest published work

| | **Kew "Plants for Health" LLM pipeline** (Richard-Bollans et al., *Plants, People, Planet*, 2026) | **Honna et al., IEEE 2025** — agentic AI for Indian medicinal plants | **OpenTCM / TCM KGs** (2024–25) | **Herba Codex (this work)** |
|---|---|---|---|---|
| Corpus | Modern open-access literature (CORE) | Curated Indian-plant knowledge base | TCM classics/KBs | **Early-modern Western herbal (Culpeper 1653/1850, 297 entries, exact char offsets)** |
| Task | Relation extraction (plant–condition–effect) | RAG question answering | KG construction over TCM | **Claim extraction → taxonomic resolution → modern-evidence linkage → concordance grading → adversarial audit** |
| Approach | Single LLM, fine-tuned; SciBERT baseline | **Single** RAG agent | GraphRAG / manual-ish KG | **Five specialist agents + deterministic orchestrator**, guided/interactive tool loops |
| Entity grounding | Literature names | KB-native | TCM ontology | **Kew POWO + GBIF tool-verified accepted taxa, calibrated confidence, honest ambiguity** |
| Evidence linkage | — | — | TCM-siloed | **EMA/HMPC monographs + PubMed + PubChem, per taxon, identifiers canonical** |
| Verification/audit | Benchmark vs annotated set | RAG metrics | — | **Mechanical quote verification of every claim + adversarial Auditor + independent primary-source re-audit (93.0% of 2,125 claims)** |
| Uncertainty handling | F1/precision reported | — | — | **Bootstrap CIs, calibration by bin, A–D/X concordance rubric, visible failures** |
| Domain gap they leave | Historical texts out of scope | Not historical, not multi-agent | Chinese medicine only | — |

**The gap we fill:** no published system combines a historical European herbal
corpus, LLM claim extraction with verbatim-quote provenance, tool-verified
modern taxonomy, regulatory/biomedical evidence linkage, concordance grading
with explicit uncertainty, and an adversarial audit gate. The 2026 literature
explicitly calls semantic extraction from legacy texts the bottleneck.

## 2 · Strongest indexed EthnoHack 2026 entry (as of submission morning)

| | **Papyrus to Plasmodium** (Track 1/2 crossover, solo) | **Herba Codex** (Track 🌿) |
|---|---|---|
| Corpus | Ebers Papyrus + Watt 1932 (920 recipes, 1,236 species) | Culpeper 1653/1850 (297 entries, 324 name mentions) |
| Pipeline | Pre-registered statistical test; ML on ChEMBL assays | Five-agent extraction/resolution/linking/grading/audit |
| Outcome | Honest null result (ROC AUC 0.889 but permutation test null) | 293 taxa resolved, 494 evidence docs, concordance graded with CIs |
| Verification | Pre-registration (strong) | Mechanical quote audit + independent re-audit (strong) |
| Deliverables | Devpost page | Public repo, 3-view web app, agent traces, deck, repro scripts, tests |

Respectful note: their pre-registration discipline is genuinely good practice;
we adopt the same spirit via our published rubric, fixed seeds and
third-party-verifiable gold set.

## 3 · What no competitor (published or indexed) demonstrates together

1. Historical Western-herbal corpus with **exact source spans** per claim
2. **Tool-verified** (POWO/GBIF) taxonomic resolution with calibrated confidence
3. Regulatory-grade (EMA/HMPC) + biomedical (PubMed) evidence linkage per taxon
4. **Concordance grading of the agreement** (A–D/X) — not therapeutic claims
5. **Adversarial machine audit** of every quote + orchestrator backstop
6. **Full agent-trace transparency** (every LLM/tool call, replayable)
7. Validation with **bootstrap CIs**, calibration and an ablation
8. **$0, offline, 1-command reproduction** on a laptop

## Sources

- Kew pipeline: Richard-Bollans et al. 2026, doi 10.1002/ppp3.70250
- Honna et al. 2025: ieeexplore.ieee.org/document/11295437
- OpenTCM: arXiv 2504.20118 · GRAYU: Frontiers in Pharmacology 2025 (10.3389/fphar.2025.1727224)
- Bhadra et al. 2025 vision paper: Pharmacological Research 221:108002
- ETHCSTWIN (organizer project): cordis.europa.eu/project/id/101159928
- Papyrus to Plasmodium: devpost.com/software/papyrus-to-plasmodium (indexed entry)
