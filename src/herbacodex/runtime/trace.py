"""JSONL trace logging.

Every agent start/finish, LLM call and tool call is appended to a run-scoped
JSONL file. The web app's "Agent Trace" view replays these files, which is
how the demo shows *why* the system produced each claim, not just *what* it
produced. Traces double as our provenance layer for AI-in-the-loop steps.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone


class TraceLogger:
    def __init__(self, run_id: str | None = None, trace_dir: str = "trace"):
        self.run_id = run_id or f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        os.makedirs(trace_dir, exist_ok=True)
        self.path = os.path.join(trace_dir, f"{self.run_id}.jsonl")
        self._fh = open(self.path, "a", encoding="utf-8")
        self.log("run_start", {})

    def log(self, kind: str, payload: dict, **meta) -> dict:
        event = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "run_id": self.run_id,
            "kind": kind,
            **meta,
            "payload": payload,
        }
        self._fh.write(json.dumps(event, ensure_ascii=False, default=str) + "\n")
        self._fh.flush()
        return event

    def span(self, kind: str, **meta):
        return _Span(self, kind, **meta)

    def close(self) -> None:
        self.log("run_end", {})
        self._fh.close()


class _Span:
    def __init__(self, logger: TraceLogger, kind: str, **meta):
        self.logger = logger
        self.kind = kind
        self.meta = meta
        self.t0 = time.perf_counter()
        self.logger.log(kind + "_start", {}, **self.meta)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        payload = {"latency_ms": round((time.perf_counter() - self.t0) * 1000)}
        if exc is not None:
            payload["error"] = f"{type(exc).__name__}: {exc}"
        self.logger.log(self.kind + "_end", payload, **self.meta)
        return False
