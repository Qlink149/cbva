"""Stand-in upstream for the edge test: answers every GET/POST with the request headers it received."""
import http.server
import json


class Handler(http.server.BaseHTTPRequestHandler):
    def _reply(self):
        body = json.dumps({
            "peer": self.client_address[0],
            "headers": {k.lower(): v for k, v in self.headers.items()},
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = do_POST = _reply

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
