"""Corpus segmentation: raw public-domain text → remedy entries.

Culpeper's Complete Herbal (Gutenberg #49513, the 1850 "new edition"): the
herbal proper is an alphabetical run of ALL-CAPS headings between the front
matter and the 'KEY TO PHYSIC' sections. We segment on the heading pattern
and keep exact character offsets so every downstream claim can cite its
source span.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

RAW = Path("data/raw")
OUT = Path("data/interim")

CULPEPER_FILE = RAW / "culpeper_complete_herbal_gutenberg49513.txt"
CULPEPER_WORK = ("Nicholas Culpeper, The Complete Herbal (with The English Physician "
                 "Enlarged), new edn. 1850 — Project Gutenberg eBook #49513, public domain")

_HEADING = re.compile(r"^\s{2,}([A-Z][A-Z,\.()'\- ]+)\.\s*$")
_SKIP_HEADINGS = {"SECTION I.", "SECTION II.", "SECTION III.", "SECTION IV.",
                  "SECTION V.", "SECTION VI.", "FINIS."}


def segment_culpeper() -> list[dict]:
    text = CULPEPER_FILE.read_text(encoding="utf-8")
    lines = text.split("\n")
    # body bounds
    start = next(i for i, l in enumerate(lines) if "AMARA DULCIS" in l)
    end = next(i for i, l in enumerate(lines) if l.strip().startswith("SECTION I.") and i > start)
    heads: list[tuple[int, str]] = []
    for i in range(start, end):
        m = _HEADING.match(lines[i])
        if m and m.group(1).strip() not in _SKIP_HEADINGS and len(m.group(1)) > 3:
            heads.append((i, m.group(1).strip()))
    entries = []
    offsets = [0]
    for l in lines:
        offsets.append(offsets[-1] + len(l) + 1)
    for n, (i, head) in enumerate(heads):
        j = heads[n + 1][0] if n + 1 < len(heads) else end
        body = "\n".join(lines[i + 1:j]).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if len(body) < 120:  # plates or stubs
            continue
        entries.append({
            "id": f"culpeper_{n:03d}",
            "locator": {
                "corpus": "culpeper", "work": CULPEPER_WORK, "heading": head.title(),
                "book": "", "chapter": "",
                "char_start": offsets[i], "char_end": offsets[j - 1] + len(lines[j - 1]),
                "char_span_url": f"https://www.gutenberg.org/files/49513/49513-h/49513-h.htm",
            },
            "source_text": body[:6000],
        })
    return entries


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    entries = segment_culpeper()
    (OUT / "culpeper_entries.json").write_text(
        json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"segmented {len(entries)} Culpeper entries")


if __name__ == "__main__":
    main()
