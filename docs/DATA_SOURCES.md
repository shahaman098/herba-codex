# Data sources & licences

Everything Herba Codex consumes is public-domain or open-licensed. No
restricted datasets were used; no bulk redistribution of licensed databases
occurs (external data is fetched live from public APIs at run time, and the
repo stores only derived, cited outputs plus the public-domain corpus).

| Source | Role | Licence / terms | Access in pipeline |
|---|---|---|---|
| **Nicholas Culpeper, *The Complete Herbal*** (incl. *The English Physician Enlarged*), new edn. 1850 — Project Gutenberg eBook **#49513** | Primary corpus (297 remedy entries) | Public domain (work 1653/1850; Gutenberg TM license permits redistribution) | `data/raw/culpeper_complete_herbal_gutenberg49513.txt`, segmenter at `src/herbacodex/segment.py` |
| **Kew Plants of the World Online (POWO)** | Taxonomic backbone (accepted names, synonymy, families) | CC-BY 4.0 (Kew data) | Live API `powo.science.kew.org/api/v2/search` via Botanist agent |
| **GBIF** species-match / taxonomic backbone | Cross-check of accepted names | Open (CC0/CC-BY per dataset; name matching API free) | Live API `api.gbif.org/v1/species/match` via Botanist agent |
| **EMA/HMPC EU herbal monographs** | Regulatory-grade evidence of established use | Free PDFs; EU reuse decision 2011/833/EU (attribution) | **Curated local index** `data/ema_monographs.json` (~48 substances) with canonical URLs to ema.europa.eu — convenience mapping only, verify at source |
| **PubMed (NCBI E-utilities)** | Biomedical evidence (titles, PMIDs, years, links) | Indexed metadata; NCBI public service | Live API `eutils.ncbi.nlm.nih.gov` via Pharmacologist agent (≤3 articles/taxon, identifiers + titles only) |
| **PubChem (PUG REST)** | Compound identifiers when a text names a constituent | CC0 | Live API (optional, on demand) |

## Attribution

- Culpeper quotations are cited to the Gutenberg edition (work, heading,
  character span) and displayed with the entry's full source text in the web
  app's Audit Desk.
- POWO/GBIF-derived names carry `source: "POWO"|"GBIF"` on each candidate.
- PubMed records carry PMID + URL; nothing beyond titles/years is stored.
- EMA monograph links point to the official monograph pages on ema.europa.eu.

## Traditional-knowledge & responsible-use note

Culpeper's herbal is part of the published early-modern European record
(heavily derivative of Dioscorides and Galen) and contains no restricted or
sacred Indigenous knowledge. Where the pipeline records authorities cited by
the text (e.g. "Dioscorides saith"), it does so as historical evidence, not
as endorsement. The team acknowledges that ethnopharmacological data work
must respect Indigenous data sovereignty (CARE principles) — out of scope
for this corpus, stated explicitly for transparency. Outputs are graded
*concordances between historical claims and published evidence*, explicitly
not medical claims.
