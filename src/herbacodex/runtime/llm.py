"""LLM transport layer.

Provider-agnostic with one special case that matters for reproducibility:
when the endpoint is Ollama we call the native /api/chat with `think: false`
(Qwen3-family "thinking" models otherwise burn the token budget on hidden
reasoning and return empty content through the OpenAI-compatible route).
Any other OpenAI-compatible endpoint (Gemini, OpenAI, OpenRouter, vLLM...)
works through the standard client with zero code changes.
"""

from __future__ import annotations

import os
from functools import lru_cache

import httpx
from openai import OpenAI


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


@lru_cache(maxsize=1)
def _settings() -> dict:
    return {
        "base_url": _env("LLM_BASE_URL", "http://localhost:11434/v1"),
        "api_key": _env("LLM_API_KEY", "ollama"),
        "default_model": _env("LLM_MODEL", "qwen3.5:9b"),
    }


def model_for(model_key: str | None) -> str:
    s = _settings()
    model = _env(f"LLM_MODEL_{model_key.upper()}") if model_key else ""
    return model or s["default_model"]


def _is_ollama() -> bool:
    return "localhost:11434" in _settings()["base_url"] or "127.0.0.1:11434" in _settings()["base_url"]


@lru_cache(maxsize=4)
def client_for(model_key: str | None = None) -> tuple[OpenAI, str]:
    s = _settings()
    client = OpenAI(base_url=s["base_url"], api_key=s["api_key"])
    return client, model_for(model_key)


def complete_messages(model: str, messages: list[dict], max_tokens: int) -> dict:
    """One completion. Returns {'text', 'usage'}. Transport chosen by endpoint."""
    if _is_ollama():
        return _ollama_complete(model, messages, max_tokens)
    return _openai_complete(model, messages, max_tokens)


def _ollama_complete(model: str, messages: list[dict], max_tokens: int) -> dict:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "think": False,                     # Qwen3-family: disable hidden reasoning
        "format": "json",                   # structured output
        "options": {"num_ctx": 8192, "num_predict": max_tokens, "temperature": 0.1},
    }
    try:
        r = httpx.post("http://localhost:11434/api/chat", json=payload, timeout=300.0)
        r.raise_for_status()
        d = r.json()
    except Exception as exc:  # noqa: BLE001
        return {"text": "", "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": f"{type(exc).__name__}: {exc}"}
    msg = d.get("message", {})
    return {
        "text": msg.get("content") or "",
        "usage": {
            "prompt_tokens": d.get("prompt_eval_count", 0),
            "completion_tokens": d.get("eval_count", 0),
        },
    }


def _openai_complete(model: str, messages: list[dict], max_tokens: int) -> dict:
    client, _ = client_for()
    try:
        resp = client.chat.completions.create(
            model=model, messages=messages, temperature=0.1,
            max_tokens=max_tokens, response_format={"type": "json_object"})
        text = resp.choices[0].message.content or ""
    except Exception:
        try:
            resp = client.chat.completions.create(
                model=model, messages=messages, temperature=0.1, max_tokens=max_tokens)
            text = resp.choices[0].message.content or ""
        except Exception as exc:  # noqa: BLE001
            return {"text": "", "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                    "error": f"{type(exc).__name__}: {exc}"}
    usage = getattr(resp, "usage", None)
    return {
        "text": text,
        "usage": {
            "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
            "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
        },
    }
