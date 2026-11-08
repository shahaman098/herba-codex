# Research notes — the dossier behind Herba Codex

Condensed from the pre-hackathon intelligence pass (Nov 8, 2026). Every claim
below carries its source. This is the "why we built this" record.

## 1 · The scientific gap (why this project exists)

- **Kew's 2026 LLM pipeline** (Richard-Bollans et al., *Plants, People, Planet*,
  doi 10.1002/ppp3.70250) mines modern open-access literature only; historical
  texts explicitly out of scope. Reports F1 0.63 raw / precision 0.85 after
  fine-tuning — modern literature is the *easy* case.
- **Bhadra et al. 2025** (*Pharmacological Research* 221:108002) frames the
  vision (GenAI + domain KG for ethnopharmacology) but ships no extraction
  system.
- **TCM dominates** computational work (OpenTCM GraphRAG, arXiv 2504.20118;
  Xiang et al. 2025 proposes multi-agent + KG for TCM classics as a *prospect*);
  Ayurveda has GRAYU. Western historical herbals are explicitly under-digitized.
- **Agentic AI in this domain: essentially absent.** Closest is Honna et al.
  (IEEE, Nov 2025) — a *single* RAG agent for Indian plants (retrieval QA, not
  extraction, not historical, not multi-agent).
- **ETHCSTWIN** — the organizer's own Horizon Europe project (101159928, NKUA +
  Fraunhofer SCAI + partners) — funds extraction from "manuscripts, folklore
  texts, ethnobotanical studies" and an ETHCSTWIN platform + relational DB.
  *The organizers' stated need is this pipeline.*

**Gap:** no published system combines a historical Western herbal corpus, LLM
claim extraction with verbatim-quote provenance, tool-verified modern taxonomy,
modern-evidence linkage, concordance grading, and adversarial audit.

## 2 · Judge intelligence (how the design maps to the panel)

| Judge | Expertise | What they reward | Where Herba Codex answers |
|---|---|---|---|
| N. Aligiannis (NKUA, chief judge) | Pharmacognosy, Greek flora | Correct botanical grounding; **red line: no unvalidated findings as medical facts** | POWO/GBIF grounding; A–D/X rubric grades agreement, never therapy; disclaimer everywhere |
| P. Bouras-Vallianatos (NKUA) | History of (premodern/Byzantine) medicine | Source provenance to page; name disambiguation across eras; no AI-hallucinated history | Verbatim quotes + char offsets; authority citations (Dioscorides/Galen lineage); audit desk shows quote-vs-source |
| A. Cheilari (NKUA) | Pharmacognosy, NMR/LC-MS | Analytical realism; history-as-testable-hypothesis (her kykeon paper) | Evidence linkage with identifiers; honesty about what is NOT supported |
| M. C. Ay (Fraunhofer SCAI) | Semantic data harmonization, KG schemas | Ontologies, provenance layers, **will inspect the GitHub** | Typed KG schema; provenance on every edge; eval code + tests in repo |
| D. Gunopulos (NKUA Informatics) | Data mining / ML | Validation methodology, scalability | Gold set + bootstrap CIs + calibration + ablation; checkpointed scalable runs |

## 3 · Competitive landscape (indexed entries, submission morning)

10 projects indexed from 387 registrants. Track 1 thinnest (one serious entry,
solo → eligibility risk). Track 2 most crowded. Strongest indexed: Papyrus to
Plasmodium (see docs/COMPARISON.md). No indexed entry combines historical
provenance + ontology-grade entity linking + validated grading.

## 4 · Dataset decisions (licence-first)

- **Culpeper 1653/1850** via Gutenberg #49513 (public domain) — chosen over
  Dioscorides translations because: (a) English early-modern text suits LLM
  extraction with auditable quotes; (b) clean legal status; (c) Culpeper cites
  Dioscorides/Galen, preserving the cross-era signal. Dioscorides' Goodyer
  translation is PD but lives on hosts unreachable from the build environment
  (archive.org blocked); Pliny (Bostock/Riley 1855, Perseus) is segmented as
  the roadmap corpus.
- **Kew POWO (CC-BY 4.0)** as taxonomic backbone (API), **GBIF** cross-check —
  not Kew MPNS (bulk licensing restrictions).
- **EMA/HMPC monographs** via curated index with canonical URLs (EU reuse
  decision 2011/833/EU) — no scraping; mapping verified at source.
- **PubMed E-utilities / PubChem CC0** — identifiers + titles only, ≤3 per taxon.

## 5 · Methodology decisions worth defending

1. **Quotes as the unit of proof** — every claim carries a verbatim quote,
   mechanically verified twice (Auditor agent + orchestrator backstop), then a
   THIRD time by the independent audit against the raw file (93.0% of 2,125).
2. **Agents propose, orchestrator disposes** — pydantic-validated payloads,
   one repair round, then explicit gaps; no silent hallucinations.
3. **Guided vs interactive execution** — same schemas, same traces; guided mode
   makes the full corpus feasible on a laptop; interactive mode available for
   demos/debugging.
4. **Honest uncertainty** — ambiguous/unresolved statuses, X grades, failures
   kept in the dataset; over-confidence in the 0.85–1.0 confidence bin
   (accuracy 0.81) reported as found.
5. **Known limitations, stated first** — n=22 scored gold pairs (single-team);
   derivative nature of Culpeper; curated EMA index; conservative PubMed
   recall; local 9B model depth. (docs/METHODOLOGY.md)

## 6 · Primary source register

| Source | URL |
|---|---|
| EthnoHack 2026 (rules, judges, tracks) | https://ethnohack2026.devpost.com |
| ETHCSTWIN official site | https://ethnohack-2026.ethcstwin.di.uoa.gr:65000/ |
| ETHCSTWIN (Cordis) | https://cordis.europa.eu/project/id/101159928 |
| Kew LLM pipeline (closest prior art) | https://nph.onlinelibrary.wiley.com/doi/full/10.1002/ppp3.70250 |
| Bhadra 2025 | https://www.sciencedirect.com/science/article/pii/S104366182500427X |
| Honna 2025 (agentic, single-agent) | https://ieeexplore.ieee.org/document/11295437 |
| OpenTCM | https://arxiv.org/abs/2504.20118 |
| GRAYU Ayurveda KG | https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2025.1727224/full |
| Kew POWO | https://powo.science.kew.org |
| GBIF species match | https://api.gbif.org/v1/species/match |
| EMA herbal monographs | https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products/european-union-monographs-list-entries |
| Culpeper corpus | https://www.gutenberg.org/ebooks/49513 |
| Devpost judge advice | https://info.devpost.com/blog/hackathon-judging-tips |
| Google ADK winners (agentic presentation patterns) | https://cloud.google.com/blog/products/ai-machine-learning/adk-hackathon-results-winners-and-highlights |
