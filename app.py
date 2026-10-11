"""House Hunt Root Entry Point for Render and WSGI deployment.

Allows WSGI servers like Gunicorn to load `app:app` directly from
either the repository root or the server subdirectory.
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SERVER_DIR = ROOT_DIR / "server"

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from server.app import app  # noqa: F401, E402

if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("FLASK_PORT", "8081")))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"Starting House Hunt Flask server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug)
