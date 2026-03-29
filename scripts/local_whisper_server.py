import io
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from cgi import FieldStorage


class WhisperHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/transcribe":
            self.send_response(404)
            self._write_json({"error": "Not found"})
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_response(400)
            self._write_json({"error": "Expected multipart form upload"})
            return

        environ = {
            "REQUEST_METHOD": "POST",
            "CONTENT_TYPE": content_type,
        }

        form = FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ=environ,
            keep_blank_values=True,
        )

        audio_field = form["audio"] if "audio" in form else None
        if audio_field is None or not getattr(audio_field, "file", None):
            self.send_response(400)
            self._write_json({"error": "Audio file is required"})
            return

        try:
            import whisper
        except ImportError:
            self.send_response(500)
            self._write_json(
                {
                    "error": (
                        "The `whisper` package is not installed. "
                        "Create a Python virtualenv and run `pip install -r requirements.txt`."
                    )
                }
            )
            return

        try:
            import tempfile
            from pathlib import Path

            model = whisper.load_model("base")
            suffix = Path(getattr(audio_field, "filename", "audio.webm")).suffix or ".webm"

            with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as temp_audio:
                temp_audio.write(audio_field.file.read())
                temp_audio.flush()
                result = model.transcribe(temp_audio.name)

            self.send_response(200)
            self._write_json({"text": result.get("text", "").strip()})
        except Exception as exc:
            self.send_response(500)
            self._write_json({"error": str(exc)})

    def log_message(self, format, *args):
        return

    def _write_json(self, data):
        payload = json.dumps(data).encode("utf-8")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8000), WhisperHandler)
    print("Local Whisper server listening on http://127.0.0.1:8000/transcribe")
    server.serve_forever()
