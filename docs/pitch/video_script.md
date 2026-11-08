# Herba Codex — pitch video script (target ≤10:00)

> Chapters mirror the judging criteria in order. Record with screen capture +
> narrator; demo segments pre-recorded (safety backup), narrated live-style.
> Fill ⟨…⟩ with final numbers from data/processed/summary.json + eval/results.json.

## 0:00–1:00 — Hook: the problem (Scientific relevance)

[NARRATOR over parchment-styled title card, then the comfrey case on screen]

"In 1653, Nicholas Culpeper told England that comfrey 'heals all inward
wounds' and 'knits broken bones together.' Three hundred and seventy years
later, the European Medicines Agency restricts comfrey — its pyrrolizidine
alkaloids are hepatotoxic. Two claims. One plant. Centuries apart.

Ethnopharmacology lives in this gap — and the gap is uncomputed. Historical
herbals are a vast record of how Europe actually used plants as medicine, and
the field's own 2026 literature names the bottleneck: semantic extraction
from legacy texts. Nobody has bridged it end-to-end — from historical text,
through plant identity, to modern evidence — with every step auditable.

We built the bridge. This is Herba Codex."

## 1:00–2:30 — Data (Rigor / rules compliance)

[Screen: data sources table + a highlighted source passage]

"Our corpus: Culpeper's Complete Herbal — 297 remedy entries, public domain
via Project Gutenberg, segmented with exact character offsets so every claim
cites its place in the text.

Identity comes from Kew's Plants of the World Online — CC-BY — and GBIF's
taxonomic backbone. Evidence comes from EU herbal monographs — EMA/HMPC —
plus PubMed and PubChem. Every source, its licence, and how we access it is
documented in the repo. No restricted datasets. No unattributed claims.

And to be crystal clear about the rules: we never present computational
findings as medical facts. Our system grades agreement — not therapies."

## 2:30–4:00 — Method (Innovation)

[Screen: the architecture diagram from docs/ARCHITECTURE.md]

"Herba Codex is an agentic pipeline. Five specialist agents under a
deterministic orchestrator:

The Historian extracts every claim exactly as the text states it — ailments,
preparations, even the older authorities Culpeper cites, like Dioscorides and
Galen. Every claim carries a verbatim quote.

The Botanist resolves historical names to modern accepted taxonomy — using
Kew POWO and GBIF as tools, not vibes — with calibrated confidence, and honest
ambiguity when identity is doubtful.

The Pharmacologist links each resolved plant to modern evidence: EMA
monographs, PubMed, PubChem. Absence of evidence is reported as a finding,
never padded.

The Evidence Scorer grades concordance — A through D, plus X for 'cannot
grade honestly' — always with rationale and caveats.

And the Auditor — an adversarial gate — verifies every quote against the
source text mechanically, checks that grades follow from evidence, and can
fail an entry. Failed entries stay in the dataset, flagged. Hiding failures
would defeat the purpose.

Agents propose; the orchestrator disposes. Everything runs on a local model
by default — fully reproducible, zero API cost — and any frontier model can
be swapped in by changing one config file."

## 4:00–6:30 — Demo (Technical implementation / Presentation)

[Screen: live web app, rehearsed golden path — narrate continuously]

"Three views, one story.

The Graph Explorer: ⟨N⟩ entries, ⟨E⟩ edges, every edge carrying its quote,
agent and confidence. Here's comfrey — the D grade — and yarrow, which
modern evidence supports for its recorded uses.

The Historian's Audit Desk: pick any entry — the source text and every
extracted claim, side by side. The Botanist's candidates with confidence
bars. The evidence with PMIDs you can click. The audit verdict.

And the Agent Trace Viewer — this is the actual log of the run you're
looking at. Every LLM call, every tool call — POWO, GBIF, PubMed — with
latency and token counts. When the Auditor verifies a quote, you watch it
happen. In an age of black-box AI, we show you the whole machine."

## 6:30–8:00 — Results (Data science quality)

[Screen: results table + calibration plot + ablation table]

"Validation, not vibes. We hand-curated a 30-entry gold set spanning the
alphabet, taxon-verified.

Taxonomic resolution: accuracy@1 ⟨X.X⟩ [95% CI ⟨lo⟩–⟨hi⟩]. Confidence is
calibrated: ⟨describe bins⟩.

Quote integrity — machine-verified: ⟨X.X⟩ of all extracted quotes appear
verbatim in the source. This is the number we're proudest of: it's the
difference between a language model and an instrument.

The ablation: a single unaided LLM call resolves ⟨X%⟩ of names with ⟨Y%⟩
quote fidelity; the five-agent pipeline reaches ⟨X'%⟩ and ⟨Y'%⟩. The
architecture is the result."

## 8:00–9:00 — Limitations & responsible research (rules compliance)

"We'll say it ourselves before anyone else does. Culpeper is a 1653 text
derivative of Dioscorides and Galen — our cross-era citations are evidence
of lineage, not endorsement. A 9B local model limits extraction depth; the
pipeline is model-agnostic. The gold set is 30 entries, curated by us — it
will be small. Traditional-use statements are historical records, not
recommendations, and the app says so on every screen. The corpus contains no
restricted Indigenous knowledge, but we state our commitment to CARE
principles for future corpora explicitly."

## 9:00–9:45 — Impact & roadmap

"Herba Codex is infrastructure for exactly what the field says it needs:
FAIR, semi-automatic knowledge construction from legacy texts. Next: more
corpora — Pliny's medical books are already segmented — Dioscorides
translations, multilingual name resolution, community-contributed gold sets,
and publication-grade exports for the ETHCSTWIN platform."

## 9:45–10:00 — Close

"Two millennia of claims, one audited pipeline. Evidence, not verdicts.
Herba Codex — the repo is on screen. Thank you."

[END CARD: repo URL · Herba Codex · Team Herba Codex · EthnoHack 2026]
