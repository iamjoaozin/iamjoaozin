from __future__ import annotations

import contextlib
import csv
import importlib.util
import marshal
import sys
import threading
import time
import types
from pathlib import Path


def _runtime_base() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parent


def _load_code_module(module_name: str, marshal_name: str) -> types.ModuleType:
    base = _runtime_base()
    code_path = base / "compat_16_22" / marshal_name
    code = marshal.loads(code_path.read_bytes())
    module = types.ModuleType(module_name)
    module.__file__ = str(code_path)
    module.__package__ = ""
    module.__loader__ = None
    sys.modules[module_name] = module
    exec(code, module.__dict__)
    return module


ui = _load_code_module("mac_proxy_ui_poc", "mac_proxy_ui_poc_16_22.marshal")


def _install_ui_patches() -> None:
    # Identidade do pacote: 16.22 original + somente os dois ajustes pedidos.
    ui.APP_VERSION = "16.22-container-firefox-fix"

    # Melhora reconhecimento dos templates de container em telas/AnyDesk com escala diferente.
    ui.TEMPLATE_MATCH_SCALES = (1.0, 0.9, 1.1, 0.8, 1.2, 1.25, 0.75, 1.33, 1.5, 0.67)
    if hasattr(ui, "LIVE_NAME_MATCH_THRESHOLD"):
        ui.LIVE_NAME_MATCH_THRESHOLD = min(float(ui.LIVE_NAME_MATCH_THRESHOLD), 0.58)
    if hasattr(ui, "ACTIVE_CONTAINER_MATCH_THRESHOLD"):
        ui.ACTIVE_CONTAINER_MATCH_THRESHOLD = min(float(ui.ACTIVE_CONTAINER_MATCH_THRESHOLD), 0.56)
    if hasattr(ui, "VALIDATION_NAME_MATCH_THRESHOLD"):
        ui.VALIDATION_NAME_MATCH_THRESHOLD = min(float(ui.VALIDATION_NAME_MATCH_THRESHOLD), 0.46)
    if hasattr(ui, "VALIDATION_PIXEL_F1_THRESHOLD"):
        ui.VALIDATION_PIXEL_F1_THRESHOLD = min(float(ui.VALIDATION_PIXEL_F1_THRESHOLD), 0.68)
    if hasattr(ui, "LIVE_NAME_BOUNDARY_THRESHOLD"):
        ui.LIVE_NAME_BOUNDARY_THRESHOLD = max(float(ui.LIVE_NAME_BOUNDARY_THRESHOLD), 0.12)

    original_init = ui.VisualAutomator.__init__

    def patched_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        if not hasattr(self, "_template_cache"):
            self._template_cache = {}

    ui.VisualAutomator.__init__ = patched_init

    def scaled_templates(self, template_name: str):
        cache = getattr(self, "_template_cache", None)
        if cache is None:
            cache = {}
            self._template_cache = cache
        cached = cache.get(template_name)
        if cached is not None:
            return cached

        template_path = self.templates_dir / template_name
        if not template_path.exists():
            raise FileNotFoundError(f"Template nao encontrado: {template_path}")
        original_template = ui.cv2.imread(str(template_path), ui.cv2.IMREAD_GRAYSCALE)
        if original_template is None:
            raise FileNotFoundError(f"Nao consegui abrir o template: {template_path}")

        scaled = []
        seen_sizes = set()
        for scale in ui.TEMPLATE_MATCH_SCALES:
            width = max(1, int(round(original_template.shape[1] * scale)))
            height = max(1, int(round(original_template.shape[0] * scale)))
            if width < 8 or height < 8 or (width, height) in seen_sizes:
                continue
            seen_sizes.add((width, height))
            if scale == 1.0:
                template = original_template
            else:
                interpolation = ui.cv2.INTER_AREA if scale < 1.0 else ui.cv2.INTER_CUBIC
                template = ui.cv2.resize(original_template, (width, height), interpolation=interpolation)
            scaled.append((scale, template))
        cache[template_name] = scaled
        return scaled

    def patched_locate_all(self, template_name: str, *, confidence=None):
        template_path = self.templates_dir / template_name
        if not template_path.exists():
            raise FileNotFoundError(f"Template nao encontrado: {template_path}")

        screen = self._screenshot_gray()
        match_threshold = self.confidence if confidence is None else confidence
        candidates = []
        for _scale, template in scaled_templates(self, template_name):
            if template.shape[0] > screen.shape[0] or template.shape[1] > screen.shape[1]:
                continue
            result = ui.cv2.matchTemplate(screen, template, ui.cv2.TM_CCOEFF_NORMED)
            ys, xs = ui.np.where(result >= match_threshold)
            height, width = template.shape[:2]
            for x, y in zip(xs, ys):
                candidates.append(ui.Match(int(x), int(y), int(width), int(height), float(result[y, x])))
        candidates.sort(key=lambda item: item.confidence, reverse=True)
        return self._dedupe_matches(candidates)

    def patched_last_confidence(self, template_name: str) -> float:
        screen = self._screenshot_gray()
        best_conf = 0.0
        try:
            templates = scaled_templates(self, template_name)
        except FileNotFoundError:
            return 0.0
        for _scale, template in templates:
            if template.shape[0] > screen.shape[0] or template.shape[1] > screen.shape[1]:
                continue
            result = ui.cv2.matchTemplate(screen, template, ui.cv2.TM_CCOEFF_NORMED)
            best_conf = max(best_conf, float(ui.cv2.minMaxLoc(result)[1]))
        return best_conf

    ui.VisualAutomator.locate_all = patched_locate_all
    ui.VisualAutomator.last_confidence = patched_last_confidence

    original_render = ui.render_live_name_templates

    def patched_render_live_name_templates(expected_name: str):
        templates = original_render(expected_name)
        font_paths = [Path("C:/Windows/Fonts/segoeui.ttf")]
        for font_path in font_paths:
            if not font_path.exists():
                continue
            for font_size in range(16, 28):
                font = ui.ImageFont.truetype(str(font_path), font_size)
                left, top, right, bottom = font.getbbox(expected_name)
                image = ui.Image.new("L", (right - left + 8, bottom - top + 8), 255)
                ui.ImageDraw.Draw(image).text((4 - left, 4 - top), expected_name, font=font, fill=0)
                gray_template = ui.np.array(image)
                candidate = (gray_template, None)
                if all(existing[0].shape != gray_template.shape for existing in templates):
                    templates.append(candidate)
                for threshold in (225, 235, 245):
                    binary_template = ui.cv2.threshold(gray_template, threshold, 255, ui.cv2.THRESH_BINARY)[1]
                    templates.append((binary_template, threshold))
        return templates

    ui.render_live_name_templates = patched_render_live_name_templates

    original_parse_raw_proxy_lines = ui.parse_raw_proxy_lines

    def patched_parse_raw_proxy_lines(text: str, **kwargs):
        memory_path = kwargs.get("memory_path")
        if memory_path:
            memory = ui.load_name_memory(memory_path)
            assignments = memory.get("assignments", {})
            default_scheme = kwargs.get("default_scheme", "http")
            filtered_lines = []
            start_line = int(kwargs.get("start_line", 1))
            for position, raw_line in enumerate(text.splitlines(), start=1):
                if position < start_line:
                    filtered_lines.append(raw_line)
                    continue
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    filtered_lines.append(raw_line)
                    continue
                try:
                    parsed = ui.parse_proxy_line(line, default_scheme=default_scheme)
                    fingerprint = ui.proxy_fingerprint(parsed)
                    assignment = assignments.get(fingerprint)
                    if isinstance(assignment, dict) and assignment.get("discarded"):
                        print(
                            "[memoria] Pulando proxy descartado anteriormente: "
                            f"{assignment.get('scenario_name') or line}."
                        )
                        continue
                except Exception:
                    pass
                filtered_lines.append(raw_line)
            text = "\n".join(filtered_lines)
        return original_parse_raw_proxy_lines(text, **kwargs)

    ui.parse_raw_proxy_lines = patched_parse_raw_proxy_lines

    def discard_scenario_from_future_runs(scenario, *, reason: str, memory_path=None):
        memory_path = memory_path or ui.DEFAULT_MEMORY_PATH
        memory = ui.load_name_memory(memory_path)
        assignments = memory.setdefault("assignments", {})
        retired_names = memory.setdefault("retired_names", [])
        if not isinstance(retired_names, list):
            retired_names = []
            memory["retired_names"] = retired_names
        fingerprint = ui.proxy_fingerprint(ui.scenario_to_parsed_proxy(scenario))
        assignments[fingerprint] = {
            "scenario_name": scenario.scenario_name,
            "proxy_scheme": scenario.proxy_scheme,
            "proxy_host": scenario.proxy_host,
            "proxy_port": scenario.proxy_port,
            "proxy_user": scenario.proxy_user,
            "last_seen": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "discarded": True,
            "discard_reason": reason,
            "discarded_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        if ui.name_is_allowed(scenario.scenario_name) and scenario.scenario_name not in retired_names:
            retired_names.append(scenario.scenario_name)
        last_created = memory.get("last_created")
        if isinstance(last_created, dict) and last_created.get("scenario_name") == scenario.scenario_name:
            memory["last_created"] = None
        ui.save_name_memory(memory_path, memory)
        print(
            "[memoria] Descartei para proximas execucoes: "
            f"{scenario.scenario_name} / {scenario.proxy_host}:{scenario.proxy_port}. Motivo: {reason}"
        )

    ui.discard_scenario_from_future_runs = discard_scenario_from_future_runs


_install_ui_patches()
web = _load_code_module("mac_proxy_web_panel", "mac_proxy_web_panel_16_22.marshal")


def _install_web_patches() -> None:
    web.APP_VERSION = ui.APP_VERSION
    web.parse_raw_proxy_lines = ui.parse_raw_proxy_lines

    original_run_worker = web.AutomationController._run_worker

    def patched_run_worker(self, settings, scenarios):
        writer = web.LogWriter(self)
        try:
            with contextlib.redirect_stdout(writer), contextlib.redirect_stderr(writer):
                automator = web.VisualAutomator(
                    Path(str(settings["templates"])),
                    confidence=float(settings["confidence"]),
                    action_pause=float(settings["pause_seconds"]),
                    control_hook=self._checkpoint,
                )
                args = web.SimpleNamespace(panel_wait=float(settings["panel_wait"]))
                web.start_firefox(
                    str(settings["firefox"]),
                    str(settings["profile"]) or None,
                    float(settings["startup_wait"]),
                    dry_run=False,
                )
                if settings["startup_panels"]:
                    web.dismiss_startup_panels(automator)

                for index, scenario in enumerate(scenarios, start=1):
                    self._checkpoint()
                    with self.lock:
                        self.current_index = index
                        self.status_label = f"Processando {scenario.scenario_name}"
                    print(f"\n[painel web] Cenario {index}/{len(scenarios)}: {scenario.scenario_name}")

                    try:
                        if not ui.visible_windows_for_executables({"firefox.exe"}):
                            reason = "Firefox foi fechado antes de concluir este cenario."
                            ui.discard_scenario_from_future_runs(scenario, reason=reason)
                            self.log(
                                "[painel web] Firefox fechado. Marcando como erro e descartando "
                                f"{scenario.scenario_name} / {scenario.proxy_host}:{scenario.proxy_port}.\n"
                            )
                            with self.lock:
                                self.processed_scenarios.append({"name": scenario.scenario_name, "status": "error"})
                            raise ui.AutomationStopped("Firefox fechado.")

                        web.configure_scenario(automator, scenario, args, scenario_index=index)
                        if settings.get("validate_after_setup"):
                            target_url = str(settings["target_url"])
                            if target_url:
                                validate_args = web.SimpleNamespace(
                                    panel_wait=float(settings["panel_wait"]),
                                    target_url=target_url,
                                )
                                web.open_test_site_directly(automator, scenario, validate_args)

                        with self.lock:
                            self.processed_scenarios.append({"name": scenario.scenario_name, "status": "success"})
                    except Exception as exc:
                        if not ui.visible_windows_for_executables({"firefox.exe"}):
                            reason = f"Firefox foi fechado durante o cenario: {exc}"
                            ui.discard_scenario_from_future_runs(scenario, reason=reason)
                            self.log(
                                "[painel web] Firefox fechado durante o processo. Marcando como erro e descartando "
                                f"{scenario.scenario_name} / {scenario.proxy_host}:{scenario.proxy_port}.\n"
                            )
                            with self.lock:
                                self.processed_scenarios.append({"name": scenario.scenario_name, "status": "error"})
                            raise ui.AutomationStopped("Firefox fechado.") from exc
                        self.log(f"[erro] Falha no proxy {scenario.scenario_name}: {exc}\nPulando para o proximo...\n")
                        with self.lock:
                            self.processed_scenarios.append({"name": scenario.scenario_name, "status": "error"})

            with self.lock:
                self.status = "completed"
                self.status_label = "Execucao concluida"
                self.finished_at = time.time()
        except ui.AutomationStopped as exc:
            detail = str(exc).strip()
            self.log(f"[painel web] Automacao interrompida: {detail or 'parada solicitada'}.\n")
            with self.lock:
                self.status = "stopped"
                self.status_label = "Execucao interrompida"
                self.finished_at = time.time()
        except Exception as exc:
            self.log(f"[erro fatal] {exc}\n{web.traceback.format_exc()}\n")
            with self.lock:
                self.status = "error"
                self.status_label = "Falha"
                self.error_message = str(exc)
                self.finished_at = time.time()

    # Mantemos uma referencia para auditoria; a execucao usa o patch.
    web.AutomationController._run_worker_original_16_22 = original_run_worker
    web.AutomationController._run_worker = patched_run_worker


_install_web_patches()

if __name__ == "__main__":
    web.main()
