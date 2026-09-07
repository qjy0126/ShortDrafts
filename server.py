#!/usr/bin/env python3
"""Local server: static site + Agnes-backed generate API."""

from __future__ import annotations

import json
import os
import re
import threading
import urllib.error
import urllib.request
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
USAGE_PATH = DATA_DIR / "usage.json"
BLOCKED = {".env", ".gitignore"}
FREE_LIMIT = 10
USAGE_LOCK = threading.Lock()

FIELD_SPECS = {
    "ideas": "exactly 3 short video ideas as a JSON array of strings",
    "hooks": "exactly 5 scroll-stopping hooks as a JSON array of strings",
    "script": "one spoken script as a JSON string, timed for the requested length",
    "titles": "exactly 5 titles as a JSON array of strings",
    "caption": "one post caption as a JSON string",
    "cta": "one spoken or on-screen call to action as a JSON string",
    "onscreen_text": "3 to 5 short 9:16 lines as a JSON array of strings",
}


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()

AGNES_API_KEY = os.environ.get("AGNES_API_KEY", "")
AGNES_BASE_URL = os.environ.get("AGNES_BASE_URL", "https://apihub.agnes-ai.com/v1").rstrip("/")
AGNES_MODEL = os.environ.get("AGNES_MODEL", "agnes-2.5-flash")
PORT = int(os.environ.get("PORT", "4173"))

SYSTEM_PROMPT = """You are a short-form content writer for YouTube Shorts, TikTok, and Instagram Reels.
Write a posting-ready content pack. Do not generate a video. Do not mention being an AI.
Return ONLY valid JSON in this exact shape, in this key order:
{
  "ideas": ["", "", ""],
  "hooks": ["", "", "", "", ""],
  "script": "full spoken script",
  "titles": ["", "", "", "", ""],
  "caption": "post caption",
  "cta": "call to action",
  "onscreen_text": ["", "", ""]
}
Rules:
- ideas: exactly 3
- hooks: exactly 5, under 16 words, first 3 seconds
- script: one spoken script matching the requested length, no stage directions
- titles: exactly 5
- caption: one caption, no hashtag dump in the caption string
- cta: one line
- onscreen_text: 3-5 short lines for 9:16, all caps ok
Match the platform, style, and length. Sound spoken, not bloggy.
"""


def extract_json(text: str) -> dict:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        text = fenced.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model did not return JSON")
    return json.loads(text[start : end + 1])


def match_quoted(text: str, start: int) -> int | None:
    if start >= len(text) or text[start] != '"':
        return None
    i = start + 1
    while i < len(text):
        ch = text[i]
        if ch == "\\":
            i += 2
            continue
        if ch == '"':
            return i
        i += 1
    return None


def match_bracket(text: str, start: int, open_ch: str, close_ch: str) -> int | None:
    depth = 0
    i = start
    in_str = False
    escape = False
    while i < len(text):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return None


def extract_field(text: str, key: str):
    token = f'"{key}"'
    idx = text.find(token)
    if idx == -1:
        return None
    colon = text.find(":", idx + len(token))
    if colon == -1:
        return None
    i = colon + 1
    while i < len(text) and text[i] in " \n\r\t":
        i += 1
    if i >= len(text):
        return None
    if text[i] == "[":
        end = match_bracket(text, i, "[", "]")
        if end is None:
            return None
        return json.loads(text[i : end + 1])
    if text[i] == '"':
        end = match_quoted(text, i)
        if end is None:
            return None
        return json.loads(text[i : end + 1])
    return None


def normalize_pack(raw: dict) -> dict:
    script = raw.get("script")
    if isinstance(script, dict):
        script = script.get("spoken") or ""
    return {
        "ideas": list(raw.get("ideas") or [])[:3],
        "hooks": list(raw.get("hooks") or [])[:5],
        "script": script or "",
        "titles": list(raw.get("titles") or [])[:5],
        "caption": raw.get("caption") or "",
        "cta": raw.get("cta") or "",
        "onscreen_text": list(raw.get("onscreen_text") or raw.get("on_screen_text") or []),
    }


def usage_payload() -> dict:
    if not USAGE_PATH.exists():
        return {}
    try:
        return json.loads(USAGE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def remaining_for(ip: str) -> int:
    today = date.today().isoformat()
    with USAGE_LOCK:
        data = usage_payload()
        row = data.get(ip) or {}
        if row.get("date") != today:
            return FREE_LIMIT
        return max(0, FREE_LIMIT - int(row.get("count") or 0))


def consume_quota(ip: str) -> tuple[bool, int]:
    today = date.today().isoformat()
    with USAGE_LOCK:
        DATA_DIR.mkdir(exist_ok=True)
        data = usage_payload()
        row = data.get(ip) or {"date": today, "count": 0}
        if row.get("date") != today:
            row = {"date": today, "count": 0}
        if int(row["count"]) >= FREE_LIMIT:
            data[ip] = row
            USAGE_PATH.write_text(json.dumps(data), encoding="utf-8")
            return False, 0
        row["count"] = int(row["count"]) + 1
        data[ip] = row
        USAGE_PATH.write_text(json.dumps(data), encoding="utf-8")
        return True, max(0, FREE_LIMIT - row["count"])


def refund_quota(ip: str) -> None:
    today = date.today().isoformat()
    with USAGE_LOCK:
        if not USAGE_PATH.exists():
            return
        data = usage_payload()
        row = data.get(ip) or {}
        if row.get("date") != today:
            return
        row["count"] = max(0, int(row.get("count") or 0) - 1)
        data[ip] = row
        USAGE_PATH.write_text(json.dumps(data), encoding="utf-8")


def client_ip(handler: SimpleHTTPRequestHandler) -> str:
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def agnes_request(payload: dict, stream: bool = False):
    if not AGNES_API_KEY:
        raise RuntimeError("AGNES_API_KEY is missing")
    req = urllib.request.Request(
        f"{AGNES_BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {AGNES_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    return urllib.request.urlopen(req, timeout=90)


def stream_content(payload: dict):
    payload = dict(payload)
    payload["stream"] = True
    try:
        resp = agnes_request(payload, stream=True)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Agnes HTTP {exc.code}: {detail[:400]}") from exc
    with resp:
        buf = ""
        for raw in resp:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue
            delta = ((chunk.get("choices") or [{}])[0].get("delta") or {})
            piece = delta.get("content") or ""
            if piece:
                buf += piece
                yield buf
        if buf:
            yield buf


def complete_content(payload: dict) -> str:
    payload = dict(payload)
    payload.pop("stream", None)
    try:
        with agnes_request(payload) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Agnes HTTP {exc.code}: {detail[:400]}") from exc
    message = (body.get("choices") or [{}])[0].get("message") or {}
    content = (message.get("content") or "").strip()
    if not content:
        raise RuntimeError("Agnes returned an empty response")
    return content


def pack_payload(topic: str, platform: str, style: str, length: str) -> dict:
    return {
        "model": AGNES_MODEL,
        "temperature": 0.7,
        "max_tokens": 4096,
        "chat_template_kwargs": {"enable_thinking": False},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Topic: {topic}\n"
                    f"Platform: {platform}\n"
                    f"Style: {style}\n"
                    f"Length: {length}\n"
                    "Write the full content pack now as JSON."
                ),
            },
        ],
    }


def regen_payload(field: str, topic: str, platform: str, style: str, length: str, pack: dict) -> dict:
    spec = FIELD_SPECS[field]
    return {
        "model": AGNES_MODEL,
        "temperature": 0.8,
        "max_tokens": 1200,
        "chat_template_kwargs": {"enable_thinking": False},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Rewrite only one field of a Shorts content pack. "
                    "Return ONLY JSON: {\"value\": ...}. "
                    f"The value must be {spec}. Do not repeat the other fields."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "topic": topic,
                        "platform": platform,
                        "style": style,
                        "length": length,
                        "field": field,
                        "current_pack": pack,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        data = self._read_json()
        if data is None:
            return
        if path == "/api/generate":
            self._generate(data)
            return
        if path == "/api/regenerate":
            self._regenerate(data)
            return
        self._json(404, {"error": "Not found"})

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 20000:
            self._json(413, {"error": "Request too large"})
            return None
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON"})
            return None

    def _brief(self, data: dict):
        topic = str(data.get("topic") or "").strip()
        platform = str(data.get("platform") or "YouTube Shorts").strip()
        style = str(data.get("style") or "explainer").strip()
        length = str(data.get("length") or "30-45 seconds").strip()
        if not topic:
            self._json(400, {"error": "Enter a topic first"})
            return None
        if len(topic) > 500:
            self._json(400, {"error": "Topic is too long"})
            return None
        return topic, platform, style, length

    def _generate(self, data: dict) -> None:
        brief = self._brief(data)
        if not brief:
            return
        topic, platform, style, length = brief
        ip = client_ip(self)
        ok, left = consume_quota(ip)
        if not ok:
            self._json(
                429,
                {
                    "error": f"Free limit reached: {FREE_LIMIT} generations per day. Come back tomorrow.",
                    "remaining": 0,
                },
            )
            return

        try:
            raw = complete_content(pack_payload(topic, platform, style, length))
            pack = normalize_pack(extract_json(raw))
            self._json(200, {**pack, "remaining": left, "limit": FREE_LIMIT})
        except (BrokenPipeError, ConnectionResetError):
            refund_quota(ip)
        except Exception as exc:
            refund_quota(ip)
            self.log_error("generate failed: %s", exc)
            try:
                self._json(502, {"error": str(exc), "remaining": remaining_for(ip)})
            except (BrokenPipeError, ConnectionResetError, OSError):
                return

    def _regenerate(self, data: dict) -> None:
        brief = self._brief(data)
        if not brief:
            return
        field = str(data.get("field") or "").strip()
        if field not in FIELD_SPECS:
            self._json(400, {"error": "Unknown field"})
            return
        ip = client_ip(self)
        ok, left = consume_quota(ip)
        if not ok:
            self._json(
                429,
                {
                    "error": f"Free limit reached: {FREE_LIMIT} generations per day. Come back tomorrow.",
                    "remaining": 0,
                },
            )
            return
        topic, platform, style, length = brief
        pack = data.get("pack") if isinstance(data.get("pack"), dict) else {}
        try:
            raw = complete_content(regen_payload(field, topic, platform, style, length, pack))
            parsed = extract_json(raw)
            value = parsed.get("value", parsed.get(field))
            if value is None:
                raise RuntimeError("Could not regenerate that field")
            self._json(200, {"field": field, "value": value, "remaining": left})
        except Exception as exc:
            self.log_error("regenerate failed: %s", exc)
            self._json(502, {"error": str(exc)})

    def _sse(self, payload: dict) -> None:
        blob = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
        try:
            self.wfile.write(blob)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def translate_path(self, path: str) -> str:
        translated = super().translate_path(path)
        resolved = Path(translated)
        if resolved.name in BLOCKED or "data" in resolved.parts:
            return str(ROOT / "__blocked__")
        return translated

    def _json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError, OSError):
            return


if __name__ == "__main__":
    if not AGNES_API_KEY:
        raise SystemExit("Missing AGNES_API_KEY in .env")
    DATA_DIR.mkdir(exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving http://127.0.0.1:{PORT}")
    httpd.serve_forever()
