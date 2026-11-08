# Herba Codex

**An agentic pipeline that maps two millennia of herbal medicine texts onto modern
pharmacological evidence — with provenance on every claim.**

Herba Codex mines early-modern herbals (Nicholas Culpeper's *Complete Herbal*, 1653;
Pliny the Elder's *Natural History*, Books XX–XXVII, Bostock/Riley 1855–56 — both
public domain), resolves historical plant names to modern accepted taxonomy via
Kew POWO and GBIF, links each traditional use to modern evidence (EU EMA/HMPC
herbal monographs, PubMed, PubChem), and grades the *concordance* between the
historical claim and the evidence on an A–D/X rubric — never asserting medical
facts, always citing sources.

Five specialist agents (Historian → Botanist → Pharmacologist → Evidence Scorer →
Auditor) run under a deterministic orchestrator with a full JSONL trace of every
LLM call and tool call. Every extracted quote is machine-verified against the
source text before it enters the knowledge graph.

> ⚠️ **Research prototype — not medical advice.** Outputs are computational
> correspondences between historical claims and published evidence, graded with
> explicit uncertainty. Nothing here is a recommendation. Unvalidated findings
> are labelled as such.

*(Full documentation, setup and reproduction instructions are being finalized —
see `docs/`.)*
