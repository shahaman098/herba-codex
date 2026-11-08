# Devpost submission pack — paste-ready fields

**Submit at https://ethnohack2026.devpost.com — target ≤14:30 EET (deadline 15:30).**

## Project title
```
Herba Codex — from Culpeper to contemporary evidence, one audited claim at a time
```

## Track
🌿 Traditional knowledge

## Project statement — split by Devpost field

**Problem statement**
```
Europe's early-modern herbals are a vast, under-computed record of traditional plant
medicine, and the field's own 2026 literature names semantic extraction from legacy
texts as the bottleneck (Kew's 2026 LLM pipeline covers modern literature only; no
agentic system exists for historical Western herbals). The harder problem is trust:
LLM extractions of historical claims are easy to generate and hard to audit — and
presenting unvalidated computational findings as medical facts is exactly what good
science (and this hackathon's rules) forbid.
```

**Solution / approach**
```
Herba Codex is an agentic-driven pipeline that reads Culpeper's Complete Herbal
(1653/1850, public domain, 297 remedy entries), extracts every medicinal claim
exactly as the text states it — each backed by a verbatim quote — resolves
historical names to modern accepted taxonomy using Kew POWO and GBIF as tools,
links each resolved plant to modern evidence (EMA/HMPC monographs, PubMed, PubChem),
and grades the CONCORDANCE between the historical claim and the evidence on an A–D/X
rubric — grading the agreement, never asserting a therapy. An adversarial Auditor
agent machine-verifies every quote and can fail an entry; failed entries stay in the
dataset, flagged. Five specialist agents (Historian → Botanist → Pharmacologist →
Evidence Scorer → Auditor) run under a deterministic orchestrator with a full JSONL
trace of every LLM call and tool call.
```

**Technologies** *(comma list)*
```
Python 3.12, purpose-built agent runtime (JSON ReAct, guided+interactive modes),
pydantic, Ollama (qwen3.5-9B, local/reproducible; any OpenAI-compatible endpoint via
config), Kew POWO API (CC-BY 4.0), GBIF API, EMA/HMPC monograph index, NCBI
E-utilities (PubMed), PubChem (CC0), networkx knowledge graph, JSONL provenance
traces, Vite + React + TypeScript + Tailwind + cytoscape.js web app, ffmpeg video
pipeline, pytest-free deterministic eval harness (bootstrap CIs), GitHub Actions-free
repro (1 command).
```

**Data sources**
```
Culpeper, The Complete Herbal (1653/1850) — Project Gutenberg eBook #49513 (public
domain) · Kew Plants of the World Online (CC-BY 4.0) · GBIF taxonomic backbone (open)
· EMA/HMPC EU herbal monographs (EU reuse decision 2011/833/EU, canonical links) ·
PubMed via NCBI E-utilities · PubChem (CC0). Full licences & attribution:
docs/DATA_SOURCES.md in the repo.
```

**Results** *(fill ⟨⟩ from data/processed/summary.json + eval/results.json at finalize — agent will paste final values here before you submit)*
```
- ⟨N⟩ entries processed end-to-end; ⟨T⟩ taxa resolved (accuracy@1 ⟨x.xx⟩, bootstrap
  95% CI ⟨lo⟩–⟨hi⟩ on a 30-entry hand-curated gold set).
- Quote integrity: ⟨xx.x⟩% of extracted quotes machine-verified as verbatim
  substrings of the source (the Auditor + a deterministic backstop).
- Honest uncertainty: ⟨amb⟩ ambiguous and ⟨unres⟩ unresolved name resolutions kept
  visible; concordance grades include uncertainty and caveats on every entry.
- Ablation: single unaided LLM call vs the five-agent pipeline on the same gold set
  and model — agents win on resolution accuracy AND quote fidelity
  (eval/ablation.json).
- Headline cases: comfrey graded D (pyrrolizidine-alkaloid risk vs Culpeper's wound
  claims); yarrow graded A/B (EMA monograph concordant with recorded uses).
```

**Impact**
```
Herba Codex is reusable infrastructure for the field's stated priority: FAIR,
semi-automatic knowledge construction from legacy texts with audit as a first-class
feature. It extends directly to other corpora (Pliny's medical books are already
segmented), other languages, and community gold sets, and its provenance model
(quote + agent + confidence on every edge) is a template for responsible AI on
traditional-knowledge data. For researchers: a computable, auditable bridge from
historical claims to modern evidence. For the public: historical remedies surfaced
with their warnings — not despite them.
```

## Links to attach
- **GitHub repo:** https://github.com/shahaman098/herba-codex (public ✓)
- **Video (you are producing this):** the narration script with per-second structure is at
  `docs/pitch/video_script.md`; a TTS-narrated reference cut (4:11, shows the flow + all views)
  sits at `docs/pitch/herba_codex_pitch.mp4` if you want a base to re-narrate. Upload your final
  video to YouTube — **Public** + **"Not made for kids"** — and paste the URL.
- **Slide deck:** export `docs/pitch/herba_codex_deck.pptx` to PDF if the form asks; also keep the .pptx linkable in the repo (`docs/pitch/`).
- **Try it / demo:** the web app runs locally in 1 command — put this in the "Try it" field:
```
git clone https://github.com/shahaman098/herba-codex && cd herba-codex && uv sync &&
cp .env.example .env && uv run herba all --max 20 && cd web && npm install && npm run dev
```

## About-the-team field
Team Herba Codex — add all registered members.

## Submission QA checklist (before pressing Submit)
1. Track = Traditional knowledge.
2. All team members listed and have accepted Devpost invites.
3. Repo public + README renders + LICENSE present.
4. Video ≤10 min ✓ (4:11), public, plays in incognito.
5. No unvalidated medical claims anywhere on the page (the wording above is pre-audited).
6. After submitting: view the entry logged-out and click every link.
