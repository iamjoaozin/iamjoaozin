from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import html
import threading
from urllib.parse import parse_qs, urlparse

from .config import LOCAL_HOST, LOCAL_PORT
from .database import Database


REGISTER_HTML = """<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cadastro Local</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      background: #f4f7fb;
      color: #1f2937;
      display: grid;
      place-items: center;
    }
    main {
      width: min(420px, calc(100vw - 32px));
      background: #ffffff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }
    h1 {
      font-size: 24px;
      margin: 0 0 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      margin: 14px 0 6px;
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 11px 12px;
      border: 1px solid #c7d2df;
      border-radius: 6px;
      font-size: 15px;
    }
    button {
      width: 100%;
      border: 0;
      border-radius: 6px;
      background: #2563eb;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      padding: 12px;
      margin-top: 18px;
      cursor: pointer;
    }
    .note {
      margin: 14px 0 0;
      font-size: 13px;
      color: #64748b;
    }
    .result {
      padding: 14px;
      border-radius: 6px;
      font-weight: 700;
    }
    .success {
      background: #dcfce7;
      color: #166534;
    }
    .error {
      background: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <main>
    <h1>Cadastro Local</h1>
    <form method="post" action="/register">
      <label for="email">E-mail</label>
      <input id="email" name="email" type="email" autocomplete="off" required>
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" required>
      <input id="proxy" name="proxy" type="hidden">
      <button id="submit" type="submit">Criar conta</button>
    </form>
    <p class="note">Ambiente local de teste, sem verificacao de e-mail.</p>
  </main>
</body>
</html>"""


def result_html(success: bool, message: str) -> bytes:
    class_name = "success" if success else "error"
    safe_message = html.escape(message)
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Resultado</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      background: #f4f7fb;
      display: grid;
      place-items: center;
      color: #1f2937;
    }}
    main {{
      width: min(460px, calc(100vw - 32px));
      background: #ffffff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      padding: 24px;
    }}
    .result {{
      padding: 14px;
      border-radius: 6px;
      font-weight: 700;
    }}
    .success {{
      background: #dcfce7;
      color: #166534;
    }}
    .error {{
      background: #fee2e2;
      color: #991b1b;
    }}
  </style>
</head>
<body>
  <main>
    <div id="result" class="result {class_name}">{safe_message}</div>
  </main>
</body>
</html>""".encode("utf-8")


class RegistrationHandler(BaseHTTPRequestHandler):
    server_version = "LocalRegistration/1.0"

    def log_message(self, fmt: str, *args) -> None:
        return

    def _send_html(self, content: str | bytes, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = content.encode("utf-8") if isinstance(content, str) else content
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"/", "/register"}:
            self._send_html(REGISTER_HTML)
            return
        if path == "/health":
            self._send_html("ok")
            return
        self._send_html(result_html(False, "Pagina nao encontrada."), HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/register":
            self._send_html(result_html(False, "Pagina nao encontrada."), HTTPStatus.NOT_FOUND)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8")
        fields = parse_qs(body)
        email = fields.get("email", [""])[0].strip()
        password = fields.get("password", [""])[0]
        proxy = fields.get("proxy", [""])[0].strip() or None
        user_agent = self.headers.get("User-Agent")

        if not email or not password:
            self._send_html(result_html(False, "E-mail e senha sao obrigatorios."), HTTPStatus.BAD_REQUEST)
            return

        try:
            self.server.database.insert_target_registration(email, password, proxy, user_agent)
        except Exception as exc:
            self._send_html(result_html(False, f"Erro ao salvar conta: {exc}"), HTTPStatus.CONFLICT)
            return

        self._send_html(result_html(True, f"Conta criada: {email}"))


class LocalRegistrationServer:
    def __init__(self, database: Database, host: str = LOCAL_HOST, port: int = LOCAL_PORT):
        self.database = database
        self.host = host
        self.port = port
        self.httpd: ThreadingHTTPServer | None = None
        self.thread: threading.Thread | None = None

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def start(self) -> None:
        if self.httpd:
            return
        self.httpd = ThreadingHTTPServer((self.host, self.port), RegistrationHandler)
        self.httpd.database = self.database
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.database.log(None, "INFO", f"Servidor local iniciado em {self.base_url}")

    def stop(self) -> None:
        if not self.httpd:
            return
        thread = self.thread
        self.httpd.shutdown()
        self.httpd.server_close()
        self.httpd = None
        self.thread = None
        if thread:
            thread.join(timeout=2)
        self.database.log(None, "INFO", "Servidor local finalizado.")
