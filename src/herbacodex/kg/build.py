"""Knowledge-graph construction and export.

Every edge carries provenance: the entry it came from, the supporting quote,
the agent that produced it, and a confidence value. Node types: Entry,
HistoricalName, Taxon, Ailment, Preparation, Authority, Evidence.

Exports:
- data/processed/graph.json      → nodes/edges for the web explorer (cytoscape)
- data/processed/entries.json    → full audit view records
- data/processed/summary.json    → run statistics for slides/validation
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import networkx as nx

from ..agents.schemas import RemedyEntry

PROCESSED = Path("data/processed")


def _norm_ailment(name: str) -> str:
    return " ".join((name or "").lower().strip().split())


def build_graph(entries: list[dict]) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for e in entries:
        eid = e["id"]
        loc = e["locator"]
        conc = e.get("concordance") or {}
        g.add_node(eid, type="Entry", label=loc.get("heading") or eid,
                   corpus=loc.get("corpus"), grade=conc.get("grade", ""),
                   direction=conc.get("direction", ""), confidence=conc.get("confidence", 0))
        g.add_node(loc.get("corpus", "corpus"), type="Source", label=loc.get("corpus", "").title())
        g.add_edge(eid, loc.get("corpus", "corpus"), type="recorded_in",
                   provenance={"work": loc.get("work", ""), "chars": [loc.get("char_start"), loc.get("char_end")]})

        ext = e.get("extraction") or {}
        for p in ext.get("historical_names", []):
            hn = f"name::{p['name_text'].lower()}"
            g.add_node(hn, type="HistoricalName", label=p["name_text"])
            g.add_edge(eid, hn, type="mentions", provenance={"quote": p.get("context_quote", ""), "agent": "Historian"})
        for a in ext.get("ailments", []):
            an = f"ailment::{_norm_ailment(a['name'])}"
            g.add_node(an, type="Ailment", label=a["name"])
            g.add_edge(eid, an, type=f"claims_{a.get('polarity','treats')}",
                       provenance={"quote": a.get("context_quote", ""), "strength": a.get("strength", ""),
                                   "agent": "Historian"})
        for p in ext.get("preparations", []):
            pn = f"prep::{p['kind'].lower()}"
            g.add_node(pn, type="Preparation", label=p["kind"])
            g.add_edge(eid, pn, type="prepared_as", provenance={"quote": p.get("context_quote", "")})
        for au in ext.get("authority_citations", []):
            aun = f"authority::{au.lower()}"
            g.add_node(aun, type="Authority", label=au)
            g.add_edge(eid, aun, type="cites", provenance={"agent": "Historian"})

        for r in e.get("resolutions", []):
            if not r.get("selected"):
                continue
            tn = f"taxon::{r['selected']}"
            fam = (r.get("candidates") or [{}])[0].get("family", "")
            g.add_node(tn, type="Taxon", label=r["selected"], family=fam)
            g.add_edge(f"name::{r['historical_name'].lower()}", tn, type="resolves_to",
                       provenance={"confidence": r.get("confidence", 0), "status": r.get("status", ""),
                                   "agent": "Botanist", "reasoning": r.get("reasoning", "")[:500]})
        for ev in e.get("evidence", []):
            for doc in ev.get("pubmed", []):
                dn = f"evidence::pmid:{doc['identifier']}"
                g.add_node(dn, type="Evidence", label=doc.get("title", "")[:80], url=doc.get("url", ""), kind="PubMed")
                g.add_edge(f"taxon::{ev['taxon']}", dn, type="supported_by",
                           provenance={"relevance_note": doc.get("relevance_note", ""), "agent": "Pharmacologist"})
            if ev.get("ema_monograph"):
                doc = ev["ema_monograph"]
                dn = f"evidence::ema:{doc['identifier']}"
                g.add_node(dn, type="Evidence", label=doc.get("title", ""), url=doc.get("url", ""), kind="EMA")
                g.add_edge(f"taxon::{ev['taxon']}", dn, type="regulated_use", provenance={"agent": "Pharmacologist"})
    return g


def export(entries: list[dict]) -> dict:
    g = build_graph(entries)
    nodes, edges = [], []
    for n, data in g.nodes(data=True):
        nodes.append({"id": n, **data})
    for u, v, k, data in g.edges(keys=True, data=True):
        edges.append({"source": u, "target": v, "key": k, **data})

    grades = Counter((e.get("concordance") or {}).get("grade", "?") for e in entries)
    resolutions = [r for e in entries for r in e.get("resolutions", [])]
    summary = {
        "entries": len(entries),
        "with_extraction": sum(1 for e in entries if e.get("extraction")),
        "taxa_resolved": sum(1 for r in resolutions if r.get("status") == "resolved"),
        "taxa_ambiguous": sum(1 for r in resolutions if r.get("status") == "ambiguous"),
        "taxa_unresolved": sum(1 for r in resolutions if r.get("status") == "unresolved"),
        "name_resolutions": len(resolutions),
        "evidence_docs": sum(len(ev.get("pubmed", [])) + (1 if ev.get("ema_monograph") else 0)
                             for e in entries for ev in e.get("evidence", [])),
        "grades": dict(grades),
        "nodes": len(nodes), "edges": len(edges),
    }
    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "graph.json").write_text(json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False), encoding="utf-8")
    (PROCESSED / "entries.json").write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
    (PROCESSED / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
