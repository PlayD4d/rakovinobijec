#!/usr/bin/env python3 -u
"""
Development server with DEV_MODE injection
Injects DEV_MODE flag into HTML pages to enable debug features
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

# Force unbuffered output
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

PORT = 8000
DEV_SCRIPT = """
<script>
    // Development Mode Enabled
    window.DEV_MODE = true;
    console.log('%c🔧 DEV MODE ENABLED', 'color: #00ff88; font-weight: bold; font-size: 14px');
    console.log('%c[F3] Debug Overlay | [F6] Missing Assets | [F9] Hot-Reload Data', 'color: #888');
</script>
"""

class DevHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
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