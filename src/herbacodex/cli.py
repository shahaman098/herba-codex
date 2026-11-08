"""Herba Codex CLI.

Commands:
  herba segment           segment raw corpora into entries
  herba run [--max N]     run the five-agent pipeline over entries
  herba build-kg          build and export the knowledge graph
  herba all               segment → run → build-kg
"""

from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from .kg.build import export
from .orchestrator import run
from .runtime.trace import TraceLogger
from .segment import segment_culpeper

app = typer.Typer(add_completion=False, help="Herba Codex agentic pipeline")
console = Console()
INTERIM = Path("data/interim")


@app.command()
def segment() -> None:
    entries = segment_culpeper()
    INTERIM.mkdir(parents=True, exist_ok=True)
    (INTERIM / "culpeper_entries.json").write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
    console.print(f"[green]segmented {len(entries)} entries[/green]")


@app.command(name="run")
def run_pipeline(max: int = typer.Option(0, "--max", help="limit entries (0=all)"),
                 workers: int = typer.Option(3, "--workers"),
                 interactive: bool = typer.Option(False, "--interactive",
                                                  help="agents drive their own tool loops"),
                 shuffle_remaining: bool = typer.Option(False, "--shuffle-remaining",
                                                        help="process not-yet-done entries in random order"),
                 seed: int = typer.Option(42, "--seed"),
                 run_id: str = typer.Option("", help="reuse a trace run id")) -> None:
    entries = json.loads((INTERIM / "culpeper_entries.json").read_text(encoding="utf-8"))
    if shuffle_remaining:
        import random
        done = {f.stem for f in Path("data/processed/entries").glob("*.json")}
        rest = [e for e in entries if e["id"] not in done]
        done_e = [e for e in entries if e["id"] in done]
        random.Random(seed).shuffle(rest)
        entries = done_e + rest
    trace = TraceLogger(run_id or None)
    console.print(f"[bold]run {trace.run_id}[/bold] — {min(max, len(entries)) if max else len(entries)} entries")
    results = run(entries, trace, max_entries=max, workers=workers, interactive=interactive)
    trace.close()
    table = Table(title="pipeline complete")
    for k, v in _quick_stats(results).items():
        table.add_row(k, str(v))
    console.print(table)


@app.command(name="build-kg")
def build_kg() -> None:
    entries = _load_processed()
    summary = export(entries)
    console.print_json(json.dumps(summary))


@app.command()
def all(max: int = typer.Option(0, "--max")) -> None:
    segment()
    run_pipeline(max=max)
    build_kg()


def _load_processed() -> list[dict]:
    out = []
    for f in sorted(Path("data/processed/entries").glob("*.json")):
        try:
            out.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            continue
    return out


def _quick_stats(results: list[dict]) -> dict:
    res = [r for e in results for r in e.get("resolutions", [])]
    grades: dict[str, int] = {}
    for e in results:
        g = (e.get("concordance") or {}).get("grade", "-")
        grades[g] = grades.get(g, 0) + 1
    return {"entries": len(results), "resolved": sum(1 for r in res if r.get("status") == "resolved"),
            "ambiguous": sum(1 for r in res if r.get("status") == "ambiguous"),
            "unresolved": sum(1 for r in res if r.get("status") == "unresolved"),
            "grades": grades}


if __name__ == "__main__":
    app()
