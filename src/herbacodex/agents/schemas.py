"""Shared data contract for the whole system.

These models define what each agent may produce. The knowledge-graph schema,
the web app and the evaluation harness all consume these structures, so a
change here propagates everywhere. Provenance fields (source coordinates,
agent, confidence) are mandatory on every derived claim — that is the core
"Historian-audit" requirement of Herba Codex.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class Locator(BaseModel):
    corpus: str                     # "culpeper" | "pliny"
    work: str                       # full work title + edition
    heading: str = ""               # entry heading in the text
    book: str = ""
    chapter: str = ""
    char_start: int = 0
    char_end: int = 0
    char_span_url: str = ""         # optional deep link to source


class PlantMention(BaseModel):
    name_text: str = Field(description="plant name exactly as written in source")
    context_quote: str = Field(description="<=25-word verbatim quote where it appears")
    part_used: str = ""


class AilmentMention(BaseModel):
    name: str
    context_quote: str
    polarity: str = Field(default="treats", description="treats|prevents|causes|unknown")
    strength: str = Field(default="claimed", description="claimed|denied|uncertain")


class Preparation(BaseModel):
    kind: str                       # decoction, plaster, syrup, wine, powder, ...
    context_quote: str


class Extraction(BaseModel):
    """Historian agent output."""
    historical_names: list[PlantMention]
    ailments: list[AilmentMention]
    preparations: list[Preparation]
    dosage_notes: list[str] = []
    cautions: list[str] = []
    authority_citations: list[str] = Field(
        default=[], description="older authorities the text cites, e.g. 'Dioscorides', 'Galen'")


class NameCandidate(BaseModel):
    scientific_name: str
    authorship: str = ""
    family: str = ""
    source: str                     # "POWO" | "GBIF" | "LLM_knowledge"
    confidence: float = Field(ge=0, le=1)
    matched_via: str = ""


class NameResolution(BaseModel):
    """Botanist agent output — per historical name."""
    historical_name: str
    candidates: list[NameCandidate] = []
    selected: str = ""              # accepted scientific name, "" if unresolved
    confidence: float = Field(default=0.0, ge=0, le=1)
    status: str = Field(default="unresolved",
                        description="resolved|ambiguous|unresolved")
    reasoning: str = ""


class EvidenceDoc(BaseModel):
    kind: str                       # "EMA_monograph" | "PubMed" | "PubChem"
    title: str
    identifier: str                 # EMA monograph name / PMID / CID
    year: str = ""
    url: str = ""
    relevance_note: str = ""


class ModernEvidence(BaseModel):
    """Pharmacologist agent output — per resolved taxon."""
    taxon: str
    ema_monograph: EvidenceDoc | None = None
    pubmed: list[EvidenceDoc] = []
    pubchem_cids: list[str] = []
    notable_constituents: list[str] = []
    summary: str = ""


class Concordance(BaseModel):
    """Evidence scorer output — grade the traditional use against modern evidence."""
    grade: str = Field(description="A|B|C|D|X per the published rubric")
    direction: str = Field(default="none",
                           description="supports|partial|contradicts|none")
    rationale: str = ""
    uncertainty: str = ""
    caveats: list[str] = []


class AuditReport(BaseModel):
    """Auditor agent output — machine-checkable integrity report."""
    schema_ok: bool
    quotes_verified: list[str] = Field(default=[], description="quotes confirmed present in source_text")
    quotes_failed: list[str] = []
    issues: list[str] = []
    verdict: str = Field(default="pass", description="pass|pass_with_issues|fail")


class RemedyEntry(BaseModel):
    """The unit of the knowledge graph: one historical remedy, fully linked."""
    id: str
    locator: Locator
    source_text: str
    extraction: Extraction | None = None
    resolutions: list[NameResolution] = []
    evidence: list[ModernEvidence] = []
    concordance: Concordance | None = None
    audit: AuditReport | None = None
    meta: dict = Field(default_factory=dict,
                       description="run_id, model versions, timestamps")
