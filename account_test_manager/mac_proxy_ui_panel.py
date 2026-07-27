from __future__ import annotations

import contextlib
import json
import os
import queue
import subprocess
import threading
import time
import traceback
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk
from types import SimpleNamespace

from mac_proxy_ui_poc import (
    APPLICATION_DIR,
    APP_VERSION,
    AutomationStopped,
    DEFAULT_MEMORY_PATH,
    DEFAULT_TEMPLATES_DIR,
    VisualAutomator,
    configure_scenario,
    normalize_target_url,
    parse_raw_proxy_lines,
    parse_scenarios_data,
    scenarios_to_json_data,
    start_firefox,
    validate_latest_created_scenario,
    validate_template_files,
    load_name_memory,
    proxy_fingerprint,
    scenario_to_parsed_proxy,
    visible_windows_for_executables,
)


DEFAULT_FIREFOX = r"C:\Program Files\Mozilla Firefox\firefox.exe"
INSTRUCTIONS_FILE = Path(__file__).with_name("MAC_PROXY_UI_PASSO_A_PASSO.md")
EXAMPLE_JSON = """[
  {
    "scenario_name": "Corporate Proxy",
    "proxy_scheme": "http",
    "proxy_host": "proxy.corp.example.com",
    "proxy_port": 8080
  },
  {
    "scenario_name": "Datacenter Tunnel",
    "proxy_scheme": "http",
    "proxy_host": "10.0.0.55",
    "proxy_port": 3128,
    "proxy_user": "svc_user",
    "proxy_pass": "secure_password"
  }
]"""


class QueueWriter:
    def __init__(self, log_queue: queue.Queue[tuple[str, str]]) -> None:
        self.log_queue = log_queue

    def write(self, text: str) -> None:
        if text:
            self.log_queue.put(("log", text))

    def flush(self) -> None:
        return


class MacProxyPanel:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(f"MAC Proxy UI PoC v{APP_VERSION}")
        self.root.geometry("1040x820")

        self.log_queue: queue.Queue[tuple[str, str]] = queue.Queue()
        self.pause_event = threading.Event()
        self.stop_event = threading.Event()
        self.worker: threading.Thread | None = None
        self.running = False

        self.firefox_var = tk.StringVar(value=DEFAULT_FIREFOX)
        self.profile_var = tk.StringVar(value="")
        self.templates_var = tk.StringVar(value=str(DEFAULT_TEMPLATES_DIR.resolve()))
        self.confidence_var = tk.StringVar(value="0.86")
        self.pause_seconds_var = tk.StringVar(value="0.80")
        self.startup_wait_var = tk.StringVar(value="4.0")
        self.panel_wait_var = tk.StringVar(value="0.65")
        self.raw_scheme_var = tk.StringVar(value="http")
        self.start_line_var = tk.StringVar(value="1")
        self.minimize_var = tk.BooleanVar(value=True)
        self.startup_panels_var = tk.BooleanVar(value=True)
        self.validate_after_var = tk.BooleanVar(value=True)
        self.ip_check_url_var = tk.StringVar(value="https://api.ipify.org")
        self.target_url_var = tk.StringVar(value="https://br-play.grepolis.com/")
        self.status_var = tk.StringVar(value="Pronto")

        self._build_ui()
        self._load_example_from_disk()
        self._poll_queue()

    def _build_ui(self) -> None:
        outer = ttk.Frame(self.root, padding=12)
        outer.pack(fill="both", expand=True)

        settings = ttk.LabelFrame(outer, text="Configuracao")
        settings.pack(fill="x")
        settings.columnconfigure(1, weight=1)

        self._entry_row(settings, 0, "Firefox", self.firefox_var, self._browse_firefox)
        self._entry_row(settings, 1, "Perfil Firefox", self.profile_var, self._browse_profile)
        self._entry_row(settings, 2, "Templates", self.templates_var, self._browse_templates)

        numeric = ttk.Frame(settings)
        numeric.grid(row=3, column=0, columnspan=3, sticky="ew", pady=(8, 0))
        for index in range(8):
            numeric.columnconfigure(index, weight=1)

        ttk.Label(numeric, text="Confianca").grid(row=0, column=0, sticky="w")
        ttk.Entry(numeric, textvariable=self.confidence_var, width=8).grid(row=0, column=1, sticky="w")
        ttk.Label(numeric, text="Pausa entre acoes").grid(row=0, column=2, sticky="w", padx=(16, 0))
        ttk.Entry(numeric, textvariable=self.pause_seconds_var, width=8).grid(row=0, column=3, sticky="w")
        ttk.Label(numeric, text="Espera Firefox").grid(row=0, column=4, sticky="w", padx=(16, 0))
        ttk.Entry(numeric, textvariable=self.startup_wait_var, width=8).grid(row=0, column=5, sticky="w")
        ttk.Label(numeric, text="Espera painel").grid(row=0, column=6, sticky="w", padx=(16, 0))
        ttk.Entry(numeric, textvariable=self.panel_wait_var, width=8).grid(row=0, column=7, sticky="w")

        raw_format = ttk.Frame(settings)
        raw_format.grid(row=4, column=0, columnspan=3, sticky="ew", pady=(8, 0))
        ttk.Label(raw_format, text="Lista crua usa").pack(side="left", padx=(8, 8))
        ttk.Combobox(
            raw_format,
            textvariable=self.raw_scheme_var,
            values=("http", "https", "socks5"),
            width=8,
            state="readonly",
        ).pack(side="left")
        ttk.Label(raw_format, text="para linhas tipo ip:porta:usuario:senha").pack(side="left", padx=(8, 0))
        ttk.Label(raw_format, text="Comecar na linha").pack(side="left", padx=(16, 8))
        ttk.Entry(raw_format, textvariable=self.start_line_var, width=5).pack(side="left")

        ttk.Checkbutton(
            settings,
            text="Minimizar este painel ao iniciar",
            variable=self.minimize_var,
        ).grid(row=5, column=0, columnspan=3, sticky="w", pady=(8, 0))
        ttk.Checkbutton(
            settings,
            text="Clicar em Original profile e Not now se aparecer",
            variable=self.startup_panels_var,
        ).grid(row=6, column=0, columnspan=3, sticky="w", pady=(4, 0))
        ttk.Checkbutton(
            settings,
            text="Validar IP logo apos criar cada container",
            variable=self.validate_after_var,
        ).grid(row=7, column=0, columnspan=3, sticky="w", pady=(4, 0))
        ttk.Label(settings, text="URL teste IP").grid(row=8, column=0, sticky="w", padx=(8, 8), pady=(8, 0))
        ttk.Entry(settings, textvariable=self.ip_check_url_var).grid(row=8, column=1, sticky="ew", pady=(8, 0))
        ttk.Label(settings, text="URL do site de teste").grid(
            row=9,
            column=0,
            sticky="w",
            padx=(8, 8),
            pady=(6, 8),
        )
        ttk.Entry(settings, textvariable=self.target_url_var).grid(
            row=9,
            column=1,
            sticky="ew",
            pady=(6, 8),
        )

        scenarios_box = ttk.LabelFrame(outer, text="network_scenarios.json")
        scenarios_box.pack(fill="both", expand=True, pady=(12, 0))

        toolbar = ttk.Frame(scenarios_box)
        toolbar.pack(fill="x", padx=8, pady=8)
        ttk.Button(toolbar, text="Carregar JSON", command=self._load_json_file).pack(side="left")
        ttk.Button(toolbar, text="Salvar JSON", command=self._save_json_file).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Usar exemplo", command=self._use_example_json).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Validar", command=self._validate_current).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Abrir templates", command=self._open_templates_folder).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Instrucoes", command=self._open_instructions).pack(side="left", padx=(8, 0))

        self.json_text = scrolledtext.ScrolledText(scenarios_box, height=14, wrap="none", undo=True)
        self.json_text.pack(fill="both", expand=True, padx=8, pady=(0, 8))

        controls = ttk.Frame(outer)
        controls.pack(fill="x", pady=(12, 0))

        self.start_button = ttk.Button(controls, text="Iniciar", command=self._start)
        self.pause_button = ttk.Button(controls, text="Pausar", command=self._pause, state="disabled")
        self.resume_button = ttk.Button(controls, text="Continuar", command=self._resume, state="disabled")
        self.stop_button = ttk.Button(controls, text="Parar", command=self._stop, state="disabled")

        self.start_button.pack(side="left")
        self.pause_button.pack(side="left", padx=(8, 0))
        self.resume_button.pack(side="left", padx=(8, 0))
        self.stop_button.pack(side="left", padx=(8, 0))
        ttk.Label(controls, textvariable=self.status_var).pack(side="right")

        logs = ttk.LabelFrame(outer, text="Logs")
        logs.pack(fill="both", expand=True, pady=(12, 0))
        self.log_text = scrolledtext.ScrolledText(logs, height=10, wrap="word", state="disabled")
        self.log_text.pack(fill="both", expand=True, padx=8, pady=8)

    def _entry_row(
        self,
        parent: ttk.LabelFrame,
        row: int,
        label: str,
        variable: tk.StringVar,
        browse_command,
    ) -> None:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", padx=(8, 8), pady=(8, 0))
        ttk.Entry(parent, textvariable=variable).grid(row=row, column=1, sticky="ew", pady=(8, 0))
        ttk.Button(parent, text="Procurar", command=browse_command).grid(
            row=row,
            column=2,
            sticky="e",
            padx=(8, 8),
            pady=(8, 0),
        )

    def _browse_firefox(self) -> None:
        path = filedialog.askopenfilename(
            title="Selecionar firefox.exe",
            filetypes=[("Firefox", "firefox.exe"), ("Executaveis", "*.exe"), ("Todos", "*.*")],
        )
        if path:
            self.firefox_var.set(path)

    def _browse_profile(self) -> None:
        path = filedialog.askdirectory(title="Selecionar perfil Firefox")
        if path:
            self.profile_var.set(path)

    def _browse_templates(self) -> None:
        path = filedialog.askdirectory(title="Selecionar pasta de templates")
        if path:
            self.templates_var.set(path)

    def _open_templates_folder(self) -> None:
        path = Path(self.templates_var.get()).expanduser().resolve()
        path.mkdir(parents=True, exist_ok=True)
        os.startfile(path)
        self._log(f"[painel] Pasta de templates aberta: {path}\n")

    def _open_instructions(self) -> None:
        os.startfile(INSTRUCTIONS_FILE)
        self._log(f"[painel] Instrucoes abertas: {INSTRUCTIONS_FILE}\n")

    def _load_example_from_disk(self) -> None:
        example_path = Path(__file__).with_name("network_scenarios.example.json")
        if example_path.exists():
            text = example_path.read_text(encoding="utf-8")
        else:
            text = EXAMPLE_JSON
        self.json_text.delete("1.0", "end")
        self.json_text.insert("1.0", text)

    def _load_json_file(self) -> None:
        path = filedialog.askopenfilename(
            title="Carregar network_scenarios.json",
            filetypes=[("JSON", "*.json"), ("Todos", "*.*")],
        )
        if not path:
            return
        self.json_text.delete("1.0", "end")
        self.json_text.insert("1.0", Path(path).read_text(encoding="utf-8"))
        self._log(f"[painel] JSON carregado: {path}\n")

    def _save_json_file(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Salvar network_scenarios.json",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("Todos", "*.*")],
        )
        if not path:
            return
        scenarios = self._parse_current_scenarios()
        Path(path).write_text(
            json.dumps(scenarios_to_json_data(scenarios), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        self._log(f"[painel] JSON salvo: {path}\n")

    def _use_example_json(self) -> None:
        self._load_example_from_disk()
        self._log("[painel] Exemplo recarregado.\n")

    def _validate_current(self) -> None:
        try:
            scenarios = self._parse_current_scenarios()
            validate_template_files(Path(self.templates_var.get()).expanduser().resolve())
        except Exception as exc:
            messagebox.showerror("Validacao falhou", str(exc))
            return
        messagebox.showinfo("Validacao OK", f"{len(scenarios)} cenario(s) e templates obrigatorios OK.")

    def _start(self) -> None:
        if self.running:
            return

        try:
            settings = self._collect_settings()
            scenarios = self._parse_current_scenarios()
            validate_template_files(settings["templates"])
        except Exception as exc:
            messagebox.showerror("Nao foi possivel iniciar", str(exc))
            return

        if settings["validate_after_setup"]:
            manual_message = ""
            if settings["target_url"]:
                manual_message = (
                    " Depois do preenchimento, o app enviara o formulario automaticamente "
                    "e continuara ao reconhecer 'Fundar cidade'."
                )
            messagebox.showinfo(
                "Aviso de validacao",
                "Depois de cada container, o app vai abrir o validador de IP. "
                "Se aparecer captcha ou verificacao manual, clique em Pausar, "
                "resolva no Firefox e depois clique em Continuar."
                + manual_message,
            )

        self.running = True
        self.pause_event.set()
        self.stop_event.clear()
        self._set_running_buttons()
        self.status_var.set("Rodando")
        self._log("\n[painel] Iniciando automacao visual...\n")

        if self.minimize_var.get():
            self.root.iconify()

        self.worker = threading.Thread(
            target=self._run_worker,
            args=(settings, scenarios),
            daemon=True,
        )
        self.worker.start()

    def _pause(self) -> None:
        if not self.running:
            return
        self.pause_event.clear()
        self.status_var.set("Pausado")
        self.pause_button.configure(state="disabled")
        self.resume_button.configure(state="normal")
        self._log("[painel] Pausa solicitada. A automacao vai parar no proximo checkpoint.\n")

    def _resume(self) -> None:
        if not self.running:
            return
        self.pause_event.set()
        self.status_var.set("Rodando")
        self.pause_button.configure(state="normal")
        self.resume_button.configure(state="disabled")
        self._log("[painel] Continuando.\n")

    def _stop(self) -> None:
        if not self.running:
            return
        self.stop_event.set()
        self.pause_event.set()
        self.status_var.set("Parando")
        self.stop_button.configure(state="disabled")
        self._log("[painel] Parada solicitada.\n")

    def _run_worker(self, settings: dict[str, object], scenarios) -> None:
        writer = QueueWriter(self.log_queue)
        try:
            with contextlib.redirect_stdout(writer), contextlib.redirect_stderr(writer):
                automator = VisualAutomator(
                    settings["templates"],
                    confidence=settings["confidence"],
                    action_pause=settings["pause_seconds"],
                    control_hook=self._control_checkpoint,
                )
                args = SimpleNamespace(panel_wait=settings["panel_wait"])

                start_firefox(
                    settings["firefox"],
                    settings["profile"],
                    settings["startup_wait"],
                    dry_run=False,
                )
                if settings["startup_panels"]:
                    from mac_proxy_ui_poc import dismiss_startup_panels

                    dismiss_startup_panels(automator)

                for index, scenario in enumerate(scenarios, start=1):
                    self._control_checkpoint()
                    print(f"\n[painel] Cenario {index}/{len(scenarios)}: {scenario.scenario_name}")
                    
                    memory = load_name_memory(DEFAULT_MEMORY_PATH)
                    assignments = memory.get("assignments", {})
                    if not isinstance(assignments, dict):
                        assignments = {}
                    fingerprint = proxy_fingerprint(scenario_to_parsed_proxy(scenario))
                    assignment = assignments.get(fingerprint, {})
                    if isinstance(assignment, dict) and assignment.get("created"):
                        print(f"[painel] Pular! O proxy para {scenario.scenario_name} ja foi configurado anteriormente.")
                        continue

                    try:
                        # Se Firefox fechou, tenta religar
                        if not visible_windows_for_executables({"firefox.exe"}):
                            self._log("[painel] Firefox não está aberto. Tentando religar...\n")
                            start_firefox(
                                str(settings["firefox"]),
                                str(settings["profile"]) or None,
                                float(settings["startup_wait"]),
                                dry_run=False,
                            )
                            if settings["startup_panels"]:
                                dismiss_startup_panels(automator)

                        configure_scenario(automator, scenario, args, scenario_index=index)

                        if settings["validate_after_setup"]:
                            validate_args = SimpleNamespace(
                                panel_wait=settings["panel_wait"],
                                ip_check_url=settings["ip_check_url"],
                                target_url=settings["target_url"],
                            )
                            validate_latest_created_scenario(automator, scenario, validate_args)
                    except Exception as exc:
                        self._log(f"[erro] Falha no proxy {scenario.scenario_name}: {exc}\nPulando para o proximo...\n")
                        # Permite continuar o laço


                print("\n[painel] Todos os cenarios foram processados.")
                self.log_queue.put(("done", "ok"))
        except AutomationStopped:
            self.log_queue.put(("log", "\n[painel] Automacao parada pelo usuario.\n"))
            self.log_queue.put(("done", "stopped"))
        except Exception:
            self.log_queue.put(("log", "\n[erro] Falha na automacao:\n"))
            self.log_queue.put(("log", traceback.format_exc()))
            self.log_queue.put(("done", "error"))

    def _control_checkpoint(self) -> None:
        if self.stop_event.is_set():
            raise AutomationStopped("Parada solicitada.")
        while not self.pause_event.is_set():
            if self.stop_event.is_set():
                raise AutomationStopped("Parada solicitada.")
            time.sleep(0.2)

    def _collect_settings(self) -> dict[str, object]:
        firefox = self.firefox_var.get().strip()
        if not firefox:
            raise ValueError("Informe o caminho do firefox.exe.")
        if not firefox.lower().endswith("firefox.exe"):
            raise ValueError("O campo Firefox deve apontar para firefox.exe.")

        profile = self.profile_var.get().strip() or None
        if profile and profile.lower().endswith(".exe"):
            raise ValueError(
                "O campo Perfil Firefox deve ficar vazio ou apontar para uma pasta de perfil. "
                "Nao coloque firefox.exe nele."
            )

        target_url = normalize_target_url(self.target_url_var.get())
        if target_url and not self.validate_after_var.get():
            raise ValueError(
                "Ative 'Validar IP logo apos criar cada container' para abrir o site de teste depois."
            )
        templates = Path(self.templates_var.get()).expanduser().resolve()
        if target_url:
            target_templates = (
                "web_form_input.png",
                "web_consent_understood_button.png",
                "found_city_button.png",
                "web_form_error.png",
                "web_form_error_text.png",
                "web_form_nickname_error_text.png",
            )
            missing_target_templates = [
                name for name in target_templates if not (templates / name).exists()
            ]
            if missing_target_templates:
                raise FileNotFoundError(
                    "A URL do site de teste exige estes templates na pasta Templates: "
                    + ", ".join(missing_target_templates)
                )

        return {
            "firefox": firefox,
            "profile": profile,
            "templates": templates,
            "confidence": float(self.confidence_var.get()),
            "pause_seconds": float(self.pause_seconds_var.get()),
            "startup_wait": float(self.startup_wait_var.get()),
            "panel_wait": float(self.panel_wait_var.get()),
            "startup_panels": self.startup_panels_var.get(),
            "validate_after_setup": self.validate_after_var.get(),
            "ip_check_url": self.ip_check_url_var.get().strip() or "https://api.ipify.org",
            "target_url": target_url,
        }

    def _json_payload(self) -> str:
        return self.json_text.get("1.0", "end").strip()

    def _parse_current_scenarios(self):
        payload = self._json_payload()
        if not payload:
            raise ValueError("Cole uma lista JSON ou uma lista crua de proxies.")

        if payload.lstrip().startswith("["):
            return parse_scenarios_data(json.loads(payload))

        return parse_raw_proxy_lines(
            payload,
            default_scheme=self.raw_scheme_var.get(),
            memory_path=DEFAULT_MEMORY_PATH,
            start_line=int(self.start_line_var.get() or "1"),
        )

    def _poll_queue(self) -> None:
        try:
            while True:
                kind, payload = self.log_queue.get_nowait()
                if kind == "log":
                    self._log(payload)
                elif kind == "done":
                    self._finish_run(payload)
        except queue.Empty:
            pass
        self.root.after(100, self._poll_queue)

    def _finish_run(self, status: str) -> None:
        self.running = False
        self.pause_event.set()
        self.stop_event.clear()
        self._set_idle_buttons()
        if status == "ok":
            self.status_var.set("Concluido")
        elif status == "stopped":
            self.status_var.set("Parado")
        else:
            self.status_var.set("Erro")
        self.root.deiconify()
        self.root.lift()

    def _set_running_buttons(self) -> None:
        self.start_button.configure(state="disabled")
        self.pause_button.configure(state="normal")
        self.resume_button.configure(state="disabled")
        self.stop_button.configure(state="normal")

    def _set_idle_buttons(self) -> None:
        self.start_button.configure(state="normal")
        self.pause_button.configure(state="disabled")
        self.resume_button.configure(state="disabled")
        self.stop_button.configure(state="disabled")

    def _log(self, text: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", text)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")


def main() -> None:
    root = tk.Tk()
    MacProxyPanel(root)
    root.mainloop()


if __name__ == "__main__":
    main()
