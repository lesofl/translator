import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer

import argostranslate.package
import argostranslate.translate

HOST = "127.0.0.1"
PORT = 5000

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ALLOWED_ORIGINS = ("chrome-extension://", "moz-extension://")


def installed_pairs():
    return [
        {"from": p.from_code, "to": p.to_code}
        for p in argostranslate.package.get_installed_packages()
    ]


def translate_text(text, from_code, to_code):
    if not text or not text.strip():
        return text
    return argostranslate.translate.translate(text, from_code, to_code)


class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        log.info("%s - %s", self.address_string(), format % args)

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        origin = self.headers.get("Origin", "")
        if any(origin.startswith(o) for o in ALLOWED_ORIGINS):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return None
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "installed_pairs": installed_pairs()})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/translate":
            self.send_json(404, {"error": "Not found"})
            return

        data = self._read_json()
        if not data or "texts" not in data:
            self.send_json(400, {"error": "Missing 'texts' field"})
            return

        texts = data["texts"]
        from_code = data.get("from", "pt")
        to_code = data.get("to", "en")

        if not isinstance(texts, list):
            self.send_json(400, {"error": "'texts' must be an array"})
            return

        if len(texts) > 500:
            self.send_json(400, {"error": "Too many strings per request (max 500)"})
            return

        pairs = [(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()]
        if (from_code, to_code) not in pairs:
            self.send_json(400, {
                "error": f"Language pair '{from_code}' -> '{to_code}' is not installed. Run setup_lang.py to add it.",
                "installed_pairs": [{"from": f, "to": t} for f, t in pairs],
            })
            return

        translations = []
        for text in texts:
            try:
                translations.append(translate_text(text, from_code, to_code))
            except Exception as e:
                log.error("Translation error: %s", e)
                translations.append(text)

        log.info("Translated %d strings [%s -> %s]", len(translations), from_code, to_code)
        self.send_json(200, {"translations": translations})


if __name__ == "__main__":
    log.info("Starting translation server on http://%s:%d", HOST, PORT)
    log.info("Installed pairs: %s", installed_pairs())
    server = HTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Server stopped.")
