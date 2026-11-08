"""Agent base class.

A Herba Codex agent is a named specialist with a role card, a per-agent
model, and an explicit tool set. Tool-using agents act through a JSON
ReAct loop in which each step may issue MULTIPLE tool calls (fewer LLM
round trips — important for local models). Tool-less agents run in
`simple` mode: one schema-guided call. Every step is traced. The runtime
is deliberately small (~200 lines), auditable, and reproducible on any
OpenAI-compatible endpoint.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Callable

from pydantic import BaseModel, ValidationError

from .trace import TraceLogger


@dataclass
class Tool:
    name: str
    description: str
    args_schema: dict  # JSON schema for the "args" object
    fn: Callable[[dict], dict]


@dataclass
class Agent:
    name: str
    model_key: str
    system_prompt: str
    tools: dict[str, Tool] = field(default_factory=dict)
    max_steps: int = 6
    max_tokens: int = 2400

    # ------------------------------------------------------------------ run

    def run(self, task: str, trace: TraceLogger, **meta) -> dict:
        if not self.tools:
            return self._run_simple(task, trace, **meta)
        return self._run_loop(task, trace, **meta)

    def _run_simple(self, task: str, trace: TraceLogger, **meta) -> dict:
        with trace.span("agent_run", agent=self.name, mode="simple", **meta):
            from .llm import client_for

            client, model = client_for(self.model_key)
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": task},
            ]
            raw = self._complete(client, model, messages)
            trace.log("llm_call", {"agent": self.name, "model": model, "usage": raw["usage"],
                                   "response_preview": raw["text"][:3000]}, agent=self.name)
            parsed = self._parse_json(raw["text"])
            if parsed is None:
                trace.log("agent_failed", {"agent": self.name, "reason": "unparseable"})
                return {}
            trace.log("agent_final", {"agent": self.name, "payload": parsed}, agent=self.name)
            return parsed

    def _run_loop(self, task: str, trace: TraceLogger, **meta) -> dict:
        messages = [
            {"role": "system", "content": f"{self.system_prompt}\n\n{self._tools_block()}\n\n{self._step_format()}"},
            {"role": "user", "content": task},
        ]
        with trace.span("agent_run", agent=self.name, mode="loop", **meta):
            for step_no in range(1, self.max_steps + 1):
                from .llm import client_for

                client, model = client_for(self.model_key)
                raw = self._complete(client, model, messages)
                trace.log("llm_call", {"agent": self.name, "step": step_no, "model": model,
                                       "usage": raw["usage"],
                                       "response_preview": raw["text"][:2000]}, agent=self.name)
                parsed = self._parse_json(raw["text"])
                if parsed is None:
                    messages.append({"role": "user", "content": "Invalid JSON. " + self._step_format()})
                    continue
                action = parsed.get("action")
                if action in ("tool", "tools"):
                    calls = parsed.get("calls") if action == "tools" else [
                        {"tool": parsed.get("tool"), "args": parsed.get("args") or {}}]
                    results = self._exec_tools(calls or [], trace)
                    messages.append({"role": "assistant", "content": json.dumps(parsed)})
                    messages.append({
                        "role": "user",
                        "content": "TOOL_RESULTS: " + json.dumps(results, ensure_ascii=False)[:6000]
                                   + "\n\nIf you have everything you need, finish with "
                                     '{"action": "final", "payload": {...}}. ' + self._step_format()})
                    continue
                if action == "final":
                    trace.log("agent_final", {"agent": self.name, "payload": parsed.get("payload") or {}},
                              agent=self.name)
                    return parsed.get("payload") or {}
                messages.append({"role": "user", "content": "Unknown action. " + self._step_format()})
            trace.log("agent_failed", {"agent": self.name, "reason": "max_steps"})
            return {}

    # ------------------------------------------------------------------ bits

    def _tools_block(self) -> str:
        lines = ["Tools available (you may call SEVERAL per step):"]
        for t in self.tools.values():
            lines.append(f'- {t.name}: {t.description} args={json.dumps(t.args_schema)}')
        return "\n".join(lines)

    def _step_format(self) -> str:
        return ('Respond with ONE JSON object only, either:\n'
                '{"thought": "...", "action": "tools", "calls": [{"tool": "<name>", "args": {..}}, ...]}\n'
                'or:\n'
                '{"thought": "...", "action": "final", "payload": {..}}\n'
                'No prose outside the JSON.')

    def _complete(self, client, model: str, messages: list[dict]) -> dict:
        from .llm import complete_messages

        return complete_messages(model, messages, self.max_tokens)

    def _parse_json(self, text: str) -> dict | None:
        # strip think blocks, then try direct parse, then brace-matched extraction
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

    def _exec_tools(self, calls: list[dict], trace: TraceLogger) -> list[dict]:
        out = []
        for call in calls[:4]:
            name = call.get("tool", "")
            tool = self.tools.get(name)
            if tool is None:
                out.append({"tool": name, "error": "unknown tool"})
                continue
            try:
                with trace.span("tool_call", agent=self.name, tool=name):
                    result = tool.fn(call.get("args") or {})
            except Exception as exc:  # noqa: BLE001
                result = {"error": f"{type(exc).__name__}: {exc}"}
            trace.log("tool_result", {"agent": self.name, "tool": name, "result": result},
                      agent=self.name)
            out.append({"tool": name, "result": result})
        return out


def validate(payload: dict, schema: type[BaseModel]) -> tuple[BaseModel | None, str | None]:
    try:
        return schema.model_validate(payload), None
    except ValidationError as exc:
        return None, str(exc)[:300]
