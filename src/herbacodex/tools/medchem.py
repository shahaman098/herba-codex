"""Modern-evidence tools: PubMed (E-utilities) + PubChem (PUG REST) + EMA index.

PubMed/PubChem are public (CC0 for PubChem records; PubMed abstracts are
indexed metadata — we store identifiers, titles and URLs with attribution,
not full text). The EMA index is a small curated local table of EU herbal
monographs with canonical URLs so the Pharmacologist agent can attach
regulatory evidence without scraping EMA at run time.
"""

from __future__ import annotations

import json
import os
from urllib.parse import quote

import httpx

from ..runtime.agent import Tool

_UA = {"User-Agent": "HerbaCodex/0.1 (hackathon research; contact: team@herbacodex.example)"}


def pubmed_search(args: dict) -> dict:
    """args: {query: str, retmax?: int} -> {articles: [{pmid, title, year, url}]}"""
    q = (args.get("query") or "").strip()
    retmax = min(int(args.get("retmax", 3)), 5)
    if not q:
        return {"error": "query required"}
    with httpx.Client(timeout=20, headers=_UA) as c:
        r = c.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                  params={"db": "pubmed", "term": q, "retmax": retmax, "sort": "relevance", "retmode": "json"})
        r.raise_for_status()
        ids = r.json().get("esearchresult", {}).get("idlist", [])
        if not ids:
            return {"articles": []}
        r2 = c.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
                   params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"})
        r2.raise_for_status()
        summ = r2.json().get("result", {})
    arts = []
    for pmid in ids:
        s = summ.get(pmid)
        if not isinstance(s, dict):
            continue
        arts.append({
            "pmid": pmid,
            "title": s.get("title", ""),
            "year": (s.get("pubdate", "") or "")[:4],
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        })
    return {"articles": arts}


def pubchem_lookup(args: dict) -> dict:
    """args: {name: str} -> {cids: [...]} resolve a compound/plant-common name to PubChem CIDs."""
    name = (args.get("name") or "").strip()
    if not name:
        return {"error": "name required"}
    with httpx.Client(timeout=20, headers=_UA) as c:
        r = c.get(f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(name)}/cids/JSON")
        if r.status_code != 200:
            return {"cids": [], "note": "no match"}
        cids = r.json().get("IdentifierList", {}).get("CID", [])[:5]
    return {"cids": [str(x) for x in cids]}


def ema_monograph_lookup(args: dict) -> dict:
    """args: {substance: str} -> {monograph: {substance, url, title} | null}

    Looks up the curated EMA herbal-monograph index (data/ema_monographs.json).
    """
    substance = (args.get("substance") or "").strip().lower()
    idx_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "ema_monographs.json")
    idx_path = os.path.abspath(idx_path)
    if not os.path.exists(idx_path):
        return {"monograph": None, "note": "index missing"}
    idx = json.load(open(idx_path, encoding="utf-8"))
    for key, entry in idx.items():
        if key.startswith("_") or not isinstance(entry, dict):
            continue
        if key in substance or substance in key or any(a in substance for a in entry.get("aliases", [])):
            return {"monograph": entry}
    return {"monograph": None}


MEDCHEM_TOOLS = {
    "pubmed_search": Tool(
        name="pubmed_search",
        description="Search PubMed for recent/relevant articles; returns pmid/title/year/url.",
        args_schema={"type": "object", "properties": {"query": {"type": "string"}, "retmax": {"type": "integer"}}, "required": ["query"]},
        fn=pubmed_search,
    ),
    "pubchem_lookup": Tool(
        name="pubchem_lookup",
        description="Resolve a compound name to PubChem CIDs.",
        args_schema={"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
        fn=pubchem_lookup,
    ),
    "ema_monograph_lookup": Tool(
        name="ema_monograph_lookup",
        description="Look up an EU (EMA/HMPC) herbal monograph by substance name in the curated index.",
        args_schema={"type": "object", "properties": {"substance": {"type": "string"}}, "required": ["substance"]},
        fn=ema_monograph_lookup,
    ),
}
