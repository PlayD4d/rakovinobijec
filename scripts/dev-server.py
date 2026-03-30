#!/usr/bin/env python3 -u
"""
Development server with DEV_MODE injection
Injects DEV_MODE flag into HTML pages to enable debug features
"""

import http.server
import socketserver
import os
import sys
import json
import subprocess
from urllib.parse import urlparse

# Force unbuffered output
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

PORT = 8000
MAX_SESSIONS = 10  # Keep only the most recent N session files
DEV_SCRIPT = """
<script>
    // Development Mode Enabled
    window.DEV_MODE = true;
    console.log('%c🔧 DEV MODE ENABLED', 'color: #00ff88; font-weight: bold; font-size: 14px');
    console.log('%c[F3] Debug Overlay | [F6] Missing Assets | [F9] Hot-Reload Data', 'color: #888');
</script>
"""

SESSIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'sessions')
TELEMETRY_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'telemetry-db.mjs')

class DevHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/telemetry':
            return self._handle_telemetry_post()

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _handle_telemetry_post(self):
        """Receive session JSON, save to file, import into SQLite DB"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0 or content_length > 50_000_000:  # 50MB limit
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error":"Invalid content length"}')
                return

            body = self.rfile.read(content_length)
            data = json.loads(body)
            session_id = data.get('id', 'unknown')
            event_count = len(data.get('events', []))

            # Save JSON file
            os.makedirs(SESSIONS_DIR, exist_ok=True)
            file_path = os.path.join(SESSIONS_DIR, f'session_{session_id}.json')
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(body.decode('utf-8'))

            print(f"📊 Session {session_id} received ({event_count} events), saved to {file_path}")

            # Prune old session files — keep only the most recent MAX_SESSIONS
            self._prune_old_sessions()

            # Import into telemetry DB + prune old sessions in background
            if os.path.exists(TELEMETRY_SCRIPT):
                try:
                    subprocess.Popen(
                        ['node', TELEMETRY_SCRIPT, 'import', file_path],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE
                    )
                    # Prune DB to keep only MAX_SESSIONS newest
                    subprocess.Popen(
                        ['node', TELEMETRY_SCRIPT, 'prune', str(MAX_SESSIONS)],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE
                    )
                    print(f"📊 Telemetry DB import + prune started for {session_id}")
                except Exception as e:
                    print(f"⚠️  Telemetry DB import failed: {e}", file=sys.stderr)

            # Respond success
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'ok': True, 'sessionId': session_id, 'events': event_count
            }).encode('utf-8'))

        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"Invalid JSON"}')
        except Exception as e:
            print(f"❌ Telemetry error: {e}", file=sys.stderr)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

    def _prune_old_sessions(self):
        """Remove oldest session files if count exceeds MAX_SESSIONS"""
        try:
            if not os.path.isdir(SESSIONS_DIR):
                return
            files = [
                os.path.join(SESSIONS_DIR, f)
                for f in os.listdir(SESSIONS_DIR)
                if f.startswith('session_') and f.endswith('.json')
            ]
            if len(files) <= MAX_SESSIONS:
                return
            # Sort by modification time (newest first)
            files.sort(key=os.path.getmtime, reverse=True)
            for old_file in files[MAX_SESSIONS:]:
                os.remove(old_file)
                print(f"🗑️  Pruned old session: {os.path.basename(old_file)}")
        except Exception as e:
            print(f"⚠️  Session prune failed: {e}", file=sys.stderr)

    def end_headers(self):
        # Check if this is an HTML file request
        path = urlparse(self.path).path
        if path == '/' or path.endswith('.html'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('X-Dev-Mode', 'true')
        super().end_headers()

    def do_GET(self):
        # Parse the URL path
        path = urlparse(self.path).path
        
        # If requesting root or HTML file, inject dev mode script
        if path == '/' or path.endswith('.html'):
            # Determine actual file path
            if path == '/':
                file_path = 'index.html'
            else:
                file_path = path.lstrip('/')
            
            # Check if file exists
            if os.path.exists(file_path):
                try:
                    # Read the HTML file
                    with open(file_path, 'r', encoding='utf-8') as f:
                        html_content = f.read()
                    
                    # Inject DEV_MODE script before closing </head> or </body>
                    if '</head>' in html_content:
                        html_content = html_content.replace('</head>', f'{DEV_SCRIPT}\n</head>')
                    elif '</body>' in html_content:
                        html_content = html_content.replace('</body>', f'{DEV_SCRIPT}\n</body>')
                    else:
                        # Fallback: add at the end
                        html_content += DEV_SCRIPT
                    
                    # Send response
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.send_header('Content-Length', str(len(html_content.encode('utf-8'))))
                    self.end_headers()
                    self.wfile.write(html_content.encode('utf-8'))
                    return
                except Exception as e:
                    print(f"Error processing HTML file: {e}", file=sys.stderr)
        
        # For non-HTML files, use default handler
        super().do_GET()

def run_server():
    """Start the development server"""
    
    # Change to project root directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)
    
    print(f"🚀 Starting DEV server on http://localhost:{PORT}")
    print(f"📁 Serving from: {os.getcwd()}")
    print(f"🔧 DEV_MODE injection enabled for HTML files")
    print(f"📊 Telemetry endpoint: POST /api/telemetry")
    print(f"")
    print(f"Debug controls:")
    print(f"  [F3] - Toggle Debug Overlay")
    print(f"  [F6] - Toggle Missing Assets Panel")
    print(f"  [F9] - Hot-Reload Data (blueprints)")
    print(f"")
    print(f"Press Ctrl+C to stop the server")
    print("-" * 50)
    
    with socketserver.TCPServer(("", PORT), DevHTTPRequestHandler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
            sys.exit(0)

if __name__ == "__main__":
    run_server()