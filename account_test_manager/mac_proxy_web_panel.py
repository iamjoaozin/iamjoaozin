from __future__ import annotations

import argparse
import contextlib
import csv
import json
import mimetypes
import os
import shutil
import sys
import threading
import time
import traceback
import webbrowser
from collections import deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import sys

if sys.platform == "win32":
    import ctypes
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            try:
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:
                pass

from mac_proxy_ui_poc import (
    APPLICATION_DIR,
    APP_VERSION,
    AutomationStopped,
    BUNDLE_DIR,
    DEFAULT_FORM_ERROR_LOG_PATH,
    DEFAULT_FORM_SUCCESS_LOG_PATH,
    DEFAULT_MEMORY_PATH,
    DEFAULT_TEMPLATES_DIR,
    VisualAutomator,
    apply_person_names_to_scenarios,
    configure_scenario,
    discard_scenario_from_future_runs,
    dismiss_startup_panels,
    normalize_target_url,
    normalize_person_names,
    parse_raw_proxy_lines,
    parse_scenarios_data,
    set_person_names,
    start_firefox,
    open_test_site_directly,
    validate_template_files,
    load_name_memory,
    proxy_fingerprint,
    scenario_to_parsed_proxy,
    visible_windows_for_executables,
)


BASE_DIR = APPLICATION_DIR
EXTERNAL_WEB_DIST_DIR = BASE_DIR / "web_dashboard" / "dist"
WEB_DIST_DIR = (
    EXTERNAL_WEB_DIST_DIR
    if EXTERNAL_WEB_DIST_DIR.exists()
    else BUNDLE_DIR / "web_dashboard" / "dist"
)
STATE_PATH = BASE_DIR / "web_panel_state.json"
PERSON_NAMES_PATH = BASE_DIR / "person_names.txt"
EXPORTS_DIR = BASE_DIR / "exports"
EXTERNAL_EXAMPLE_PATH = BASE_DIR / "network_scenarios.example.json"
EXAMPLE_PATH = (
    EXTERNAL_EXAMPLE_PATH
    if EXTERNAL_EXAMPLE_PATH.exists()
    else BUNDLE_DIR / "network_scenarios.example.json"
)


def detect_firefox_path(configured_path: object = "") -> str:
    configured = Path(str(configured_path or "").strip()).expanduser()
    candidates: list[Path] = []
    if str(configured):
        candidates.append(configured)
    for environment_name in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
        root = os.environ.get(environment_name)
        if not root:
            continue
        root_path = Path(root)
        if environment_name == "LOCALAPPDATA":
            candidates.append(root_path / "Programs" / "Mozilla Firefox" / "firefox.exe")
        else:
            candidates.append(root_path / "Mozilla Firefox" / "firefox.exe")
    firefox_in_path = shutil.which("firefox")
    if firefox_in_path:
        candidates.append(Path(firefox_in_path))

    if os.name == "nt":
        try:
            import winreg

            registry_locations = (
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe"),
                (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe"),
            )
            for root_key, key_path in registry_locations:
                try:
                    with winreg.OpenKey(root_key, key_path) as key:
                        candidates.append(Path(winreg.QueryValue(key, None)))
                except OSError:
                    continue
        except ImportError:
            pass

    for candidate in candidates:
        if candidate.is_file() and candidate.name.casefold() == "firefox.exe":
            return str(candidate.resolve())
    return ""


class LogWriter:
    def __init__(self, controller: "AutomationController") -> None:
        self.controller = controller

    def write(self, text: str) -> None:
        if text:
            self.controller.log(text)

    def flush(self) -> None:
        return


class AutomationController:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.pause_event = threading.Event()
        self.pause_event.set()
        self.stop_event = threading.Event()
        self.worker: threading.Thread | None = None
        self.status = "ready"
        self.status_label = "Pronto para iniciar"
        self.current_index = 0
        self.total_scenarios = 0
        self.started_at: float | None = None
        self.finished_at: float | None = None
        self.error_message = ""
        self.logs: deque[dict[str, object]] = deque(maxlen=1500)
        self.log_sequence = 0
        self.processed_scenarios = []
        self.saved = self._load_saved_state()

    @staticmethod
    def default_settings() -> dict[str, object]:
        return {
            "firefox": detect_firefox_path(),
            "profile": "",
            "templates": str(DEFAULT_TEMPLATES_DIR.resolve()),
            "confidence": 0.70,
            "pause_seconds": 0.80,
            "startup_wait": 4.0,
            "panel_wait": 0.65,
            "raw_scheme": "http",
            "start_line": 1,
            "startup_panels": True,
            "validate_after_setup": False,
            "ip_check_url": "https://api.ipify.org",
            "target_url": "",
        }

    def _load_saved_state(self) -> dict[str, object]:
        default_text = EXAMPLE_PATH.read_text(encoding="utf-8") if EXAMPLE_PATH.exists() else "[]"
        saved_names_text = ""
        if PERSON_NAMES_PATH.exists():
            try:
                file_names = normalize_person_names(PERSON_NAMES_PATH.read_text(encoding="utf-8"))
                if file_names:
                    saved_names_text = "\n".join(file_names)
            except OSError:
                saved_names_text = ""
        default = {
            "settings": self.default_settings(),
            "scenario_text": default_text,
            "person_names_text": saved_names_text,
        }
        if not STATE_PATH.exists():
            set_person_names(saved_names_text)
            return default
        try:
            loaded = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            if not isinstance(loaded, dict):
                set_person_names(saved_names_text)
                return default
            settings = self.default_settings()
            if isinstance(loaded.get("settings"), dict):
                settings.update(loaded["settings"])
            person_names_text = saved_names_text
            set_person_names(person_names_text)
            return {
                "settings": settings,
                "scenario_text": str(loaded.get("scenario_text") or default_text),
                "person_names_text": person_names_text,
            }
        except (OSError, json.JSONDecodeError):
            set_person_names(saved_names_text)
            return default

    def _save_state(
        self,
        settings: dict[str, object],
        scenario_text: str,
        person_names_text: str,
    ) -> None:
        self.saved = {
            "settings": settings,
            "scenario_text": scenario_text,
            "person_names_text": person_names_text,
        }
        PERSON_NAMES_PATH.write_text(person_names_text + "\n", encoding="utf-8")
        STATE_PATH.write_text(
            json.dumps(self.saved, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def log(self, text: str) -> None:
        with self.lock:
            for part in text.replace("\r", "").splitlines(keepends=True):
                clean = part.rstrip("\n")
                if not clean and part:
                    continue
                self.log_sequence += 1
                self.logs.append(
                    {
                        "id": self.log_sequence,
                        "time": time.strftime("%H:%M:%S"),
                        "text": clean,
                    }
                )

    def _collect_settings(self, raw: object) -> dict[str, object]:
        incoming = raw if isinstance(raw, dict) else {}
        settings = self.default_settings()
        settings.update(incoming)
        firefox = detect_firefox_path(settings.get("firefox"))
        if not firefox:
            raise ValueError(
                "Firefox nao encontrado. Instale o Mozilla Firefox ou informe o caminho para firefox.exe."
            )
        profile = str(settings.get("profile") or "").strip()
        if profile and profile.lower().endswith(".exe"):
            raise ValueError("O perfil Firefox deve apontar para uma pasta, nao para um executavel.")
        templates = Path(str(settings["templates"])).expanduser().resolve()
        target_url = normalize_target_url(settings.get("target_url"))
        validate_after = bool(target_url)
        if target_url:
            target_templates = (
                "web_form_input.png",
                "web_consent_understood_button.png",
                "found_city_button.png",
                "web_form_error.png",
                "web_form_error_text.png",
                "web_form_nickname_error_text.png",
            )
            missing = [name for name in target_templates if not (templates / name).exists()]
            if missing:
                raise FileNotFoundError(
                    "A URL do site de teste exige estes templates: " + ", ".join(missing)
                )

        settings.update(
            {
                "firefox": firefox,
                "profile": profile,
                "templates": str(templates),
                "confidence": float(settings["confidence"]),
                "pause_seconds": float(settings["pause_seconds"]),
                "startup_wait": float(settings["startup_wait"]),
                "panel_wait": float(settings["panel_wait"]),
                "raw_scheme": str(settings["raw_scheme"]).strip().lower(),
                "start_line": int(settings["start_line"]),
                "startup_panels": bool(settings.get("startup_panels")),
                "validate_after_setup": validate_after,
                "ip_check_url": str(settings.get("ip_check_url") or "https://api.ipify.org").strip(),
                "target_url": target_url,
            }
        )
        return settings

    @staticmethod
    def _parse_scenarios(scenario_text: str, settings: dict[str, object]):
        payload = scenario_text.strip()
        if not payload:
            raise ValueError("Cole uma lista JSON ou uma lista crua de proxies.")
        if payload.lstrip().startswith("["):
            scenarios = parse_scenarios_data(json.loads(payload))
        else:
            scenarios = parse_raw_proxy_lines(
                payload,
                default_scheme=str(settings["raw_scheme"]),
                memory_path=None,
                start_line=int(settings["start_line"]),
            )
        return apply_person_names_to_scenarios(scenarios)

    @staticmethod
    def _collect_person_names(raw: object) -> str:
        active_names = normalize_person_names(raw)
        if not active_names:
            raise ValueError("Adicione pelo menos um nome valido na lista de nomes.")
        set_person_names(active_names)
        return "\n".join(active_names)

    def _collect_saved_person_names(self, raw: object) -> str:
        if PERSON_NAMES_PATH.exists():
            try:
                saved_text = PERSON_NAMES_PATH.read_text(encoding="utf-8")
                saved_names = normalize_person_names(saved_text)
                if saved_names:
                    set_person_names(saved_names)
                    return "\n".join(saved_names)
            except OSError:
                pass
        return self._collect_person_names(raw)

    def save_names(self, payload: object) -> dict[str, object]:
        data = payload if isinstance(payload, dict) else {}
        person_names_text = self._collect_person_names(data.get("person_names_text"))
        settings = self.saved.get("settings")
        if not isinstance(settings, dict):
            settings = self.default_settings()
        scenario_text = str(self.saved.get("scenario_text") or "")
        self._save_state(settings, scenario_text, person_names_text)
        return {
            "ok": True,
            "name_count": len(person_names_text.splitlines()),
            "person_names_text": person_names_text,
        }

    @staticmethod
    def _backup_csv(path: Path, prefix: str) -> str | None:
        try:
            if not path.exists() or len(read_report(path)) == 0:
                return None
            EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
            stamp = time.strftime("%Y%m%d_%H%M%S")
            target = EXPORTS_DIR / f"{prefix}_{stamp}.csv"
            shutil.copy2(path, target)
            return target.name
        except OSError:
            return None

    def reset_app(self) -> dict[str, object]:
        with self.lock:
            if self.worker and self.worker.is_alive():
                raise RuntimeError("Pare a automacao antes de resetar o app.")

        exported_accounts = self._backup_csv(DEFAULT_FORM_SUCCESS_LOG_PATH, "contas_exportadas")
        exported_errors = self._backup_csv(DEFAULT_FORM_ERROR_LOG_PATH, "erros_exportados")

        for path in (
            STATE_PATH,
            PERSON_NAMES_PATH,
            DEFAULT_MEMORY_PATH,
            DEFAULT_FORM_SUCCESS_LOG_PATH,
            DEFAULT_FORM_ERROR_LOG_PATH,
        ):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass

        set_person_names("")
        with self.lock:
            self.status = "ready"
            self.status_label = "App resetado"
            self.current_index = 0
            self.total_scenarios = 0
            self.started_at = None
            self.finished_at = None
            self.error_message = ""
            self.logs.clear()
            self.log_sequence = 0
            self.processed_scenarios = []
            self.saved = self._load_saved_state()
        self.log("[painel web] Reset geral concluido. Estado, nomes, memoria e CSVs foram limpos.\n")
        return {
            "ok": True,
            "saved": self.saved,
            "state": self.snapshot(),
            "successes": [],
            "errors": [],
            "exported_accounts": exported_accounts,
            "exported_errors": exported_errors,
            "download_url": f"/api/download/export?name={exported_accounts}" if exported_accounts else "",
        }

    def validate(self, payload: object) -> dict[str, object]:
        data = payload if isinstance(payload, dict) else {}
        settings = self._collect_settings(data.get("settings"))
        scenario_text = str(data.get("scenario_text") or "")
        person_names_text = self._collect_saved_person_names(data.get("person_names_text"))
        scenarios = self._parse_scenarios(scenario_text, settings)
        validate_template_files(Path(str(settings["templates"])))
        self._save_state(settings, scenario_text, person_names_text)
        return {
            "ok": True,
            "scenario_count": len(scenarios),
            "name_count": len(person_names_text.splitlines()),
            "person_names_text": person_names_text,
        }

    def start(self, payload: object) -> dict[str, object]:
        with self.lock:
            if self.worker and self.worker.is_alive():
                raise RuntimeError("A automacao ja esta em execucao.")
        data = payload if isinstance(payload, dict) else {}
        settings = self._collect_settings(data.get("settings"))
        scenario_text = str(data.get("scenario_text") or "")
        person_names_text = self._collect_person_names(data.get("person_names_text"))
        scenarios = self._parse_scenarios(scenario_text, settings)
        validate_template_files(Path(str(settings["templates"])))
        self._save_state(settings, scenario_text, person_names_text)

        with self.lock:
            self.pause_event.set()
            self.stop_event.clear()
            self.status = "running"
            self.status_label = "Automacao em execucao"
            self.current_index = 0
            self.total_scenarios = len(scenarios)
            self.started_at = time.time()
            self.finished_at = None
            self.error_message = ""
            self.logs.clear()
            self.log_sequence = 0
            self.processed_scenarios = []
            self.worker = threading.Thread(
                target=self._run_worker,
                args=(settings, scenarios),
                daemon=True,
            )
            self.worker.start()
        first_name = scenarios[0].scenario_name if scenarios else "-"
        self.log(
            f"[painel web] Iniciando {len(scenarios)} cenario(s) com "
            f"{len(person_names_text.splitlines())} nome(s) salvos. Primeiro nome que sera usado: {first_name}\n"
        )
        return {
            "ok": True,
            "scenario_count": len(scenarios),
            "name_count": len(person_names_text.splitlines()),
            "person_names_text": person_names_text,
        }

    def _checkpoint(self) -> None:
        if self.stop_event.is_set():
            raise AutomationStopped("Parada solicitada.")
        while not self.pause_event.is_set():
            if self.stop_event.is_set():
                raise AutomationStopped("Parada solicitada.")
            time.sleep(0.2)

    def _run_worker(self, settings: dict[str, object], scenarios) -> None:
        writer = LogWriter(self)
        try:
            with contextlib.redirect_stdout(writer), contextlib.redirect_stderr(writer):
                automator = VisualAutomator(
                    Path(str(settings["templates"])),
                    confidence=float(settings["confidence"]),
                    action_pause=float(settings["pause_seconds"]),
                    control_hook=self._checkpoint,
                )
                args = SimpleNamespace(panel_wait=float(settings["panel_wait"]))
                start_firefox(
                    str(settings["firefox"]),
                    str(settings["profile"]) or None,
                    float(settings["startup_wait"]),
                    dry_run=False,
                )
                if settings["startup_panels"]:
                    dismiss_startup_panels(automator)

                for index, scenario in enumerate(scenarios, start=1):
                    self._checkpoint()
                    with self.lock:
                        self.current_index = index
                        self.status_label = f"Processando {scenario.scenario_name}"
                    print(f"\n[painel web] Cenario {index}/{len(scenarios)}: {scenario.scenario_name}")

                    memory = load_name_memory(DEFAULT_MEMORY_PATH)
                    assignments = memory.get("assignments", {})
                    if not isinstance(assignments, dict):
                        assignments = {}
                    fingerprint = proxy_fingerprint(scenario_to_parsed_proxy(scenario))
                    assignment = assignments.get(fingerprint, {})
                    if isinstance(assignment, dict) and assignment.get("created"):
                        self.log(f"[painel web] Pular! O proxy para {scenario.scenario_name} ja foi configurado anteriormente.\n")
                        with self.lock:
                            self.processed_scenarios.append({"name": scenario.scenario_name, "status": "skipped"})
                        continue

                    if not visible_windows_for_executables({"firefox.exe"}):
                        reason = "Firefox foi fechado antes de concluir este cenario."
                        discard_scenario_from_future_runs(scenario, reason=reason)
                        self.log(
                            "[painel web] Firefox fechado. Marcando como erro e descartando "
                            f"{scenario.scenario_name} / {scenario.proxy_host}:{scenario.proxy_port}.\n"
                        )
                        with self.lock:
                            self.processed_scenarios.append({"name": scenario.scenario_name, "status": "error"})
                        raise AutomationStopped("Firefox fechado.")

                    try:
                        # Se Firefox fechou, tenta religar
                        if not visible_windows_for_executables({"firefox.exe"}):
                            self.log("[painel web] Firefox não está aberto. Tentando religar...\n")
                            start_firefox(
                                str(settings["firefox"]),
                                str(settings["profile"]) or None,
                                float(settings["startup_wait"]),
                                dry_run=False,
                            )
                            if settings["startup_panels"]:
                                dismiss_startup_panels(automator)

                        configure_scenario(automator, scenario, args, scenario_index=index)
                        if settings.get("validate_after_setup"):
                            target_url = str(settings["target_url"])
                            if target_url:
                                validate_args = SimpleNamespace(
                                    panel_wait=float(settings["panel_wait"]),
                                    target_url=target_url,
                                )
                                open_test_site_directly(automator, scenario, validate_args)

                        
                        with self.lock:
                            self.processed_scenarios.append({"name": scenario.scenario_name, "status": "success"})
                    except Exception as exc:
                        if not visible_windows_for_executables({"firefox.exe"}):
                            reason = f"Firefox foi fechado durante o cenario: {exc}"
                            discard_scenario_from_future_runs(scenario, reason=reason)
                            self.log(
                                "[painel web] Firefox fechado durante o processo. Marcando como erro e descartando "
                                f"{scenario.scenario_name} / {scenario.proxy_host}:{scenario.proxy_port}.\n"
                            )
                            with self.lock:
                                already_logged = any(
                                    item.get("name") == scenario.scenario_name
                                    for item in self.processed_scenarios
                                )
                                if not already_logged:
                                    self.processed_scenarios.append({"name": scenario.scenario_name, "status": "error"})
                            raise AutomationStopped("Firefox fechado.") from exc
                        self.log(f"[erro] Falha no proxy {scenario.scenario_name}: {exc}\nPulando para o proximo...\n")
                        with self.lock:
                            self.processed_scenarios.append({"name": scenario.scenario_name, "status": "error"})
                        # Não dá throw, permite continuar o laço

            with self.lock:
                self.status = "completed"
                self.status_label = "Execucao concluida"
                self.finished_at = time.time()
        except AutomationStopped as exc:
            detail = str(exc).strip()
            if detail:
                self.log(f"[painel web] Automacao interrompida: {detail}\n")
            else:
                self.log("[painel web] Automacao interrompida pelo usuario.\n")
            with self.lock:
                self.status = "stopped"
                self.status_label = "Execucao interrompida"
                self.finished_at = time.time()
        except Exception as exc:
            self.log("[erro] Falha na automacao:\n")
            self.log(traceback.format_exc())
            with self.lock:
                self.status = "error"
                self.status_label = "Falha na automacao"
                self.error_message = str(exc)
                self.finished_at = time.time()

    def pause(self) -> None:
        with self.lock:
            if self.status != "running":
                raise RuntimeError("A automacao nao esta rodando.")
            self.pause_event.clear()
            self.status = "paused"
            self.status_label = "Automacao pausada"
        self.log("[painel web] Pausa solicitada.\n")

    def resume(self) -> None:
        with self.lock:
            if self.status != "paused":
                raise RuntimeError("A automacao nao esta pausada.")
            self.pause_event.set()
            self.status = "running"
            self.status_label = "Automacao em execucao"
        self.log("[painel web] Continuando a automacao.\n")

    def stop(self) -> None:
        with self.lock:
            if self.status not in {"running", "paused"}:
                raise RuntimeError("Nao ha uma automacao ativa.")
            self.stop_event.set()
            self.pause_event.set()
            self.status_label = "Encerrando com seguranca"
        self.log("[painel web] Parada solicitada.\n")

    def snapshot(self, after_log: int = 0) -> dict[str, object]:
        with self.lock:
            logs = [item for item in self.logs if int(item["id"]) > after_log]
            elapsed = 0
            if self.started_at:
                elapsed = int((self.finished_at or time.time()) - self.started_at)
            return {
                "version": APP_VERSION,
                "status": self.status,
                "status_label": self.status_label,
                "current_index": self.current_index,
                "total_scenarios": self.total_scenarios,
                "elapsed_seconds": elapsed,
                "error_message": self.error_message,
                "logs": logs,
                "last_log_id": self.log_sequence,
                "processed_scenarios": list(self.processed_scenarios),
            }


CONTROLLER = AutomationController()


def read_report(path: Path) -> list[dict[str, str]]:
    if not path.exists() or not path.stat().st_size:
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        # Executaveis PyInstaller sem console deixam sys.stderr como None.
        # Nesse modo, o logger padrao do BaseHTTPRequestHandler interromperia
        # cada requisicao ao tentar escrever o acesso no terminal inexistente.
        if sys.stderr is not None:
            super().log_message(format, *args)

    server_version = "AccountManagerWeb/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def _json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> object:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/bootstrap":
            self._json(
                {
                    "saved": CONTROLLER.saved,
                    "defaults": {"person_names_text": ""},
                    "state": CONTROLLER.snapshot(),
                    "successes": read_report(DEFAULT_FORM_SUCCESS_LOG_PATH),
                    "errors": read_report(DEFAULT_FORM_ERROR_LOG_PATH),
                }
            )
            return
        if parsed.path == "/api/state":
            query = parsed.query.split("after=", 1)[-1] if "after=" in parsed.query else "0"
            try:
                after = int(query.split("&", 1)[0])
            except ValueError:
                after = 0
            self._json(CONTROLLER.snapshot(after))
            return
        if parsed.path == "/api/reports":
            self._json(
                {
                    "successes": read_report(DEFAULT_FORM_SUCCESS_LOG_PATH),
                    "errors": read_report(DEFAULT_FORM_ERROR_LOG_PATH),
                }
            )
            return
        if parsed.path in {"/api/download/successes", "/api/download/errors"}:
            path = (
                DEFAULT_FORM_SUCCESS_LOG_PATH
                if parsed.path.endswith("successes")
                else DEFAULT_FORM_ERROR_LOG_PATH
            )
            self._serve_download(path)
            return
        if parsed.path == "/api/download/export":
            name = parse_qs(parsed.query).get("name", [""])[0]
            export_path = (EXPORTS_DIR / Path(name).name).resolve()
            if EXPORTS_DIR.resolve() not in export_path.parents:
                self.send_error(HTTPStatus.FORBIDDEN)
                return
            self._serve_download(export_path)
            return
        self._serve_static(parsed.path)

    def do_POST(self) -> None:
        try:
            payload = self._read_json()
            if self.path == "/api/validate":
                result = CONTROLLER.validate(payload)
            elif self.path == "/api/start":
                result = CONTROLLER.start(payload)
            elif self.path == "/api/names":
                result = CONTROLLER.save_names(payload)
            elif self.path == "/api/reset":
                result = CONTROLLER.reset_app()
            elif self.path == "/api/pause":
                CONTROLLER.pause()
                result = {"ok": True}
            elif self.path == "/api/resume":
                CONTROLLER.resume()
                result = {"ok": True}
            elif self.path == "/api/stop":
                CONTROLLER.stop()
                result = {"ok": True}
            else:
                self._json({"error": "Endpoint nao encontrado."}, HTTPStatus.NOT_FOUND)
                return
            self._json(result)
        except (ValueError, RuntimeError, FileNotFoundError, json.JSONDecodeError) as exc:
            self._json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            CONTROLLER.log(traceback.format_exc())
            self._json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _serve_download(self, path: Path) -> None:
        if not path.exists():
            self._json({"error": "Arquivo ainda nao foi criado."}, HTTPStatus.NOT_FOUND)
            return
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, request_path: str) -> None:
        if not WEB_DIST_DIR.exists():
            self._json(
                {"error": "Dashboard React ainda nao foi compilado. Execute npm run build."},
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        relative = request_path.lstrip("/") or "index.html"
        candidate = (WEB_DIST_DIR / relative).resolve()
        if WEB_DIST_DIR.resolve() not in candidate.parents and candidate != WEB_DIST_DIR.resolve():
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if not candidate.exists() or candidate.is_dir():
            candidate = WEB_DIST_DIR / "index.html"
        body = candidate.read_bytes()
        mime = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{mime}; charset=utf-8" if mime.startswith("text/") else mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache" if candidate.name == "index.html" else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Painel web do Account Test Manager")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    url = f"http://{args.host}:{args.port}"
    try:
        server = ThreadingHTTPServer((args.host, args.port), DashboardHandler)
    except OSError:
        if not args.no_browser:
            webbrowser.open(url)
        return
    if sys.stdout is not None:
        print(f"Painel web disponivel em {url}")
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
