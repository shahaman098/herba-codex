"""The orchestrator: deterministic control flow, agentic steps.

Five agents — Historian → Botanist → Pharmacologist → Evidence Scorer →
Auditor — run per entry under a fixed, checkpointed sequence.

Two execution modes:
- `guided` (default): the orchestrator executes each agent's tool plan
  deterministically (Kew POWO / GBIF / EMA index / PubMed calls) and hands
  the results to the agent, which reasons over them and returns the
  structured payload. One LLM call per stage; network calls are parallel
  and cached across entries. Honest description: agent-driven pipeline with
  orchestrator-executed tools.
- `interactive`: each agent runs its own JSON ReAct loop with native tool
  calls (used for the demo subset and debugging; see runtime/agent.py).

After the Auditor, the orchestrator runs its own deterministic quote
verification and merges it into the audit — the machine check is the
backstop for the agent's judgement.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from pydantic import BaseModel

from .agents.roster import ROSTER
from .agents.schemas import (AuditReport, Concordance, Extraction, Locator,
                             ModernEvidence, NameCandidate, NameResolution,
                             RemedyEntry)
from .runtime.agent import validate
from .runtime.llm import complete_messages, model_for
from .runtime.trace import TraceLogger
from .tools.botany import gbif_match, powo_search
from .tools.medchem import ema_monograph_lookup, pubmed_search

CHECKPOINT_DIR = Path("data/processed/entries")
CACHE_FILE = Path("data/processed/agent_caches.json")

_res_cache: dict = {}
_ev_cache: dict = {}


def _load_caches() -> None:
    global _res_cache, _ev_cache
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            _res_cache = data.get("resolutions", {})
            _ev_cache = data.get("evidence", {})
        except Exception:
            pass


def _save_caches() -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps({"resolutions": _res_cache, "evidence": _ev_cache},
                                     ensure_ascii=False), encoding="utf-8")


def _llm(agent_name: str, system: str, task: str, max_tokens: int) -> dict:
    model = model_for(ROSTER[agent_name].model_key)
    out = complete_messages(model, [{"role": "system", "content": system + "\n/no_think"},
                                    {"role": "user", "content": task}], max_tokens)
    return out


def _parse_json(text: str) -> dict | None:
    t = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    try:
        obj = json.loads(t)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass
    start = t.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(t)):
            if t[i] == "{":
                depth += 1
            elif t[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(t[start:i + 1])
                        if isinstance(obj, dict):
                            return obj
                    except Exception:
                        break
                    break
        start = t.find("{", start + 1)
    return None


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = s.replace("æ", "ae").replace("œ", "oe").replace("Æ", "Ae").replace("Œ", "Oe")
    return re.sub(r"\s+", " ", s).strip().lower()


# ------------------------------------------------------------------ stages

def stage_historian(raw: dict, trace: TraceLogger, interactive: bool) -> Extraction | None:
    if interactive:
        payload = ROSTER["Historian"].run(
            f"Extract the medicinal content of this herbal entry.\n\n"
            f"HEADING: {raw['locator']['heading']}\n\nTEXT:\n{raw['source_text'][:3500]}",
            trace, entry_id=raw["id"], stage="extraction")
    else:
        r = _llm("Historian", ROSTER["Historian"].system_prompt,
                 f"Extract the medicinal content of this herbal entry.\n\n"
                 f"HEADING: {raw['locator']['heading']}\n\nTEXT:\n{raw['source_text'][:3500]}",
                 1100)
        trace.log("llm_call", {"agent": "Historian", "usage": r.get("usage"),
                               "response_preview": r.get("text", "")[:1500]}, agent="Historian")
        payload = _parse_json(r.get("text", "")) or {}
    model, _ = validate(payload, Extraction)
    if model is None and not interactive:  # one repair retry
        r = _llm("Historian", ROSTER["Historian"].system_prompt +
                 "\nYour previous answer was invalid. Follow the schema EXACTLY.",
                 f"Extract the medicinal content of this herbal entry.\n\n"
                 f"HEADING: {raw['locator']['heading']}\n\nTEXT:\n{raw['source_text'][:3500]}",
                 1100)
        trace.log("stage_retry", {"entry": raw["id"], "stage": "extraction"})
        payload = _parse_json(r.get("text", "")) or {}
        model, _ = validate(payload, Extraction)
    return model


def _powo_verify(candidates: list[dict]) -> list[dict]:
    """Deterministic verification of LLM-proposed candidates against Kew POWO."""
    def one(cand: dict) -> dict:
        try:
            res = powo_search({"query": cand.get("scientific_name", ""), "limit": 3})
        except Exception:
            return {**cand, "powo": None}
        hits = res.get("results", [])
        best = None
        want = _norm(cand.get("scientific_name", ""))
        for h in hits:
            if _norm(h.get("name", "")) == want:
                best = h
                break
        if best is None and hits:
            best = hits[0]
        return {**cand, "powo": best}
    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(one, candidates))


def stage_botanist(raw: dict, names: list[str], trace: TraceLogger,
                   interactive: bool) -> list[NameResolution]:
    resolutions: list[NameResolution] = []
    todo: list[str] = []
    for name in names:
        key = name.lower().strip()
        if key in _res_cache:
            r = NameResolution.model_validate(_res_cache[key])
            r.historical_name = name
            resolutions.append(r)
        else:
            todo.append(name)

    if todo:
        if interactive:
            payload = ROSTER["Botanist"].run(
                "Resolve these historical plant names from a 1653 herbal entry "
                f"('{raw['locator']['heading']}') to modern accepted taxonomy.\n\n"
                "HISTORICAL NAMES:\n" + "\n".join(f"- {n}" for n in todo),
                trace, entry_id=raw["id"], stage="resolution")
            model, _ = validate(payload, _Resolutions)
            got = (model.resolutions if model else [])[:len(todo)]
        else:
            r = _llm("Botanist", ROSTER["Botanist"].system_prompt +
                     "\nGUIDED MODE: do not call tools now. For EACH historical name below, "
                     "propose up to 3 candidate scientific names from your knowledge of "
                     "historical botany and early-modern synonymy. Return payload = "
                     '{"proposals": [{"historical_name": "...", "candidates": '
                     '[{"scientific_name": "...", "confidence": 0.0-1.0, "reason": "..."}]}]}',
                     "HISTORICAL NAMES:\n" + "\n".join(f"- {n}" for n in todo) +
                     f"\n\n(Entry heading for context: {raw['locator']['heading']})",
                     900)
            trace.log("llm_call", {"agent": "Botanist", "usage": r.get("usage"),
                                   "response_preview": r.get("text", "")[:1500]}, agent="Botanist")
            payload = _parse_json(r.get("text", "")) or {}
            trace.log("tool_call", {"agent": "Botanist", "tool": "powo_search",
                                    "mode": "guided", "names": todo}, agent="Botanist")
            proposals = (payload.get("proposals") or [])
            got = []
            for name in todo:
                prop = None
                for p in proposals:
                    if isinstance(p, dict) and _norm(str(p.get("historical_name", ""))) == _norm(name):
                        prop = p
                        break
                cands = []
                for c in (prop or {}).get("candidates") or []:
                    if isinstance(c, str):
                        c = {"scientific_name": c, "confidence": 0.5}
                    elif isinstance(c, dict):
                        c = {**c}
                        c.setdefault("scientific_name", c.get("name", ""))
                    else:
                        continue
                    if c.get("scientific_name"):
                        cands.append(c)
                verified = _powo_verify(cands[:3])
                resolutions_from_cands = []
                for c in verified:
                    p = c.get("powo") or {}
                    selected = p.get("name") or c.get("scientific_name", "")
                    synonym_of = p.get("synonym_of") or ""
                    accepted_name = synonym_of or selected
                    if synonym_of:
                        accepted_name = synonym_of
                    conf = float(c.get("confidence") or 0.5)
                    if p and p.get("accepted"):
                        conf = max(conf, 0.9)
                    elif p:
                        conf = max(conf, 0.8)
                    resolutions_from_cands.append(NameCandidate(
                        scientific_name=accepted_name or selected,
                        authorship=(p.get("author") or ""),
                        family=(p.get("family") or ""),
                        source="POWO" if p else "LLM_knowledge",
                        confidence=round(min(conf, 0.97), 2),
                        matched_via=("POWO search" if p else "LLM proposal")))
                if not resolutions_from_cands:
                    got.append(NameResolution(historical_name=name, status="unresolved",
                                              reasoning="no candidates proposed"))
                    continue
                top = max(resolutions_from_cands, key=lambda c: c.confidence)
                gb = {}
                try:
                    gb = gbif_match({"name": top.scientific_name})
                except Exception:
                    pass
                status = "resolved" if top.confidence >= 0.8 else (
                    "ambiguous" if len(resolutions_from_cands) > 1 else "unresolved")
                got.append(NameResolution(
                    historical_name=name,
                    candidates=resolutions_from_cands[:3],
                    selected=top.scientific_name if status == "resolved" else "",
                    confidence=top.confidence if status == "resolved" else round(top.confidence * 0.6, 2),
                    status=status,
                    reasoning=(top.matched_via + (f"; GBIF {gb.get('match_type')}" if gb else
                                                 "; not verified"))))
            trace.log("tool_result", {"agent": "Botanist", "mode": "guided", "resolved": todo}, agent="Botanist")
        if len(got) < len(todo):
            got += [NameResolution(historical_name=n, status="unresolved") for n in todo[len(got):]]
        for name, r in zip(todo, got):
            r.historical_name = name
            resolutions.append(r)
            if r.selected or r.status == "unresolved":
                _res_cache[name.lower().strip()] = r.model_dump()
    return resolutions


def stage_pharmacologist(raw: dict, taxa: list[str], uses: str, trace: TraceLogger,
                         interactive: bool) -> list[ModernEvidence]:
    need = [t for t in dict.fromkeys(taxa) if t not in _ev_cache]
    if not need:
        return [ModernEvidence.model_validate(_ev_cache[t]) for t in dict.fromkeys(taxa)
                if t in _ev_cache]

    docs_by_taxon: dict[str, dict] = {}
    if interactive:
        payload = ROSTER["Pharmacologist"].run(
            f"Gather modern evidence for these taxa, relevant to their traditional uses.\n\n"
            f"TAXA: {', '.join(need[:3])}\nTRADITIONAL USES (as recorded): {uses}\n\n"
            f"One evidence object per taxon, same order.",
            trace, entry_id=raw["id"], stage="evidence")
        model, _ = validate(payload, _Evidence)
        for e in (model.evidence if model else []):
            if e.taxon in need:
                _ev_cache[e.taxon] = e.model_dump()
    else:
        def gather(taxon: str) -> tuple[str, dict]:
            genus = taxon.split()[0] if taxon else ""
            ema = {}
            for probe in [genus, genus.lower()]:
                ema = ema_monograph_lookup({"substance": probe})
                if ema.get("monograph"):
                    break
            pm = {}
            try:
                # modern-biomedical query — historical ailment names don't index in PubMed
                pm = pubmed_search({"query": f"\"{taxon}\" AND (pharmacology OR clinical OR "
                                             f"toxicology OR ethnopharmacology)", "retmax": 3})
                if not pm.get("articles"):
                    pm = pubmed_search({"query": f"\"{taxon}\"", "retmax": 2})
            except Exception:
                pm = {"articles": []}
            return taxon, {"ema": ema.get("monograph"), "pubmed": pm.get("articles", [])[:3]}
        trace.log("tool_call", {"agent": "Pharmacologist", "mode": "guided",
                                "tools": ["ema_monograph_lookup", "pubmed_search"],
                                "taxa": need[:3]}, agent="Pharmacologist")
        with ThreadPoolExecutor(max_workers=4) as pool:
            for taxon, docs in pool.map(gather, need[:3]):
                docs_by_taxon[taxon] = docs
        r = _llm("Pharmacologist", ROSTER["Pharmacologist"].system_prompt +
                 "\nGUIDED MODE: tools were already executed. Here are the retrieved documents:\n" +
                 json.dumps(docs_by_taxon, ensure_ascii=False)[:3000] +
                 '\n\nReturn payload = {"evidence": [...]} with ONE evidence object per taxon '
                 'above, same order. Use ONLY the provided documents for identifiers, PMIDs, '
                 'URLs and titles. If nothing relevant was found for a taxon, return it with '
                 'empty pubmed and null ema_monograph and say so in the summary.',
                 "TAXA: " + ", ".join(need[:3]) + f"\nTRADITIONAL USES (as recorded): {uses}",
                 1000)
        trace.log("llm_call", {"agent": "Pharmacologist", "usage": r.get("usage"),
                               "response_preview": r.get("text", "")[:1200]}, agent="Pharmacologist")
        payload = _parse_json(r.get("text", "")) or {}
        model, _ = validate(payload, _Evidence)
        for e in (model.evidence if model else []):
            if e.taxon in need:
                # enforce provenance: identifiers must come from the retrieved docs
                docs = docs_by_taxon.get(e.taxon, {})
                pmids = {a["pmid"] for a in docs.get("pubmed", [])}
                e.pubmed = [d for d in e.pubmed if d.identifier in pmids]
                e.pubmed = e.pubmed or [ModernEvidence.model_validate({
                    "kind": "PubMed", "title": a["title"], "identifier": a["pmid"],
                    "year": a.get("year", ""), "url": a.get("url", ""),
                    "relevance_note": ""}).model_dump() for a in docs.get("pubmed", [])]
                e.pubmed = [_ensure_doc(d) for d in e.pubmed]
                if docs.get("ema") and not e.ema_monograph:
                    m = docs["ema"]
                    e.ema_monograph = {"kind": "EMA_monograph", "title": m.get("title", ""),
                                       "identifier": m.get("title", ""), "year": "",
                                       "url": m.get("url", ""), "relevance_note": "EU HMPC monograph"}
                _ev_cache[e.taxon] = e.model_dump()
        for t in need[:3]:  # cache empties too, so we don't re-query
            if t not in _ev_cache:
                docs = docs_by_taxon.get(t, {})
                ev = ModernEvidence(taxon=t)
                if docs.get("ema"):
                    m = docs["ema"]
                    ev.ema_monograph = {"kind": "EMA_monograph", "title": m.get("title", ""),
                                        "identifier": m.get("title", ""), "year": "",
                                        "url": m.get("url", ""), "relevance_note": "EU HMPC monograph"}
                ev.pubmed = [_ensure_doc(a) for a in docs.get("pubmed", [])]
                _ev_cache[t] = ev.model_dump()

    return [ModernEvidence.model_validate(_ev_cache[t]) for t in dict.fromkeys(taxa)
            if t in _ev_cache]


def _ensure_doc(d: dict) -> dict:
    if isinstance(d, dict) and "identifier" in d and "pmid" in d:
        return d
    if isinstance(d, dict) and "pmid" in d:
        return {"kind": "PubMed", "title": d.get("title", ""), "identifier": d.get("pmid", ""),
                "year": d.get("year", ""), "url": d.get("url", ""), "relevance_note": ""}
    return d


def stage_scorer(raw: dict, extraction: Extraction, resolutions: list[NameResolution],
                 evidence: list[ModernEvidence], trace: TraceLogger,
                 interactive: bool) -> Concordance | None:
    if not evidence:
        return None
    claims = [a.model_dump() for a in extraction.ailments[:8]]
    res_compact = [{"historical_name": r.historical_name, "selected": r.selected,
                    "status": r.status, "confidence": r.confidence} for r in resolutions]
    ev_compact = [{"taxon": e.taxon,
                   "ema": bool(e.ema_monograph),
                   "pubmed": [{"title": d.title, "pmid": d.identifier, "year": d.year}
                              for d in e.pubmed[:2]]} for e in evidence]
    if interactive:
        return validate(ROSTER["Evidence Scorer"].run(
            f"Grade the concordance for entry '{raw['locator']['heading']}'.\n\n"
            f"HISTORICAL CLAIMS: {json.dumps(claims, ensure_ascii=False)[:1000]}\n\n"
            f"RESOLUTIONS: {json.dumps(res_compact, ensure_ascii=False)}\n\n"
            f"MODERN EVIDENCE: {json.dumps(ev_compact, ensure_ascii=False)}",
            trace, entry_id=raw["id"], stage="concordance"), Concordance)[0]
    r = _llm("Evidence Scorer", ROSTER["Evidence Scorer"].system_prompt,
             f"Grade the concordance for entry '{raw['locator']['heading']}'.\n\n"
             f"HISTORICAL CLAIMS: {json.dumps(claims, ensure_ascii=False)[:1000]}\n\n"
             f"RESOLUTIONS: {json.dumps(res_compact, ensure_ascii=False)}\n\n"
             f"MODERN EVIDENCE: {json.dumps(ev_compact, ensure_ascii=False)}", 500)
    trace.log("llm_call", {"agent": "Evidence Scorer", "usage": r.get("usage"),
                           "response_preview": r.get("text", "")[:800]},
              agent="Evidence Scorer")
    model, _ = validate(_parse_json(r.get("text", "")) or {}, Concordance)
    return model


def stage_auditor(raw: dict, entry_for_audit: dict, trace: TraceLogger,
                  interactive: bool) -> AuditReport | None:
    if interactive:
        audit = validate(ROSTER["Auditor"].run(
            "Audit this processed entry.\n\nENTRY:\n" +
            json.dumps(entry_for_audit, ensure_ascii=False)[:6800] +
            "\n\nReturn the AuditReport payload.", trace,
            entry_id=raw["id"], stage="audit"), AuditReport)[0]
        return _backstop_quotes(entry_for_audit, audit, trace)
    # guided: deterministic quote verification + one coherence call
    src = entry_for_audit["heading"] + ". " + entry_for_audit["source_text"]
    ext = entry_for_audit.get("extraction") or {}
    quotes = [p.get("context_quote", "") for p in ext.get("historical_names", [])] + \
             [a.get("context_quote", "") for a in ext.get("ailments", [])]
    quotes = [q for q in quotes if q]
    verified = [q for q in quotes if _norm(q) in _norm(src)]
    failed = [q for q in quotes if q not in verified]
    trace.log("tool_call", {"agent": "Auditor", "mode": "guided",
                            "tool": "verify_quote", "n_quotes": len(quotes)},
              agent="Auditor")
    r = _llm("Auditor", ROSTER["Auditor"].system_prompt +
             "\nGUIDED MODE: quote verification was already executed mechanically — "
             "quotes_failed below are CONFIRMED failures. Focus on coherence and completeness.",
             "ENTRY SUMMARY:\n" + json.dumps({
                 "heading": entry_for_audit["heading"],
                 "resolutions": entry_for_audit["resolutions"],
                 "evidence": [{"taxon": e["taxon"], "ema": bool(e.get("ema_monograph")),
                               "pubmed_n": len(e.get("pubmed", []))}
                              for e in entry_for_audit["evidence"]],
                 "concordance": entry_for_audit["concordance"],
                 "quotes_failed": failed,
             }, ensure_ascii=False)[:2200] +
             '\n\nReturn payload: {"schema_ok": true, "quotes_verified": [], '
             '"quotes_failed": <the failed quotes>, "issues": ["..."], '
             '"verdict": "pass|pass_with_issues|fail"}', 400)
    trace.log("llm_call", {"agent": "Auditor", "usage": r.get("usage"),
                           "response_preview": r.get("text", "")[:600]}, agent="Auditor")
    payload = _parse_json(r.get("text", "")) or {}
    payload["quotes_failed"] = failed
    audit, _ = validate(payload, AuditReport)
    return _backstop_quotes(entry_for_audit, audit, trace)


def _backstop_quotes(entry_for_audit: dict, audit: AuditReport | None,
                     trace: TraceLogger) -> AuditReport:
    """Deterministic quote verification, merged into the agent's audit."""
    src = (entry_for_audit.get("heading", "") + ". " + entry_for_audit.get("source_text", ""))
    ext = entry_for_audit.get("extraction") or {}
    verified, failed = [], []
    for p in ext.get("historical_names", []):
        q = p.get("context_quote", "")
        (verified if q and _norm(q) in _norm(src) else failed).append(q)
    for a in ext.get("ailments", []):
        q = a.get("context_quote", "")
        (verified if q and _norm(q) in _norm(src) else failed).append(q)
    if audit is None:
        return AuditReport(schema_ok=bool(ext), quotes_verified=verified,
                           quotes_failed=[q for q in failed if q],
                           issues=["auditor output missing"],
                           verdict="pass_with_issues" if not failed else "fail")
    audit.quotes_failed = sorted(set(audit.quotes_failed) | {q for q in failed if q})
    audit.quotes_verified = sorted(set(audit.quotes_verified) | {q for q in verified if q})
    if audit.quotes_failed and audit.verdict == "pass":
        audit.verdict = "pass_with_issues"
        audit.issues.append("machine check caught failed quotes")
    return audit


class _Resolutions(BaseModel):
    resolutions: list[NameResolution]


class _Evidence(BaseModel):
    evidence: list[ModernEvidence]


def process_entry(raw: dict, trace: TraceLogger, out_dir: Path, models: dict,
                  interactive: bool = False) -> dict:
    entry_id = raw["id"]
    ckpt = out_dir / f"{entry_id}.json"
    if ckpt.exists():
        try:
            done = json.loads(ckpt.read_text(encoding="utf-8"))
            if done.get("audit"):
                return done
        except Exception:
            pass

    meta = {"run_id": trace.run_id, "models": models, "mode": "interactive" if interactive else "guided"}

    extraction = stage_historian(raw, trace, interactive)
    if extraction is None or not extraction.historical_names:
        entry = RemedyEntry(id=entry_id, locator=Locator(**raw["locator"]),
                            source_text=raw["source_text"],
                            meta={**meta, "note": "no extraction or non-medicinal"})
        _save(entry, ckpt)
        return entry.model_dump()

    names = [p.name_text for p in extraction.historical_names[:3]]
    resolutions = stage_botanist(raw, names, trace, interactive)

    resolved = [r.selected for r in resolutions if r.status == "resolved" and r.selected]
    uses = "; ".join({a.name for a in extraction.ailments[:6]})[:280]
    evidence = stage_pharmacologist(raw, resolved, uses, trace, interactive) if resolved else []

    concordance = stage_scorer(raw, extraction, resolutions, evidence, trace, interactive)

    entry_for_audit = {
        "id": entry_id, "heading": raw["locator"]["heading"],
        "source_text": raw["source_text"][:3500],
        "extraction": extraction.model_dump(),
        "resolutions": [r.model_dump() for r in resolutions],
        "evidence": [e.model_dump() for e in evidence],
        "concordance": concordance.model_dump() if concordance else None,
    }
    audit = stage_auditor(raw, entry_for_audit, trace, interactive)

    entry = RemedyEntry(
        id=entry_id, locator=Locator(**raw["locator"]), source_text=raw["source_text"],
        extraction=extraction, resolutions=resolutions, evidence=evidence,
        concordance=concordance, audit=audit,
        meta={**meta, "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    _save(entry, ckpt)
    return entry.model_dump()


def _save(entry: RemedyEntry, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entry.model_dump(), ensure_ascii=False, indent=1),
                    encoding="utf-8")


def run(entries: list[dict], trace: TraceLogger, max_entries: int = 0,
        workers: int = 3, interactive: bool = False) -> list[dict]:
    out_dir = CHECKPOINT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    _load_caches()
    if max_entries:
        entries = entries[:max_entries]
    models = {name: model_for(agent.model_key) for name, agent in ROSTER.items()}
    results = []
    done_n = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(process_entry, raw, trace, out_dir, models, interactive): raw
                for raw in entries}
        for fut in as_completed(futs):
            raw = futs[fut]
            try:
                res = fut.result()
                results.append(res)
            except Exception as exc:  # keep the pipeline alive on single-entry failures
                trace.log("entry_error", {"entry": raw["id"],
                                          "error": f"{type(exc).__name__}: {exc}"})
            done_n += 1
            if done_n % 10 == 0:
                _save_caches()
                trace.log("progress", {"done": done_n, "of": len(entries)})
    _save_caches()
    trace.log("progress", {"done": done_n, "of": len(entries), "finished": True})
    return results
