from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
from pathlib import Path
import base64, re
ROOT = Path(r'C:\laragon\www\PoliSpace-master\tmp\pdfs\screenshots')
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'<form method="post"><input name="filename" aria-label="Filename"><textarea name="data" aria-label="Data"></textarea><button>Save</button></form>'
        self.send_response(200); self.send_header('Content-Type','text/html'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        length = int(self.headers.get('Content-Length','0'))
        if length > 3000000: self.send_error(413); return
        args = parse_qs(self.rfile.read(length).decode('ascii'))
        name = args.get('filename',[''])[0]
        if not re.fullmatch(r'[a-z0-9_-]+\.jpg', name): self.send_error(400); return
        data = base64.b64decode(args.get('data',[''])[0], validate=True)
        if not data.startswith(b'\xff\xd8'): self.send_error(400); return
        (ROOT/name).write_bytes(data)
        body = ('Saved '+name).encode()
        self.send_response(200); self.send_header('Content-Type','text/plain'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
HTTPServer(('127.0.0.1',8787), H).serve_forever()
