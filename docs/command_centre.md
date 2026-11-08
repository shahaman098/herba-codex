# Herba Codex — Hackathon Command Centre
EthnoHack 2026 · Track 🌿 Traditional Knowledge · last verified 2026-11-08 08:00 EET
**Deadline: Nov 8, 15:30 EET. Target submit: ≤14:30 EET.**

---

## 1 · Compliance Matrix (Phase 13 audit)

| # | Requirement | Official wording (condensed) | Source | Status | Evidence |
|---|---|---|---|---|---|
| R1 | Registered before Oct 31 | Late registrants ineligible | Devpost | ✅ CONFIRMED (user) | user statement |
| R2 | Team of 2–5 students | Teams of 2–5; students only | Devpost | ✅ CONFIRMED (user registered team) | Devpost team page — **user to verify roster shows all members** |
| R3 | Devpost page: title/track/description/problem/approach/tech/data/results/team/impact | "via Devpost" | Devpost | 🟡 IN PROGRESS | copy drafted at `docs/pitch/devpost.md`; **user must paste into Devpost** |
| R4 | Public GitHub repo w/ code, scripts, notebooks, README, install, dataset refs & licences, repro | "public repository" | Devpost | ✅ CONFIRMED | github.com/shahaman098/herba-codex (public) + `docs/DATA_SOURCES.md` + `pipelines/finalize.sh` |
| R5 | Pitch video ≤10 min | problem→data→method→prototype→results→impact | Devpost | ✅ CONFIRMED | `docs/pitch/herba_codex_pitch.mp4` — 4:11 · **must be uploaded (YouTube/Drive) + linked** |
| R6 | Slide deck ≤10 slides | max 10 | Devpost | ✅ CONFIRMED | `docs/pitch/herba_codex_deck.pptx` — 10 slides (numbers refresh at finalize) |
| R7 | No unvalidated findings as medical facts | Responsible-research rule | Devpost | ✅ CONFIRMED | persistent app banner; A–D/X rubric grades *agreement*; limitations slide + video chapter |
| R8 | Dataset licences & attribution | "respect licences" | Devpost | ✅ CONFIRMED | `docs/DATA_SOURCES.md` (POWO CC-BY, GBIF open, EMA 2011/833/EU, PubMed, PubChem CC0, Gutenberg PD) |
| R9 | Track selection | chosen at registration | Devpost | ✅ CONFIRMED (user) | Track 🌿 |
| R10 | Video visibility (public / not-for-kids if YouTube) | Devpost guidance | Devpost blog | 🟡 USER ACTION | upload checklist below |
| R11 | Live demo / judging availability | Discord CET | Devpost | 🟡 USER ACTION | be reachable on the official Discord after submission |

**No conflicting-information items found. No disqualification risks beyond R2/R10 user actions.**

## 2 · Judge-Criteria Evidence Matrix (Phase 10)

| Criterion (official) | Where judges see it | Strongest evidence |
|---|---|---|
| Scientific relevance | Video 0:00–1:00; deck S2 | comfrey 1653↔2021 case; field's named bottleneck (Kew 2026 paper) |
| Innovation | deck S4–S5; trace viewer | first agentic pipeline for historical Western herbals (literature scan); Auditor-as-gate design |
| Technical implementation | repo + deck S4 + demo | ~200-line auditable runtime; guided+interactive modes; JSONL traces; 1-command repro |
| Data science quality | deck S7–S8; `eval/results.json` | 30-entry gold set; acc@1 + bootstrap CIs; calibration bins; ablation vs single-shot; honest X grades |
| Feasibility | deck S4 + S10 | runs offline on a laptop (Ollama); checkpoints; provider-agnostic config |
| Impact | deck S10 + Devpost impact | reusable infra for ETHCSTWIN's stated aim; remedies surfaced *with warnings* |
| Presentation | video + deck + app | 3-view app w/ live data chips; 4:11 narrated video; consistent manuscript design system |

## 3 · Red-Team Judge Report (Phase 12) — adversarial self-review

**Simulated panel**: pharmacognosy chief judge · historian of Byzantine medicine · Fraunhofer data engineer · informatics professor.

| # | Attack | Severity | Response / fix in place | Residual action |
|---|---|---|---|---|
| A1 | "LLM extraction of historical texts is unreliable; how do we trust any claim?" | HIGH | Every quote mechanically verified against source (Auditor + orchestrator backstop); integrity rate published; failures visible in-app | none — this IS our answer |
| A2 | "30-entry gold set is small; single team, no IAA." | HIGH | Stated as limitation (deck S9, METHODOLOGY.md); CIs communicate the uncertainty; set is third-party-verifiable from the repo | if time: extend to 40 entries post-freeze |
| A3 | "Culpeper is a derivative compiler — is this really traditional knowledge?" | MED | authority_citations capture the Dioscorides/Galen lineage; framed as cross-era mapping, not source attribution | none |
| A4 | "EMA index is curated by you — circular?" | MED | Index stores canonical URLs only; monographs are regulatory documents; explicitly labelled a convenience mapping to be verified at source | none |
| A5 | "Why local 9B model — is quality real?" | MED | Reproducibility argument + model-agnostic design + ablation isolates *architecture* contribution | mention Gemini/OpenAI swap-in in Q&A |
| A6 | "Only ~100 entries of 297 processed — why?" | MED | Honest: compute-bound on one MacBook GPU; checkpoints + shuffled order = unbiased; pipeline demonstrated scales unattended | finalize.sh output states final N |
| A7 | "Thin wrapper around PubChem/POWO APIs?" | LOW | Opposite: APIs are *tools inside agents*; the value is the audited extraction→resolution→evidence→grading chain, provenance schema, and validation | demo trace viewer |
| A8 | "Team eligibility / solo risk" | — | R2 — user confirms registered team | user verifies roster |
| A9 | "Where's Dioscorides itself?" | LOW | Pliny corpus segmented as roadmap evidence; Culpeper quotes authorities | roadmap slide |

**Scorecard vs rubric (self-assessed, honest)**: relevance strong · innovation strong · technical strong · data-quality strong-with-caveat (gold n=30) · feasibility strong · impact moderate-strong · presentation strong. **Biggest residual risk: submission logistics (video upload, Devpost fields) — hence the 60-min buffer.**

## 4 · Execution Tracker (final phase)

| When (EET) | Task | Owner | Status |
|---|---|---|---|
| 08:05 | Video draft v1 (4:11) ✓ | agent | ✅ |
| 08:10 | Command Centre + red-team ✓ | agent | ✅ |
| →11:30 | Pipeline run (shuffled, unbiased) | machine | ✅ FROZEN at 182 entries |
| 11:30 | finalize: re-audit → KG (2458n/3214e) → eval → ablation → deck+web rebuild | agent | ✅ |
| 12:00 | Final deck (real numbers) + web rebuild; commit + push | agent | ✅ |
| 12:15 | Devpost copy pack handed to user (real numbers) | agent → user | ✅ pack ready |
| 12:30–14:30 | User: record/upload video + paste Devpost fields + submit | **user** | ⏳ user actions |
| 14:30 | Submission verified from a clean browser session | user+agent | ⏳ |

## 5 · Source Registry (key references)

- EthnoHack rules/judges: https://ethnohack2026.devpost.com · official site: https://ethnohack-2026.ethcstwin.di.uoa.gr:65000/
- ETHCSTWIN: https://cordis.europa.eu/project/id/101159928
- Closest prior art: Kew LLM pipeline (Plants, People, Planet 2026, doi 10.1002/ppp3.70250); Bhadra 2025 (Pharmacological Research 221:108002); Honna 2025 (IEEE, single-agent RAG, Indian medicinal plants)
- Datasets/tools: Kew POWO (CC-BY 4.0) · GBIF backbone · BHL · Gutenberg #49513 · EMA monographs (2011/833/EU) · NCBI E-utilities · PubChem (CC0)
- Winning-pattern research: Devpost judge interviews; Klaviyo grand-prize retrospective; Google ADK winners; lablab multi-agent case study (full list in research notes)

## 6 · Monitoring

Deadline is fixed (no extension observed as of 08:00 EET). Devpost gallery unpublished → competitor set = 10 indexed entries; Track 1 thinnest lane; strongest indexed rival is solo-entered. No scheduled monitors running (per framework honesty rule); final checks are manual at submission time.
