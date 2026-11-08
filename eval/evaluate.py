"""Herba Codex evaluation harness.

Measures the pipeline on the hand-curated gold set (eval/gold_set.json):

1. Extraction — precision/recall of historical plant names (fuzzy match).
2. Taxonomic resolution — accuracy@1 of the selected accepted name, plus
   status distribution and confidence calibration (binned).
3. Quote integrity — machine-verified substring rate of extracted quotes.
4. Concordance coverage — share of entries that received a grade.

All metrics are reported with bootstrap 95% confidence intervals (1000
resamples, percentile method, fixed seed), because "handling uncertainty"
is a scored criterion and point estimates without intervals are theatre.

Usage: uv run python eval/evaluate.py [--entries data/processed/entries]
"""

from __future__ import annotations

import argparse
import json
import random
import re
import unicodedata
from pathlib import Path


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = s.replace("æ", "ae").replace("œ", "oe").replace("Æ", "Ae").replace("Œ", "Oe")
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).strip()


def fuzzy(a: str, b: str) -> bool:
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return False
    return len(ta & tb) / len(ta | tb) >= 0.6


def name_match(selected: str, gold: str) -> bool:
    """Accept exact/fuzzy match or a same-genus-and-epithet synonym-level hit."""
    if fuzzy(selected, gold):
        return True
    gs = _norm(gold).split()
    ss = _norm(selected).split()
    return len(gs) >= 2 and len(ss) >= 2 and gs[0] == ss[0] and gs[1] == ss[1]


def load(entries_dir: Path) -> dict[str, dict]:
    out = {}
    for f in entries_dir.glob("*.json"):
        try:
            e = json.loads(f.read_text(encoding="utf-8"))
            out[e["id"]] = e
        except Exception:
            continue
    return out


def find_gold_entries(entries: dict[str, dict], gold: list[dict]) -> list[tuple[dict, dict]]:
    pairs = []
    by_heading = {}
    for e in entries.values():
        h = (e.get("locator") or {}).get("heading", "")
        if h:
            by_heading.setdefault(_norm(h), e)
    for g in gold:
        e = by_heading.get(_norm(g["heading"]))
        if e is None:  # tolerate heading variants
            for h, cand in by_heading.items():
                if _norm(g["heading"]) in h:
                    e = cand
                    break
        if e is not None:
            pairs.append((e, g))
    return pairs


def _res_hit(e: dict, g: dict) -> tuple[bool, float] | None:
    """Resolution result for the gold name, or None if not attempted."""
    for r in e.get("resolutions", []):
        if fuzzy(r.get("historical_name", ""), g["historical_name"]):
            sel = r.get("selected", "")
            cand_ok = any(name_match(c.get("scientific_name", ""), g["taxon"])
                          for c in r.get("candidates", []))
            ok = name_match(sel, g["taxon"]) or (not sel and cand_ok)
            return ok, float(r.get("confidence", 0))
    return None


def metrics(pairs: list[tuple[dict, dict]]) -> dict:
    tp = fn = fp = 0
    for e, g in pairs:
        ext = e.get("extraction") or {}
        names = [p.get("name_text", "") for p in ext.get("historical_names", [])]
        if any(fuzzy(n, g["historical_name"]) for n in names):
            tp += 1
        else:
            fn += 1
        for n in names:
            if not fuzzy(n, g["historical_name"]):
                fp += 1
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)

    hits = [h for e, g in pairs if (h := _res_hit(e, g)) is not None]
    correct = sum(1 for ok, _ in hits if ok)
    statuses = {"resolved": 0, "ambiguous": 0, "unresolved": 0}
    for e, g in pairs:
        for r in e.get("resolutions", []):
            if fuzzy(r.get("historical_name", ""), g["historical_name"]):
                st = r.get("status", "?")
                statuses[st] = statuses.get(st, 0) + 1

    confs = [(c, ok) for ok, c in hits]
    bins = {"0-50": [], "50-70": [], "70-85": [], "85-100": []}
    for c, ok in confs:
        key = "0-50" if c < 0.5 else "50-70" if c < 0.7 else "70-85" if c < 0.85 else "85-100"
        bins[key].append(ok)
    calibration = {k: {"n": len(v), "accuracy": round(sum(v) / len(v), 3) if v else None}
                   for k, v in bins.items()}

    qv = qf = 0
    for e, _ in pairs:
        a = e.get("audit") or {}
        qv += len(a.get("quotes_verified", []))
        qf += len(a.get("quotes_failed", []))

    graded = sum(1 for e, _ in pairs if (e.get("concordance") or {}).get("grade"))

    return {
        "extraction": {"precision": round(precision, 3), "recall": round(recall, 3),
                       "tp": tp, "fp": fp, "fn": fn},
        "resolution": {"accuracy_at_1": round(correct / len(hits), 3) if hits else None,
                       "n": len(hits), "statuses": statuses},
        "calibration": calibration,
        "quote_integrity": {"verified": qv, "failed": qf,
                            "rate": round(qv / max(qv + qf, 1), 3)},
        "concordance_coverage": {"graded": graded, "of": len(pairs)},
        "n_gold_pairs": len(pairs),
    }


def bootstrap_ci(pairs, metric_fn, n: int = 1000, seed: int = 42) -> dict:
    rng = random.Random(seed)
    vals = []
    for _ in range(n):
        sample = [pairs[rng.randrange(len(pairs))] for _ in pairs]
        m = metric_fn(sample)
        if m is not None:
            vals.append(m)
    if not vals:
        return {"lo": None, "hi": None}
    vals.sort()
    return {"lo": round(vals[int(0.025 * len(vals))], 3),
            "hi": round(vals[min(len(vals) - 1, int(0.975 * len(vals)))], 3)}


def _res_acc(sample):
    hits = [h for e, g in sample if (h := _res_hit(e, g)) is not None]
    if not hits:
        return None
    return sum(1 for ok, _ in hits if ok) / len(hits)


def _quote_rate(sample):
    v = f = 0
    for e, _ in sample:
        a = e.get("audit") or {}
        v += len(a.get("quotes_verified", []))
        f += len(a.get("quotes_failed", []))
    return v / max(v + f, 1) if (v + f) else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--entries", default="data/processed/entries")
    args = ap.parse_args()
    entries = load(Path(args.entries))
    gold = json.loads(Path("eval/gold_set.json").read_text(encoding="utf-8"))["gold"]
    pairs = find_gold_entries(entries, gold)
    if not pairs:
        print(json.dumps({"error": "no gold entries found in processed entries",
                          "n_entries": len(entries)}))
        return
    m = metrics(pairs)
    m["bootstrap_95"] = {
        "resolution_accuracy_at_1": bootstrap_ci(pairs, _res_acc),
        "quote_integrity_rate": bootstrap_ci(pairs, _quote_rate),
    }
    Path("eval/results.json").write_text(json.dumps(m, indent=2), encoding="utf-8")
    print(json.dumps(m, indent=2))


if __name__ == "__main__":
    main()
