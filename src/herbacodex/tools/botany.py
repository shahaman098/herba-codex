"""Botanical name tools: Kew POWO search + GBIF name matching.

POWO (Plants of the World Online, Royal Botanic Gardens Kew) is CC-BY 4.0 and
provides the accepted-name backbone; GBIF's species-match API cross-checks.
Both are used by the Botanist agent to resolve historical names to modern
accepted taxonomy.
"""

from __future__ import annotations

import httpx

from ..runtime.agent import Tool

_UA = {"User-Agent": "HerbaCodex/0.1 (hackathon research; contact: team@herbacodex.example)"}


def powo_search(args: dict) -> dict:
    """args: {query: str, limit?: int} -> {results: [{name, author, family, accepted}]}"""
    q = (args.get("query") or "").strip()
    limit = int(args.get("limit", 5))
    if not q:
        return {"error": "query required"}
    with httpx.Client(timeout=15, headers=_UA) as c:
        r = c.get("https://powo.science.kew.org/api/v2/search", params={"q": q, "perPage": min(limit, 10)})
        r.raise_for_status()
        data = r.json()
    out = []
    for res in data.get("results", [])[:limit]:
        out.append({
            "name": res.get("name"),
            "author": res.get("authors", ""),
            "family": res.get("family", ""),
            "accepted": res.get("accepted", False),
            "synonym_of": res.get("synonymOf", {}).get("name", "") if isinstance(res.get("synonymOf"), dict) else "",
            "url": f"https://powo.science.kew.org/taxon/{res.get('taxonid', '')}",
        })
    return {"results": out, "total": data.get("totalResults", len(out))}


def gbif_match(args: dict) -> dict:
    """args: {name: str} -> {match_type, confidence, accepted_name, accepted_key, family, status}"""
    name = (args.get("name") or "").strip()
    if not name:
        return {"error": "name required"}
    with httpx.Client(timeout=15, headers=_UA) as c:
        r = c.get("https://api.gbif.org/v1/species/match", params={"name": name, "strict": "false", "verbose": "false"})
        r.raise_for_status()
        d = r.json()
    return {
        "match_type": d.get("matchType"),
        "confidence": d.get("confidence"),
        "accepted_name": (d.get("acceptedUsage") or {}).get("scientificName") if isinstance(d.get("acceptedUsage"), dict) else d.get("scientificName"),
        "accepted_key": (d.get("acceptedUsage") or {}).get("key") if isinstance(d.get("acceptedUsage"), dict) else d.get("usageKey"),
        "family": d.get("family", ""),
        "status": d.get("status", ""),
        "note": d.get("note", ""),
    }


BOTANY_TOOLS = {
    "powo_search": Tool(
        name="powo_search",
        description="Search Kew Plants of the World Online for scientific plant names (fuzzy).",
        args_schema={"type": "object", "properties": {"query": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["query"]},
        fn=powo_search,
    ),
    "gbif_match": Tool(
        name="gbif_match",
        description="Match a scientific or common-ish name against the GBIF taxonomic backbone.",
        args_schema={"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
        fn=gbif_match,
    ),
}
