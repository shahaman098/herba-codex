#!/bin/bash
# Herba Codex — finalization: run AFTER the pipeline stops.
# Builds the KG exports, runs the evaluation + ablation, regenerates deck
# numbers from real results, rebuilds the deck, and copies web data.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1. knowledge graph exports =="
uv run herba build-kg

echo "== 2. evaluation (gold set) =="
uv run python eval/evaluate.py | tail -20

echo "== 3. ablation (single-shot vs agents) =="
uv run python eval/ablation.py | tail -15

echo "== 4. deck numbers from real results =="
uv run python - <<'EOF'
import json
res = json.load(open('eval/results.json'))
abl = json.load(open('eval/ablation.json'))
summary = json.load(open('data/processed/summary.json'))
calib = [{"bin": k, "n": v["n"], "acc": round((v["accuracy"] or 0)*100),
          "mean_conf": round(float(k.split('-')[0]) + 10)}
         for k, v in res["calibration"].items() if v["n"]]
def pct(x): return round((x or 0)*100)
st = res["resolution"]["statuses"]
nums = {
  "res_acc": pct(res["resolution"]["accuracy_at_1"]) / 100,
  "res_lo": (res["bootstrap_95"]["resolution_accuracy_at_1"]["lo"] or 0),
  "res_hi": (res["bootstrap_95"]["resolution_accuracy_at_1"]["hi"] or 0),
  "quote_rate": pct(res["quote_integrity"]["rate"]) / 100,
  "n_entries": summary["entries"],
  "n_resolved": summary["taxa_resolved"],
  "resolved": st.get("resolved", 0), "ambiguous": st.get("ambiguous", 0),
  "unresolved": st.get("unresolved", 0),
  "n_authorities": sum(len((e.get("extraction") or {}).get("authority_citations", []))
                       for e in json.load(open('data/processed/entries.json'))),
  "evidence_docs": summary["evidence_docs"],
  "calib": calib,
  "base_acc": pct(abl["baseline_single_shot"]["resolution_accuracy_at_1"]),
  "base_quote": pct(abl["baseline_single_shot"]["quote_fidelity"]),
  "pipe_acc": pct(abl["agent_pipeline"]["resolution_accuracy_at_1"]),
  "pipe_quote": pct(abl["agent_pipeline"]["quote_integrity"]),
}
json.dump(nums, open('docs/pitch/deck_numbers.json', 'w'), indent=1)
print(json.dumps(nums, indent=1))
EOF

echo "== 5. rebuild deck =="
(cd docs/pitch && NODE_PATH=$(npm root -g) node build_deck.js)

echo "== 6. copy web data =="
mkdir -p web/public/data
cp data/processed/graph.json data/processed/entries.json web/public/data/
ls -t trace/*.jsonl | head -1 | xargs -I{} cp {} web/public/data/trace_sample.jsonl
(cd web && npm run build)

echo "== finalize complete =="
