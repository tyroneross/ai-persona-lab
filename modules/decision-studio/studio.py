"""Serve Decision Studio setup and persist one review request on loopback."""

import argparse
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
ASSET = ROOT / "assets" / "setup.html"
TEMPLATES = ROOT / "templates.json"
WRITE_LOCK = threading.Lock()
MAX_BODY = 256_000
HISTORY_NAME = "history"
HISTORY_FILE = re.compile(r"revision-(\d+)\.json\Z")


def _text(value, field, *, required=False, maximum=4_000, strip=True):
    if not isinstance(value, str):
        raise ValueError(field)
    if strip:
        value = value.strip()
    if required and not value.strip():
        raise ValueError(field)
    if len(value) > maximum:
        raise ValueError(field)
    return value


def validate_request(data):
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("version")
    template_ids = {item["id"] for item in json.loads(TEMPLATES.read_text())["templates"]}
    template_id = data.get("templateId")
    if template_id not in template_ids:
        raise ValueError("templateId")
    mode = data.get("mode")
    if mode not in {"request-reviews", "compare-existing"}:
        raise ValueError("mode")
    base_revision = data.get("baseRevision")
    if not isinstance(base_revision, int) or isinstance(base_revision, bool) or base_revision < 0:
        raise ValueError("baseRevision")

    source_refs = data.get("sourceRefs")
    if not isinstance(source_refs, list) or len(source_refs) > 50:
        raise ValueError("sourceRefs")
    source_refs = [_text(value, "sourceRefs", maximum=2_000) for value in source_refs]
    if any(not value for value in source_refs):
        raise ValueError("sourceRefs")

    roles = data.get("roles")
    if not isinstance(roles, list) or len(roles) > 30:
        raise ValueError("roles")
    clean_roles = []
    for role in roles:
        if not isinstance(role, dict) or not isinstance(role.get("selected"), bool):
            raise ValueError("roles")
        clean_roles.append({
            "label": _text(role.get("label"), "roles", required=True, maximum=120),
            "brief": _text(role.get("brief", ""), "roles", maximum=1_000),
            "selected": role["selected"],
        })
    selected = [role["label"].casefold() for role in clean_roles if role["selected"]]
    if mode == "request-reviews" and (len(selected) < 2 or len(selected) != len(set(selected))):
        raise ValueError("Select at least two unique roles")

    alternatives = data.get("alternatives", [])
    if not isinstance(alternatives, list) or len(alternatives) > 20:
        raise ValueError("alternatives")
    clean_alternatives = []
    for alternative in alternatives:
        if not isinstance(alternative, dict):
            raise ValueError("alternatives")
        item = {
            "label": _text(alternative.get("label", ""), "alternatives", maximum=160),
            "sourceRef": _text(alternative.get("sourceRef", ""), "alternatives", maximum=2_000),
            "content": _text(alternative.get("content", ""), "alternatives", maximum=50_000, strip=False),
        }
        clean_alternatives.append(item)
    alternative_labels = [item["label"].casefold() for item in clean_alternatives]
    if mode == "compare-existing":
        complete = all(item["label"] and (item["sourceRef"] or item["content"].strip()) for item in clean_alternatives)
        if len(clean_alternatives) < 2 or not complete or len(alternative_labels) != len(set(alternative_labels)):
            raise ValueError("Provide at least two complete, unique alternatives")

    units = data.get("comparisonUnits")
    if not isinstance(units, list) or len(units) > 50:
        raise ValueError("comparisonUnits")
    clean_units = []
    for unit in units:
        if not isinstance(unit, dict) or not isinstance(unit.get("included"), bool):
            raise ValueError("comparisonUnits")
        clean_units.append({
            "label": _text(unit.get("label"), "comparisonUnits", required=True, maximum=160),
            "included": unit["included"],
        })
    labels = [unit["label"].casefold() for unit in clean_units]
    if len(labels) != len(set(labels)):
        raise ValueError("comparisonUnits")

    return {
        "version": 1,
        "mode": mode,
        "templateId": template_id,
        "title": _text(data.get("title"), "title", required=True, maximum=200),
        "question": _text(data.get("question"), "question", required=True, maximum=4_000),
        "sourceRefs": source_refs,
        "roles": clean_roles,
        "alternatives": clean_alternatives,
        "comparisonUnits": clean_units,
        "notes": _text(data.get("notes", ""), "notes", maximum=10_000),
        "baseRevision": base_revision,
    }


def private_write(path, text):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(text)


def history_path(data_dir, revision):
    return data_dir / HISTORY_NAME / f"revision-{revision}.json"


def ensure_history_dir(data_dir):
    directory = data_dir / HISTORY_NAME
    directory.mkdir(mode=0o700, exist_ok=True)
    directory.chmod(0o700)
    return directory


def archive_request(data_dir, request):
    """Create one immutable snapshot; an identical retry is a no-op."""
    revision = request.get("revision")
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
        raise ValueError("revision")
    directory = ensure_history_dir(data_dir)
    destination = history_path(data_dir, revision)
    payload = json.dumps(request, indent=2) + "\n"
    temporary = directory / f".revision-{revision}-{os.getpid()}-{threading.get_ident()}.tmp"
    private_write(temporary, payload)
    try:
        try:
            os.link(temporary, destination)
        except FileExistsError:
            if destination.read_text() != payload:
                raise RuntimeError(f"History revision {revision} already has different content")
        destination.chmod(0o600)
    finally:
        temporary.unlink(missing_ok=True)


def backfill_latest(data_dir):
    ensure_history_dir(data_dir)
    latest = data_dir / "review-request.json"
    if latest.exists():
        archive_request(data_dir, json.loads(latest.read_text()))


def replace_latest(data_dir, request, previous=None):
    if previous:
        private_write(data_dir / "review-request.previous.json", json.dumps(previous, indent=2) + "\n")
    temporary = data_dir / "review-request.tmp"
    private_write(temporary, json.dumps(request, indent=2) + "\n")
    os.replace(temporary, data_dir / "review-request.json")


def history_summary(data_dir):
    requests = []
    for path in ensure_history_dir(data_dir).iterdir():
        match = HISTORY_FILE.fullmatch(path.name)
        if not match:
            continue
        saved = json.loads(path.read_text())
        revision = int(match.group(1))
        if saved.get("revision") != revision:
            raise ValueError("revision")
        requests.append({key: saved[key] for key in ("revision", "title", "mode", "templateId", "savedAt")})
    requests.sort(key=lambda item: item["revision"])
    return {"requests": requests, "latestRevision": requests[-1]["revision"] if requests else 0}


class Handler(BaseHTTPRequestHandler):
    server_version = "DecisionStudio/1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def valid_host(self):
        return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

    def send_bytes(self, payload, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, data, status=200):
        self.send_bytes(json.dumps(data).encode(), "application/json; charset=utf-8", status)

    def do_GET(self):
        if not self.valid_host():
            return self.send_error(403)
        parsed = urlsplit(self.path)
        path = parsed.path
        if path in ("/", "/setup.html"):
            return self.send_bytes(ASSET.read_bytes(), "text/html; charset=utf-8")
        if path == "/api/templates":
            return self.send_bytes(TEMPLATES.read_bytes(), "application/json; charset=utf-8")
        if path == "/api/request":
            if not parsed.query:
                request_path = self.server.data_dir / "review-request.json"
                return self.send_json(json.loads(request_path.read_text()) if request_path.exists() else {})
            match = re.fullmatch(r"revision=([1-9]\d{0,9})", parsed.query)
            if not match:
                return self.send_json({"error": "Invalid revision"}, 400)
            request_path = history_path(self.server.data_dir, int(match.group(1)))
            if not request_path.exists():
                return self.send_json({"error": "Revision not found"}, 404)
            return self.send_json(json.loads(request_path.read_text()))
        if path == "/api/history" and not parsed.query:
            return self.send_json(history_summary(self.server.data_dir))
        self.send_error(404)

    def do_POST(self):
        if not self.valid_host() or self.path != "/api/request":
            return self.send_error(403 if not self.valid_host() else 404)
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{self.headers.get('Host')}":
            return self.send_error(403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY:
                raise ValueError("size")
            clean = validate_request(json.loads(self.rfile.read(length)))
            with WRITE_LOCK:
                destination = self.server.data_dir / "review-request.json"
                previous = json.loads(destination.read_text()) if destination.exists() else None
                current_revision = previous.get("revision", 0) if previous else 0
                base_revision = clean.pop("baseRevision")
                if base_revision != current_revision:
                    return self.send_json({"error": "A newer review request is saved", "revision": current_revision}, 409)
                next_revision = current_revision + 1
                archived_path = history_path(self.server.data_dir, next_revision)
                if archived_path.exists():
                    archived = json.loads(archived_path.read_text())
                    expected = {key: value for key, value in archived.items() if key not in {"revision", "savedAt"}}
                    replace_latest(self.server.data_dir, archived, previous)
                    if clean != expected:
                        return self.send_json({"error": "A newer review request is saved", "revision": next_revision}, 409)
                    saved_request = archived
                else:
                    clean["revision"] = next_revision
                    clean["savedAt"] = int(time.time() * 1000)
                    archive_request(self.server.data_dir, clean)
                    replace_latest(self.server.data_dir, clean, previous)
                    saved_request = clean
            self.send_json({"saved": True, "request": saved_request, "requestUrl": f"/api/request?revision={saved_request['revision']}"})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            self.send_json({"error": "Invalid review request"}, 400)

    def log_message(self, format, *args):
        if not getattr(self.server, "quiet", False):
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description="Save a Decision Studio review request locally.")
    parser.add_argument("--port", type=int, default=54701, help="Stable loopback port (54701). Use 0 for an isolated temporary session.")
    parser.add_argument("--data-dir", type=Path, default=Path.home() / ".decision-studio", help="Directory for review-request.json. Defaults to ~/.decision-studio.")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    args.data_dir.chmod(0o700)
    for name in ("review-request.json", "review-request.previous.json", "review-request.tmp"):
        saved = args.data_dir / name
        if saved.exists():
            saved.chmod(0o600)
    backfill_latest(args.data_dir)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.data_dir = args.data_dir.resolve()
    server.quiet = args.quiet
    url = f"http://127.0.0.1:{server.server_port}"
    print(f"Decision Studio: {url}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
