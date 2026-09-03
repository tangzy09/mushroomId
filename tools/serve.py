"""Local dev server. UTF-8 forced, no caching, so edits show up at once."""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3141
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class H(http.server.SimpleHTTPRequestHandler):
    def handle_one_request(self):
        # A browser closing a tab mid-request raises ConnectionResetError on
        # Windows and buries the useful log under a traceback. Nothing to do
        # about a client that left, so drop it.
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError):
            self.close_connection = True

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def guess_type(self, path):
        t = super().guess_type(path)
        if any(str(path).endswith(e) for e in ('.html', '.js', '.css', '.json')):
            base = t.split(';')[0] if t else 'text/plain'
            return base + '; charset=utf-8'
        return t

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), H) as httpd:
    print('serving on http://localhost:%d' % PORT)
    httpd.serve_forever()
