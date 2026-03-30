#!/usr/bin/env python3
"""
Simple HTTP server for Blueprint Editor development
Serves files and handles blueprint saving
"""

import http.server
import socketserver
import json
import os
import urllib.parse
from http import HTTPStatus

class EditorHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that supports blueprint saving"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)
    
    def do_POST(self):
        """Handle POST requests for saving blueprints"""
        if self.path == '/save-blueprint':
            self.handle_save_blueprint()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)
    
    def handle_save_blueprint(self):
        """Save a blueprint file"""
        try:
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            
            if content_length == 0:
                self.send_error(HTTPStatus.BAD_REQUEST, "No content")
                return
            
            # Read POST data
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Validate required fields
            if 'path' not in data or 'content' not in data:
                self.send_error(HTTPStatus.BAD_REQUEST, "Missing path or content")
                return
            
            file_path = data['path']
            content = data['content']
            
            # Security check - ensure path is within data directory
            if not file_path.startswith('blueprints/'):
                self.send_error(HTTPStatus.BAD_REQUEST, "Invalid path")
                return
            
            # Construct full path (relative to parent directory)
            full_path = os.path.join('..', 'data', file_path)
            
            # Create directories if they don't exist
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Write file
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✅ Saved blueprint: {full_path}")
            
            # Send success response
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': True, 'message': f'Saved {file_path}'}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
        except Exception as e:
            print(f"❌ Error saving blueprint: {e}")
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, str(e))
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(HTTPStatus.OK)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    port = 8080
    
    print("🚀 Blueprint Editor Development Server")
    print("=====================================")
    print(f"📂 Serving files from: {os.getcwd()}")
    print(f"🌐 Server running on: http://localhost:{port}/")
    print(f"🔧 Blueprint editor: http://localhost:{port}/index.html")
    print("💾 Supports blueprint saving via POST /save-blueprint")
    print("\n📋 Available endpoints:")
    print("  GET  /                   - Serve files")
    print("  POST /save-blueprint     - Save blueprint file")
    print("\nPress Ctrl+C to stop the server")
    print("=====================================\n")
    
    try:
        with socketserver.TCPServer(("", port), EditorHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")

if __name__ == '__main__':
    main()