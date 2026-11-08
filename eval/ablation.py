"""Ablation: single-shot baseline vs the five-agent pipeline.

The baseline is one LLM call per entry with no tools, no role separation and
no audit — "ask a model about this herb". It answers the question a judge
will actually ask: *what did the agentic architecture buy us?*

Measures on the gold set:
- resolution accuracy@1 (selected taxon == gold) with/without tool verification
- quote fidelity: share of produced quotes that literally appear in the source
  (the pipeline's Auditor enforces this; the baseline has no such gate)

Usage: uv run python eval/ablation.py
Writes eval/ablation.json and prints a comparison table.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from evaluate import _norm, fuzzy, name_match, find_gold_entries, load  # noqa: E402

from herbacodex.agents.roster import ROSTER  # noqa: E402
from herbacodex.runtime.llm import complete_messages, model_for  # noqa: E402
from herbacodex.runtime.trace import TraceLogger  # noqa: E402


def _parse_json(text: str) -> dict:
    t = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    try:
        return json.loads(t)
    except Exception:
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
                            return json.loads(t[start:i + 1])
                        except Exception:
                            break
                        break
            start = t.find("{", start + 1)
    return {}


def baseline_one(entry: dict) -> dict:
    """One-shot: extract + resolve in a single unaided call."""
    system = ("You are an expert in the history of pharmacology and plant taxonomy. "
              "Given a historical herbal entry, return ONE JSON object: "
              '{"plant_name": "<main historical plant name>", "ailments": ["..."], '
              '"modern_scientific_name": "<your best modern accepted scientific name>", '
              '"quote": "<one verbatim <=20-word quote from the text supporting the main use>"} '
              "/no_think")
    r = complete_messages(model_for(None),
                          [{"role": "system", "content": system},
                           {"role": "user", "content":
                            f"ENTRY: {entry['locator']['heading']}\n\nTEXT:\n{entry['source_text'][:3000]}"}],
                          400)
    return _parse_json(r.get("text", ""))


def main() -> None:
    entries = load(Path("data/processed/entries"))
    gold = json.loads(Path("eval/gold_set.json").read_text(encoding="utf-8"))["gold"]
    pairs = find_gold_entries(entries, gold)
    trace = TraceLogger(run_id=None)
    trace.log("ablation_start", {"n": len(pairs)})

    res_correct = res_total = 0
    quote_ok = quote_total = 0
    for e, g in pairs:
        out = baseline_one(e)
        trace.log("ablation_item", {"entry": e["id"], "output": out})
        sel = out.get("modern_scientific_name", "")
        res_total += 1
        res_correct += bool(sel and name_match(sel, g["taxon"]))
        q = out.get("quote", "")
        if q:
            quote_total += 1
            src = e["source_text"]
            a, b = _norm(q), _norm(src)
            quote_ok += bool(a and a in b)

    # pipeline numbers from the processed entries themselves
    p_res_c = p_res_t = p_q_ok = p_q_t = 0
    for e, g in pairs:
        for r in e.get("resolutions", []):
            if not fuzzy(r.get("historical_name", ""), g["historical_name"]):
                continue
            p_res_t += 1
            p_res_c += bool(name_match(r.get("selected", ""), g["taxon"])
                            or any(name_match(c.get("scientific_name", ""), g["taxon"])
                                   for c in r.get("candidates", []) and c.get("source") == "POWO"
                                   for c in r.get("candidates", [])))
        a = e.get("audit") or {}
        p_q_ok += len(a.get("quotes_verified", []))
        p_q_t += len(a.get("quotes_verified", [])) + len(a.get("quotes_failed", []))

    out = {
        "baseline_single_shot": {
            "resolution_accuracy_at_1": round(res_correct / max(res_total, 1), 3),
            "quote_fidelity": round(quote_ok / max(quote_total, 1), 3),
            "n": len(pairs),
            "notes": "one unaided LLM call; no tools, no verification, no audit"},
        "agent_pipeline": {
            "resolution_accuracy_at_1": round(p_res_c / max(p_res_t, 1), 3),
            "quote_integrity": round(p_q_ok / max(p_q_t, 1), 3),
            "notes": "5 agents, POWO/GBIF verification, mechanical + agent audit"},
    }
    Path("eval/ablation.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))
    trace.close()


if __name__ == "__main__":
    main()
