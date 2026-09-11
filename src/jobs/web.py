"""Local review app: uv run jobs, or jobs after installation."""
import argparse
import sqlite3
import webbrowser
from flask import Flask, jsonify, request
from werkzeug.serving import make_server
from .db import DB_PATH, init_db, list_jobs, set_status, set_favourite


def create_app(database_path=DB_PATH):
    app = Flask(__name__, static_folder='static')
    init_db(database_path)

    @app.get('/')
    def index():
        return app.send_static_file('index.html')

    @app.get('/api/jobs')
    def jobs():
        return jsonify(list_jobs(database_path))

    @app.before_request
    def protect_writes():
        if request.method not in ('PATCH', 'POST', 'PUT', 'DELETE'):
            return None
        if not request.is_json:
            return jsonify(error='Expected application/json'), 415
        # Browser mutations must originate from this local app.
        origin = request.headers.get('Origin')
        if origin and origin != request.host_url.rstrip('/'):
            return jsonify(error='Cross-origin writes are not allowed'), 403

    @app.patch('/api/jobs/<int:job_id>/status')
    def status(job_id):
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or set(body) != {'status'} or not isinstance(body['status'], str):
            return jsonify(error='Provide a status string'), 400
        try:
            return jsonify(set_status(job_id, body['status'], database_path))
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        except KeyError:
            return jsonify(error='Job not found'), 404

    @app.patch('/api/jobs/<int:job_id>/favourite')
    def favourite(job_id):
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or set(body) != {'favourite'} or type(body['favourite']) is not bool:
            return jsonify(error='Provide a favourite boolean'), 400
        try:
            return jsonify(set_favourite(job_id, body['favourite'], database_path))
        except KeyError:
            return jsonify(error='Job not found'), 404

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Content-Security-Policy'] = "default-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"
        return response

    return app


def main():
    parser = argparse.ArgumentParser(description='Your local job review app')
    parser.add_argument('--port', type=int, default=5050)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--data-path', action='store_true', help='Print the shared database path and exit')
    args = parser.parse_args()
    if args.data_path:
        print(DB_PATH)
        return
    
    with make_server('127.0.0.1', args.port, create_app()) as server:
        url = f'http://127.0.0.1:{server.server_port}'
        print(f'Job journal: {url} (Ctrl+C to stop)', flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
