"""Deterministic re-audit pass: recompute quote verification with the entry
heading included (the original run excluded it, falsely failing heading
quotes). Recomputes quotes_verified/quotes_failed and downgrades verdicts that
failed ONLY on heading quotes. No LLM calls.
"""
from __future__ import annotations
import json, re, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from herbacodex.orchestrator import _norm  # noqa: E402

def reaudit_file(f: Path) -> None:
    e = json.loads(f.read_text(encoding="utf-8"))
    a = e.get("audit")
    ext = e.get("extraction")
    if not a or not ext:
        return
    src = _norm(e["locator"]["heading"] + ". " + e["source_text"])
    quotes = [p.get("context_quote", "") for p in ext.get("historical_names", [])]
    quotes += [x.get("context_quote", "") for x in ext.get("ailments", [])]
    quotes += [p.get("context_quote", "") for p in ext.get("preparations", [])]
    quotes = [q for q in quotes if q]
    verified = [q for q in quotes if _norm(q) in src]
    failed = [q for q in quotes if q not in verified]
    a["quotes_verified"] = sorted(set(verified))
    a["quotes_failed"] = sorted(set(failed))
    if not failed:
        if a["verdict"] == "fail":
            a["verdict"] = "pass_with_issues" if a.get("issues") else "pass"
            a["issues"] = list(a.get("issues", [])) + ["downgraded: quote failures were heading quotes"]
    else:
        if a["verdict"] == "pass":
            a["verdict"] = "pass_with_issues"
    f.write_text(json.dumps(e, ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    files = sorted(Path("data/processed/entries").glob("*.json"))
    for f in files:
        reaudit_file(f)
    print(f"reaudited {len(files)} entries")
