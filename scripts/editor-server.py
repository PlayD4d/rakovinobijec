#!/usr/bin/env python3
"""
Enhanced development server with Blueprint Editor save support
Supports both GET and POST requests for the editor
"""

import http.server
import socketserver
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = 9000

class EditorHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests for saving blueprints"""
        if self.path == '/save-blueprint':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                file_path = data.get('path')
                content = data.get('content')
                
                if not file_path or not content:
                    self.send_error(400, "Missing path or content")
                    return
                
                # Security check - only allow saving to blueprints directory
                if not file_path.startswith('blueprints/'):
                    self.send_error(403, "Can only save to blueprints directory")
                    return
                
                # Construct full path
                full_path = Path('data') / file_path
                
                # Create directory if it doesn't exist
                full_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Save the file
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                # Send success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'success': True,
                    'message': f'Blueprint saved to {file_path}',
                    'path': str(full_path)
                }
                self.wfile.write(json.dumps(response).encode())
                
                print(f"✅ Saved blueprint: {file_path}")
                
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON")
            except Exception as e:
                print(f"❌ Error saving blueprint: {e}")
                self.send_error(500, str(e))
        else:
            self.send_error(404, "Not Found")
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def do_GET(self):
        """Enhanced GET with DEV_MODE injection for HTML files"""
        # Skip injection for editor files
        if self.path.startswith('/editor/'):
            # Default file serving for editor
            super().do_GET()
            return
            
        # Check if requesting HTML file
        if self.path.endswith('.html') or self.path == '/' or self.path.endswith('/'):
            # Read the file
            if self.path == '/' or self.path.endswith('/'):
                file_path = 'index.html'
            else:
                file_path = self.path[1:]  # Remove leading /
            
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Inject DEV_MODE script before closing </body>
                dev_script = """
    <!-- DEV_MODE Auto-injected -->
    <script>
        window.DEV_MODE = true;
        console.log('%c🔧 DEV_MODE Active', 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;');
        console.log('Debug controls: [F3] Overlay | [F6] Missing Assets | [F7] Boss Playground | [F8] SFX Board | [F9] Soft Refresh');
    </script>
</body>"""
                content = content.replace('</body>', dev_script)
                
                # Send the modified content
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', len(content))
                self.end_headers()
                self.wfile.write(content.encode())
            else:
                self.send_error(404, "File not found")
        else:
            # Default file serving
            super().do_GET()

def run_server():
    os.chdir(Path(__file__).parent.parent)  # Change to project root
    
    print(f"🚀 Starting Blueprint Editor Server on http://localhost:{PORT}")
    print(f"📁 Serving from: {os.getcwd()}")
    print(f"✏️  Blueprint saving enabled via POST /save-blueprint")
    print(f"🔧 DEV_MODE injection enabled for HTML files\n")
    print(f"📝 Blueprint Editor: http://localhost:{PORT}/editor/")
    print("\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    with socketserver.TCPServer(("", PORT), EditorHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    try:
        run_server()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {PORT} is already in use!")
            print("Try stopping the other server first or use a different port.")
        else:
            raise