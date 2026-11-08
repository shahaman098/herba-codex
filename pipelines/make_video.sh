#!/bin/bash
# Herba Codex — automated pitch-video assembly.
# Produces a <=10:00 video from: narration (macOS TTS), slide renders,
# screen-captured demo segments, title cards, and a music-free mix.
# Usage: pipelines/make_video.sh [--voice Samantha]
set -euo pipefail
cd "$(dirname "$0")/../docs/pitch"
FF=~/bin/ffmpeg
VOICE="${1:-Samantha}"
OUT=video_build
mkdir -p $OUT

# ---------------------------------------------------------------- helpers
say_to() { # text, outfile
  say -v "$VOICE" -o "$2" --data-format=LEF32@44100 "$1" 2>/dev/null
}
dur() { $FF -i "$1" 2>&1 | grep Duration | awk '{print $2}' | tr -d , | awk -F: '{print $1*3600+$2*60+$3}'; }

# ---------------------------------------------------------------- 0. narration
echo "== narration =="
say_to "In sixteen fifty-three, Nicholas Culpeper told England that comfrey heals all inward wounds, and knits together broken bones. Three hundred and seventy years later, the European Medicines Agency restricts comfrey. Two claims. One plant. Centuries apart. Ethno pharmacology lives in this gap, and the gap is uncomputed. Historical herbals are a vast record of how Europe actually used plants as medicine, and the field's own literature names the bottleneck: semantic extraction from legacy texts. We built the bridge. This is Herba Codex." $OUT/n1.aiff
say_to "Our corpus: Culpeper's Complete Herbal. Two hundred ninety seven remedy entries, public domain, segmented with exact character offsets, so every claim cites its place in the text. Identity comes from Kew's Plants of the World Online, and G B I F. Evidence comes from E U herbal monographs, PubMed, and PubChem. Every source, its licence, and how we access it, is documented in the repo. And we never present computational findings as medical facts. Our system grades agreement, not therapies." $OUT/n2.aiff
say_to "Herba Codex is an agentic pipeline. Five specialist agents under a deterministic orchestrator. The Historian extracts every claim exactly as the text states it, backed by verbatim quotes. The Botanist resolves historical names to modern taxonomy using Kew P O W O and G B I F as tools, not vibes, with calibrated confidence. The Pharmacologist links each plant to modern evidence. The Evidence Scorer grades concordance, A through D, plus X for cannot grade honestly. And the Auditor, an adversarial gate, verifies every quote mechanically. Failed entries stay in the dataset, flagged. Hiding failures would defeat the purpose. Everything runs on a local model, fully reproducible, zero cost." $OUT/n3.aiff
say_to "Three views, one story. The Graph Explorer: a provenance carrying knowledge graph, every edge with its quote, agent, and confidence. The Historian's Audit Desk: the source text and every extracted claim, side by side. And the Agent Trace Viewer: the actual log of the run you are looking at. Every L L M call, every tool call, with latency and token counts. In an age of black box A I, we show you the whole machine." $OUT/n4.aiff
say_to "Validation, not vibes. We hand curated a thirty entry gold set spanning the alphabet. Taxonomic resolution accuracy, with bootstrap confidence intervals. Confidence calibration, by bin. And quote integrity: the share of extracted quotes that appear verbatim in the source. That is the difference between a language model, and an instrument. The ablation: a single unaided L L M call, versus the five agent pipeline, on the same gold set, with the same model. The architecture is the result." $OUT/n5.aiff
say_to "We will say it ourselves, before anyone else does. Culpeper is a derivative of Dioscorides and Galen. A nine B local model limits extraction depth, by design, for reproducibility. The gold set is thirty entries. Traditional use statements are historical records, not recommendations, and the app says so on every screen. Next: more corpora. Pliny's medical books are already segmented. Multilingual name resolution. Community gold sets. Publication grade exports for the EthCSTWIN platform. Two millennia of claims. One audited pipeline. Evidence, not verdicts. The repo is on screen. Thank you." $OUT/n6.aiff

# ---------------------------------------------------------------- 1. slide segments
echo "== slide renders =="
[ -f herba_codex_deck.pdf ] || /Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf --outdir . herba_codex_deck.pptx
pdftoppm -png -r 120 herba_codex_deck.pdf $OUT/slide
# demo segments recorded separately (see DEMO capture step); placeholders:
# $OUT/demo1.mov (graph explorer), demo2.mov (audit desk), demo3.mov (trace viewer)

seg() { # image-or-video, narration, out
  local nd=$(dur "$2")
  if [[ "$1" == *.png ]]; then
    $FF -y -loop 1 -i "$1" -i "$2" -t "$nd" -r 30 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$3"
  else
    local vd=$(dur "$1"); local d=$(echo "$nd $vd" | awk '{print ($1>$2)?$2:$1}')
    $FF -y -i "$1" -i "$2" -t "$d" -c:v libx264 -pix_fmt yuv420p -c:a aac "$3"
  fi
}

echo "== segments =="
seg $OUT/slide-02.png $OUT/n1.aiff $OUT/p1.mp4   # problem
seg $OUT/slide-03.png $OUT/n2.aiff $OUT/p2.mp4   # data
seg $OUT/slide-04.png $OUT/n3.aiff $OUT/p3.mp4   # architecture
[ -f $OUT/demo1.mov ] && seg $OUT/demo1.mov $OUT/n4a.aiff $OUT/p4a.mp4 || true
seg $OUT/slide-06.png $OUT/n4.aiff $OUT/p4.mp4   # demo (or use recorded segments)
seg $OUT/slide-07.png $OUT/n5.aiff $OUT/p5.mp4   # validation
seg $OUT/slide-09.png $OUT/n6a.aiff $OUT/p6.mp4  # limitations (narration split)
seg $OUT/slide-10.png $OUT/n6.aiff  $OUT/p7.mp4  # close

echo "== concat =="
printf "file '%s'\n" $OUT/p1.mp4 $OUT/p2.mp4 $OUT/p3.mp4 $OUT/p4.mp4 $OUT/p5.mp4 $OUT/p6.mp4 $OUT/p7.mp4 > $OUT/list.txt
$FF -y -f concat -safe 0 -i $OUT/list.txt -c:v libx264 -pix_fmt yuv420p -c:a aac herba_codex_pitch.mp4
$FF -i herba_codex_pitch.mp4 2>&1 | grep Duration
echo "video: docs/pitch/herba_codex_pitch.mp4"
