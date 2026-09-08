"""Serve one generated comparison and persist its user's choices on loopback."""
import argparse
import json
import math
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WRITE_LOCK = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def list_directory(self, path):
        self.send_error(404)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def valid_host(self):
        return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'

    def json_response(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if not self.valid_host():
            return self.send_error(403)
        if self.path == '/api/selections':
            p = ROOT / 'selections.json'
            return self.json_response(json.loads(p.read_text()) if p.exists() else {})
        if self.path in ['/', '/index.html', '/manifest.json', '/favicon.ico']:
            return super().do_GET()
        self.send_error(404)

    def do_POST(self):
        if not self.valid_host():
            return self.send_error(403)
        if self.path != '/api/selections':
            return self.send_error(404)
        origin = self.headers.get('Origin')
        if origin and origin != f'http://{self.headers.get("Host")}':
            return self.send_error(403)
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if not 0 < n < 2_000_000:
                raise ValueError('size')
            data = json.loads(self.rfile.read(n))
            manifest = json.loads((ROOT / 'manifest.json').read_text())
            keys = set(manifest['labels'])
            ids = {d['id'] for d in manifest['drafts']}
            if not isinstance(data, dict) or data.get('version') != manifest['version']:
                raise ValueError('version')
            sections, omitted = data.get('sections'), data.get('omitted', [])
            stamp = data.get('savedAt')
            if (not isinstance(sections, dict) or not set(sections) <= keys
                    or any(v not in ids for v in sections.values())
                    or not isinstance(omitted, list) or not set(omitted) <= keys
                    or len(set(omitted)) != len(omitted) or set(omitted) & set(sections)
                    or data.get('base') not in ids | {None}
                    or not isinstance(data.get('assembledMarkdown'), str)
                    or not isinstance(stamp, (int, float)) or isinstance(stamp, bool)
                    or not math.isfinite(stamp) or stamp <= 0):
                raise ValueError('selection')
            custom = data.get('custom')
            if custom is not None and not isinstance(custom, str):
                raise ValueError('custom')
            if not isinstance(data.get('notes', ''), str) or not isinstance(data.get('snippets', []), list):
                raise ValueError('notes/snippets')
            for snippet in data.get('snippets', []):
                if not isinstance(snippet, dict) or snippet.get('id') not in ids or snippet.get('key') not in keys | {'full', 'structure', 'words'} or not isinstance(snippet.get('text'), str):
                    raise ValueError('snippet')
            drafts = {d['id']: d for d in manifest['drafts']}
            order = [s['key'] for s in drafts[data['base']]['sections']] if data.get('base') else list(manifest['labels'])
            parts = [next(s['markdown'] for s in drafts[sections[k]]['sections'] if s['key'] == k)
                     for k in order if k in sections]
            expected = custom if custom is not None else '\n\n'.join(parts) + '\n'
            if data['assembledMarkdown'] != expected:
                raise ValueError('assembled output does not match choices')
            data['sourceCommit'] = manifest['sourceCommit']
            data['draftHashes'] = {d['id']: d['hash'] for d in manifest['drafts']}
            with WRITE_LOCK:
                dest = ROOT / 'selections.json'
                if dest.exists():
                    previous = json.loads(dest.read_text())
                    if stamp < previous['savedAt'] or (stamp == previous['savedAt'] and data != previous):
                        return self.json_response({'error': 'Newer choices already saved',
                                                   'savedAt': previous['savedAt']}, 409)
                    if data == previous:
                        return self.json_response({'saved': True})
                    (ROOT / 'selections.previous.json').write_text(json.dumps(previous, indent=2))
                temp = ROOT / 'selections.tmp'
                temp.write_text(json.dumps(data, indent=2))
                os.replace(temp, dest)
                temp = ROOT / 'selected-output.tmp'
                temp.write_text(data['assembledMarkdown'])
                os.replace(temp, ROOT / 'selected-output.md')
            self.json_response({'saved': True})
        except (ValueError, KeyError, TypeError):
            self.json_response({'error': 'Invalid selection payload'}, 400)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    port = server.server_port
    url = f'http://127.0.0.1:{port}'
    (ROOT / 'launch.json').write_text(json.dumps({'url': url, 'port': port, 'pid': os.getpid()}))
    print(f'Persona comparison: {url}', flush=True)
    server.serve_forever()
