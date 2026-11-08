#!/bin/bash
# Assemble the Herba Codex pitch video from slide renders + demo segments + TTS narration.
set -euo pipefail
cd "$(dirname "$0")/../docs/pitch"
FF="$HOME/bin/ffmpeg"
VOICE="${1:-Samantha}"
OUT=video_build
mkdir -p $OUT

dur() { $FF -i "$1" 2>&1 | grep Duration | awk '{print $2}' | tr -d , | awk -F: '{print ($1*3600)+($2*60)+$3}'; }

# ---------------- narration (macOS TTS)
say_seg() { say -v "$VOICE" -o "$OUT/$1.aiff" "$2"; }

say_seg n0 "Herba Codex. From Culpeper to contemporary evidence, one audited claim at a time. An agentic pipeline for Ethno Hack twenty twenty six, track: traditional knowledge."
say_seg n1 "In sixteen fifty three, Nicholas Culpeper told England that comfrey heals all inward wounds, and knits together broken bones. Three hundred and seventy years later, the European Medicines Agency restricts comfrey. Two claims. One plant. Centuries apart. Ethno pharmacology lives in this gap, and the gap is uncomputed. Historical herbals are a vast record of how Europe actually used plants as medicine, and the field's own literature names the bottleneck: semantic extraction from legacy texts. Nobody has bridged it end to end, with every step auditable. We built the bridge."
say_seg n2 "Our corpus: Culpeper's Complete Herbal. Two hundred and ninety seven remedy entries, public domain, segmented with exact character offsets, so every claim cites its place in the text. Plant identity comes from Kew's Plants of the World Online, and G B I F. Evidence comes from E U herbal monographs, PubMed, and PubChem. Every source, its licence, and how we access it, is documented in the repo. And one rule above all: we never present computational findings as medical facts. Our system grades agreement, not therapies."
say_seg n3 "Herba Codex is an agentic pipeline. Five specialist agents under a deterministic orchestrator. The Historian extracts every claim exactly as the text states it, backed by verbatim quotes. The Botanist resolves historical names to modern taxonomy, using Kew P O W O and G B I F as tools, not vibes, with calibrated confidence. The Pharmacologist links each resolved plant to modern evidence. The Evidence Scorer grades concordance, A through D, plus X for: cannot grade honestly. And the Auditor, an adversarial gate, verifies every quote mechanically, and can fail an entry. Failed entries stay in the dataset, flagged. Hiding failures would defeat the purpose. Everything runs on a local model: fully reproducible, zero cost."
say_seg n4 "Three views, one story. The Graph Explorer: a provenance carrying knowledge graph. Every edge carries its quote, its agent, and a confidence. The Historian's Audit Desk: the source text and every extracted claim, side by side. You can check the Botanist's candidates, the evidence, and the audit verdict, against the original page. And the Agent Trace Viewer: the actual log of the run you are looking at. Every L L M call, every tool call, with latency and token counts. In an age of black box A I, we show you the whole machine."
say_seg n5 "Validation, not vibes. We hand curated a thirty entry gold set spanning the alphabet. Taxonomic resolution accuracy, with bootstrap confidence intervals. Confidence calibration, by bin. And quote integrity: the share of extracted quotes that appear verbatim in the source. That is the difference between a language model, and an instrument. The ablation: a single unaided L L M call, versus the five agent pipeline, on the same gold set, with the same model. The architecture is the result."
say_seg n6 "We will say it ourselves, before anyone else does. Culpeper is a derivative of Dioscorides and Galen. A nine billion parameter local model limits extraction depth, by design, for reproducibility. The gold set is thirty entries. Traditional use statements are historical records, not recommendations, and the app says so on every screen. Next: more corpora. Pliny's medical books are already segmented. Multilingual name resolution. Community gold sets. Publication grade exports for the EthCSTWIN platform. Two millennia of claims. One audited pipeline. Evidence, not verdicts. The repo is on screen. Thank you."

# ---------------- convert demo segments webm -> mp4
for f in demo_graph demo_audit demo_trace; do
  $FF -y -i $OUT/$f.webm -c:v libx264 -pix_fmt yuv420p -r 30 $OUT/$f.mp4 2>/dev/null
done

# ---------------- helper: still image + narration -> segment
still_seg() { # png, aiff, out
  local d=$(dur "$2"); d=$(echo "$d + 0.7" | bc)
  $FF -y -loop 1 -framerate 30 -i "$1" -i "$2" -t "$d" -vf "scale=1600:900" -c:v libx264 -pix_fmt yuv420p \
      -c:a aac -ar 44100 -ac 2 -shortest "$3" 2>/dev/null
}
# helper: demo mp4 extended (clone last frame) to narration length
demo_seg() { # mp4, aiff, out
  local d=$(dur "$2"); d=$(echo "$d + 0.7" | bc)
  $FF -y -i "$1" -i "$2" -t "$d" -r 30 \
      -filter:v "tpad=stop_mode=clone:stop_duration=60" \
      -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 44100 -ac 2 -shortest "$3" 2>/dev/null
}

still_seg $OUT/slide-01.png $OUT/n0.aiff $OUT/s0.mp4
still_seg $OUT/slide-02.png $OUT/n1.aiff $OUT/s1.mp4
still_seg $OUT/slide-03.png $OUT/n2.aiff $OUT/s2.mp4
still_seg $OUT/slide-04.png $OUT/n3.aiff $OUT/s3.mp4
# demo: split narration 4 across three segments proportionally to their length
$FF -y -i $OUT/n4.aiff -f segment -segment_time 1 -c copy $OUT/n4part_%02d.aiff 2>/dev/null || true
python3 - <<PYEOF
import subprocess, os
def dur(f):
    out = subprocess.run([os.path.expanduser("~/bin/ffmpeg"), "-i", f], capture_output=True, text=True).stderr
    import re
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    return int(m.group(1))*3600 + int(m.group(2))*60 + float(m.group(3))
total = dur("$OUT/n4.aiff")
segs = [("demo_graph.mp4", "n4a"), ("demo_audit.mp4", "n4b"), ("demo_trace.mp4", "n4c")]
raw = [dur("$OUT/demo_graph.mp4"), dur("$OUT/demo_audit.mp4"), dur("$OUT/demo_trace.mp4")]
rs = sum(raw)
for (f, name), r in zip(segs, raw):
    share = total * (r / rs) + 0.5
    subprocess.run([os.path.expanduser("~/bin/ffmpeg"), "-y", "-i", f"$OUT/{f}",
                    "-i", "$OUT/n4.aiff", "-t", str(share), "-r", "30",
                    "-filter:v", "tpad=stop_mode=clone:stop_duration=60",
                    "-af", "atrim=0:%.2f" % share, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-ar", "44100", "-ac", "2", f"$OUT/s4{name}.mp4"],
                   capture_output=True)
PYEOF
still_seg $OUT/slide-07.png $OUT/n5.aiff $OUT/s5.mp4
still_seg $OUT/slide-09.png $OUT/n6.aiff $OUT/s6.mp4
still_seg $OUT/slide-10.png $OUT/n0.aiff $OUT/s7.mp4   # short closing replay over title card? no: use n0 trimmed
$FF -y -i $OUT/s7.mp4 -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac $OUT/s7b.mp4 2>/dev/null && mv $OUT/s7b.mp4 $OUT/s7.mp4

: > $OUT/list.txt
for seg in s0 s1 s2 s3 s4n4a s4n4b s4n4c s5 s6 s7; do
  printf "file '%s'\n" "$PWD/$OUT/$seg.mp4" >> $OUT/list.txt
done
$FF -y -f concat -safe 0 -i $OUT/list.txt -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 44100 -ac 2 herba_codex_pitch.mp4 2>/dev/null
echo "== final =="
$FF -i herba_codex_pitch.mp4 2>&1 | grep -E "Duration|stream" | head -3
