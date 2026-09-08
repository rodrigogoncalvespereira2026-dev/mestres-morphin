#!/usr/bin/env python3
"""Mestres Morphin — servidor da IA de chat (só biblioteca padrão).

Serve o frontend em ./ai e expõe:
    GET  /api/masters          -> lista de Mestres + estado da configuração
    POST /api/chat             -> {masterId, messages} -> {reply}

Configuração (nunca comitada): ficheiro .env.local na raiz, ou variáveis
de ambiente (as variáveis de ambiente têm precedência):

    OPENAI_BASE_URL=https://api.openai.com/v1
    OPENAI_API_KEY=...
    OPENAI_MODEL=gpt-4o-mini

Uso:  python app.py [porta]     (porta por omissão: 8787 ou $PORT)
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent
FRONT = ROOT / "ai"
ENV_FILE = ROOT / ".env.local"

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

MASTERS = [
    {
        "id": "vermelho",
        "file": "mestre-vermelho.md",
        "name": "Mestre Morphin Vermelho",
        "short": "Vermelho",
        "color": "#e0463b",
        "status": "canónico",
        "voice": "pt-PT-DuarteNeural",
        "voiceName": "Duarte",
    },
    {
        "id": "rosa",
        "file": "mestre-rosa.md",
        "name": "Mestre Morphin Rosa",
        "short": "Rosa",
        "color": "#ef7fb0",
        "status": "canónico",
        "voice": "pt-PT-RaquelNeural",
        "voiceName": "Raquel",
    },
    {
        "id": "azul",
        "file": "mestre-azul.md",
        "name": "Mestre Morphin Azul",
        "short": "Azul",
        "color": "#4f86d6",
        "status": "canónico",
        "voice": "pt-PT-MiguelNeural",
        "voiceName": "Miguel",
    },
    {
        "id": "verde",
        "file": "mestre-verde.md",
        "name": "Mestre Morphin Verde",
        "short": "Verde",
        "color": "#58a85e",
        "status": "canónico",
        "voice": "pt-BR-AntonioNeural",
        "voiceName": "Antonio",
    },
    {
        "id": "preto",
        "file": "mestre-preto.md",
        "name": "Mestre Morphin Preto",
        "short": "Preto",
        "color": "#9aa0a8",
        "status": "canónico",
        "voice": "pt-PT-EuclidesNeural",
        "voiceName": "Euclides",
    },
    {
        "id": "dourado",
        "file": "mestre-dourado.md",
        "name": "Mestre Morphin Dourado",
        "short": "Dourado",
        "color": "#f0c94f",
        "status": "canónico",
        "voice": "pt-BR-FranciscaNeural",
        "voiceName": "Francisca",
    },
]

MASTER_BY_ID = {m["id"]: m for m in MASTERS}


def load_env_file() -> dict:
    env: dict = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


_FILE_ENV = load_env_file()


def cfg(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name) or _FILE_ENV.get(name)
    return value if value not in (None, "") else default


BASE_URL = cfg("OPENAI_BASE_URL", "https://api.openai.com/v1") or ""
API_KEY = cfg("OPENAI_API_KEY") or ""
MODEL = cfg("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
TIMEOUT = 150

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


def read_prompt(master_id: str) -> str:
    master = MASTER_BY_ID[master_id]
    path = ROOT / master["file"]
    return path.read_text(encoding="utf-8")


def call_llm(system_prompt: str, history: list[dict]) -> str:
    if not API_KEY:
        raise ConfigError("missing_key", "OPENAI_API_KEY não está definida. Cria o ficheiro .env.local na raiz do projeto (ver README) e reinicia o servidor.")
    url = (BASE_URL.rstrip("/") or "https://api.openai.com/v1") + "/chat/completions"
    messages = [{"role": "system", "content": system_prompt}] + history
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = json.loads(exc.read().decode("utf-8", "replace"))
        except Exception:
            pass
        msg = "erro do fornecedor"
        if isinstance(detail, dict):
            msg = (
                detail.get("error", {}).get("message")
                if isinstance(detail.get("error"), dict)
                else detail.get("message")
            ) or msg
        print(f"[groq] HTTP {exc.code}: {msg}", flush=True)
        raise ConfigError("provider", f"HTTP {exc.code}: {msg}") from exc
    except urllib.error.URLError as exc:
        raise ConfigError("network", f"Sem ligação ao fornecedor ({exc.reason}). Verifica OPENAI_BASE_URL.") from exc
    except json.JSONDecodeError as exc:
        raise ConfigError("provider", "Resposta inválida do fornecedor (JSON inválido).") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ConfigError("provider", "Resposta inesperada do fornecedor (sem choices).") from exc


class ConfigError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class Handler(BaseHTTPRequestHandler):
    server_version = "MestresMorphin/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args), flush=True)

    # ---- helpers -------------------------------------------------------
    def _cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send(self, status: int, body: bytes, ctype: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj) -> None:
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _config_info(self) -> dict:
        return {
            "configured": bool(API_KEY),
            "model": MODEL,
            "base": BASE_URL or "https://api.openai.com/v1",
        }

    # ---- GET -----------------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802
        from urllib.parse import unquote, urlparse

        path = unquote(urlparse(self.path).path)
        if path == "/api/masters":
            self._json(
                200,
                {
                    "masters": MASTERS,
                    "config": self._config_info(),
                },
            )
            return
        # static frontend
        if path in ("/", "/index.html"):
            rel = "index.html"
        else:
            rel = path.lstrip("/")
        target = (FRONT / rel).resolve()
        try:
            target.relative_to(FRONT.resolve())
        except ValueError:
            self._json(404, {"error": "não encontrado"})
            return
        if not target.is_file():
            self._json(404, {"error": "não encontrado"})
            return
        ctype = CONTENT_TYPES.get(target.suffix.lower(), "application/octet-stream")
        self._send(200, target.read_bytes(), ctype)

    # ---- POST ----------------------------------------------------------
    def do_POST(self) -> None:  # noqa: N802
        from urllib.parse import urlparse

        if urlparse(self.path).path != "/api/chat":
            self._json(404, {"error": "não encontrado"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > 1_000_000:
            self._json(400, {"error": "pedido inválido"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._json(400, {"error": "JSON inválido"})
            return

        master_id = body.get("masterId")
        messages = body.get("messages")
        if master_id not in MASTER_BY_ID:
            self._json(400, {"error": f"Mestre desconhecido: {master_id!r}"})
            return
        if not isinstance(messages, list) or not messages:
            self._json(400, {"error": "sem mensagens"})
            return

        clean: list[dict] = []
        for m in messages[-24:]:
            role = m.get("role")
            content = m.get("content")
            if role not in ("user", "assistant") or not isinstance(content, str):
                self._json(400, {"error": "mensagem inválida"})
                return
            clean.append({"role": role, "content": content[:4000]})

        try:
            system_prompt = read_prompt(master_id)
            reply = call_llm(system_prompt, clean)
        except ConfigError as exc:
            self._json(502 if exc.code != "missing_key" else 503, {"error": exc.message, "code": exc.code})
            return
        except Exception as exc:  # inesperado — não deixar morrer o servidor
            print(f"[erro] {exc!r}", flush=True)
            self._json(500, {"error": f"Erro interno: {exc}"})
            return

        self._json(200, {"reply": reply})


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8787"))
    host = os.environ.get("BIND_HOST", "0.0.0.0") if os.environ.get("RENDER") else "0.0.0.0"
    httpd = ThreadingHTTPServer((host, port), Handler)
    httpd.daemon_threads = True
    print(f"Mestres Morphin AI a ouvir em http://{host}:{port}", flush=True)
    print(f"modelo={MODEL} base={BASE_URL} configurado={bool(API_KEY)}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
