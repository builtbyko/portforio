"""Static server for local and same-Wi-Fi device checks.

Serves the directory holding index.html and sends no-store, so an edited
config.js is not masked by the browser cache.

    python tools/serve_lab.py

Pass --port to change the port. The printed LAN URL is what a phone on the same
Wi-Fi should open; it is reachable by any device on that network, so stop the
server when the check is done.
"""

import argparse
import functools
import http.server
import socket
import socketserver
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Module edits must take effect on reload; the default heuristic cache
        # keeps serving a stale config.js otherwise.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} {fmt % args}")


class Server(socketserver.ThreadingTCPServer):
    # Threaded so a large buildings.geojson cannot block the parallel requests
    # the page makes for the other layers.
    allow_reuse_address = True
    daemon_threads = True


def lan_address():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    if not (SITE_ROOT / "index.html").exists():
        raise SystemExit(f"index.html not found in {SITE_ROOT}")

    handler = functools.partial(Handler, directory=str(SITE_ROOT))
    with Server((args.host, args.port), handler) as httpd:
        print(f"root : {SITE_ROOT}")
        print(f"local: http://localhost:{args.port}/")
        lan = lan_address()
        if lan:
            print(f"phone: http://{lan}:{args.port}/")
        else:
            print("phone: LAN address unavailable")
        print("query: ?debug=1 for stats, ?quality=high|medium|low to override")
        print("Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
