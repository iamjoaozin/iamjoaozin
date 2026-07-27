"""
PoC de automacao visual para Firefox Multi-Account Containers.

Objetivo:
    Demonstrar, em laboratorio controlado, a configuracao de varios containers
    do Firefox Multi-Account Containers com rotas de proxy diferentes.

Antes de executar:
    1. Feche todas as janelas do Firefox que usam o perfil alvo.
    2. Instale a extensao "Firefox Multi-Account Containers" nesse perfil.
    3. Habilite uma vez a permissao opcional de proxy da extensao:
       abra a extensao, entre em "Advanced proxy settings" e clique em "Enable"
       se o Firefox pedir permissao.
    4. Use escala de tela 100% no Windows e mantenha o Firefox maximizado.
    5. Capture os recortes de tela exigidos em mac_ui_templates/README.md.
       Os PNGs precisam representar a sua UI real, idioma, tema e escala.
    6. Crie seu arquivo network_scenarios.json usando o exemplo fornecido.

Instalacao:
    cd C:\\Users\\doxyh\\Downloads\\iamjoaozin-main\\account_test_manager
    py -m venv .venv
    .\\.venv\\Scripts\\Activate.ps1
    py -m pip install -r requirements.txt

Execucao:
    py mac_proxy_ui_poc.py --config network_scenarios.json

Notas:
    - Esta PoC usa pyautogui para mouse/teclado e opencv-python para localizar
      elementos por template matching. Mudancas de tema, idioma, zoom ou escala
      podem exigir novos templates.
    - A UI da extensao costuma receber proxy como uma string unica:
      http://host:porta, socks://host:porta ou http://usuario:senha@host:porta.
    - Depois da configuracao, valide manualmente cada container em ipinfo.io.
"""

from __future__ import annotations

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

import argparse
import csv
import hashlib
import json
import re
import secrets
import subprocess
import sys
import time
from dataclasses import dataclass, replace
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import unquote, urlparse

import cv2
import numpy as np
import pyautogui
import pyperclip
from PIL import Image, ImageDraw, ImageFont


def highlight_rect(x: int, y: int, w: int, h: int, duration: float = 0.3) -> None:
    if sys.platform != "win32":
        return
    import ctypes
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32
    hdc = user32.GetDC(0)
    pen = gdi32.CreatePen(0, 4, 0x0000FF) # Red color
    old_pen = gdi32.SelectObject(hdc, pen)
    old_brush = gdi32.SelectObject(hdc, gdi32.GetStockObject(5)) # NULL_BRUSH
    center_x = x + w // 2
    center_y = y + h // 2
    gdi32.Rectangle(hdc, x, y, x + w, y + h)
    gdi32.MoveToEx(hdc, center_x - 22, center_y, None)
    gdi32.LineTo(hdc, center_x + 22, center_y)
    gdi32.MoveToEx(hdc, center_x, center_y - 22, None)
    gdi32.LineTo(hdc, center_x, center_y + 22)
    time.sleep(duration)
    user32.InvalidateRect(0, None, False)
    gdi32.SelectObject(hdc, old_pen)
    gdi32.SelectObject(hdc, old_brush)
    gdi32.DeleteObject(pen)
    user32.ReleaseDC(0, hdc)

SUPPORTED_SCHEMES = {"http", "https", "socks", "socks4", "socks5"}
SOURCE_DIR = Path(__file__).resolve().parent
APPLICATION_DIR = (
    Path(sys.executable).resolve().parent
    if getattr(sys, "frozen", False)
    else SOURCE_DIR
)
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", SOURCE_DIR)).resolve()
EXTERNAL_TEMPLATES_DIR = APPLICATION_DIR / "mac_ui_templates"
DEFAULT_TEMPLATES_DIR = (
    EXTERNAL_TEMPLATES_DIR
    if EXTERNAL_TEMPLATES_DIR.exists()
    else BUNDLE_DIR / "mac_ui_templates"
)
DEFAULT_MEMORY_PATH = APPLICATION_DIR / "mac_proxy_ui_memory.json"
DEFAULT_FORM_ERROR_LOG_PATH = APPLICATION_DIR / "form_error_occurrences.csv"
DEFAULT_FORM_SUCCESS_LOG_PATH = APPLICATION_DIR / "successful_registrations.csv"
LIVE_NAME_MATCH_THRESHOLD = 0.58
ACTIVE_CONTAINER_MATCH_THRESHOLD = 0.56
VALIDATION_NAME_MATCH_THRESHOLD = 0.46
VALIDATION_SCROLL_CLICKS = 100
VALIDATION_PIXEL_F1_THRESHOLD = 0.68
LIVE_NAME_BOUNDARY_THRESHOLD = 0.12
FAST_LIST_SCROLL_CLICKS = -100
LIST_BOTTOM_JUMP_CLICKS = -999
ADVANCED_SCROLL_CLICKS = -8
ADVANCED_TEXT_MATCH_THRESHOLD = 0.55
NAME_SET_VERSION = 19
APP_VERSION = "16.23"
WEB_FORM_INPUT_TEMPLATE = "web_form_input.png"
WEB_CONSENT_BUTTON_TEMPLATE = "web_consent_understood_button.png"
WEB_FORM_READY_TEMPLATE = "found_city_button.png"
WEB_FORM_ERROR_TEMPLATE = "web_form_error.png"
WEB_FORM_ERROR_TEXT_TEMPLATE = "web_form_error_text.png"
WEB_FORM_NICKNAME_ERROR_TEXT_TEMPLATE = "web_form_nickname_error_text.png"
WEB_FORM_PASSWORD = "Rocha145"
WEB_FORM_TYPING_INTERVAL_SECONDS = 0.10
WEB_FORM_MAX_ERROR_RETRIES = 5
WEB_CONSENT_MATCH_THRESHOLD = 0.68
WEB_CONSENT_APPEARANCE_GRACE_SECONDS = 2.0
WEB_FORM_ERROR_TEXT_MATCH_THRESHOLD = 0.80
WEB_FORM_ERROR_REFRESH_DELAY_SECONDS = 5.0
IP_CHECK_COPY_TIMEOUT_SECONDS = 25.0
IP_CHECK_MIN_WAIT_SECONDS = 1.25
TEMPLATE_MATCH_SCALES = (1.0, 0.9, 1.1, 0.8, 1.2, 1.25, 0.75, 1.33, 1.5, 0.67)
DEBUG_SCREENSHOTS_DIR = APPLICATION_DIR / "debug_screenshots"
CLICK_DEBUG_SCREENSHOTS_DIR = APPLICATION_DIR / "click_debug"
CLICK_DEBUG_ENABLED = True
CONTAINER_OK_MIN_CONFIDENCE = 0.76

LEGACY_PERSON_NAMES = [
    "Alexandrina Melo",
    "Bernardina Luz",
    "Roxana Tavares",
    "Domenica Freitas",
    "Quirina Bastos",
    "Fernanda Queiroz",
    "Gabrielle Moura",
    "Isabela Duarte",
    "Julieta Ramos",
    "Larissa Fontes",
    "Marcela Vieira",
    "Natassia Brito",
    "Olivia Cardoso",
    "Patricia Azevedo",
    "Renata Coelho",
    "Sabrina Peixoto",
    "Tatiana Ribeiro",
    "Vanessa Sampaio",
    "Yasmim Ferreira",
    "Zulema Barros",
    "Ariella",
    "Betania",
    "Cecile",
    "Denise",
    "Eugenia",
    "Florenca",
    "Genilda",
    "Heloane",
    "Isis",
    "Jacira",
    "Kellyane",
    "Lidiane",
    "Nubia",
    "Odilia",
    "Petula",
    "Salete",
    "Ticiane",
    "Vanda",
    "Yvette",
    "Zelma",
    "Adelaide",
    "Brigitte",
    "Cassia",
    "Darlene",
    "Edna",
    "Francine",
    "Gilda",
    "Henriqueta",
    "Jussara",
    "Karla",
    "Lucinda",
    "Marlene",
    "Nilda",
    "Otavia",
    "Pamela",
    "Rosana",
    "Silvana",
    "Teresa",
    "Wanessa",
    "Zoraide",
    "Aurelia",
    "Bernadete",
    "Carmela",
    "Deise",
    "Eloisa",
    "Fabiane",
    "Graziele",
    "Heidi",
    "Iolanda",
    "Joice",
    "Katiane",
    "Luciene",
    "Marli",
    "Neide",
    "Orlanda",
    "Prudencia",
    "Raisa",
    "Solange",
    "Tania",
    "Valquiria",
    "Clarice",
    "Dorothea",
    "Elvira",
    "Filomena",
    "Geraldine",
    "Hilda",
    "Iracema",
    "Janete",
    "Kassia",
    "Leonora",
    "Marina",
    "Nadine",
    "Ofelia",
    "Pietra",
    "Roberta",
    "Sueli",
    "Tamara",
    "Vilma",
    "Yolanda",
    "Zenaide",
    "Anastacia",
    "Belinda",
    "Carlota",
    "Dafne",
    "Emilly",
    "Frida",
    "Georgina",
    "Hortencia",
    "Ivete",
    "Josefina",
    "Lavinia",
    "Madalena",
    "Olga",
    "Penelope",
    "Quiteria",
    "Ramona",
    "Selma",
    "Tarsila",
    "Vania",
    "Zuleica",
    "Beatrice",
    "Celeste",
    "Esther",
    "Felicia",
    "Greta",
    "Isabelly",
    "Jasmin",
    "Louise",
    "Miranda",
    "Naomi",
    "Paola",
    "Ravenna",
    "Serena",
    "Thais",
    "Ursula",
    "Wendy",
    "Yasmina",
    "Zara",
    "Valentina",
    "Antonella",
    "Dominique",
    "Alessandra",
    "Franciele",
    "Maristela",
    "Rosangela",
    "Veronica",
    "Luciana",
    "Adriana",
    "Camila",
    "Deborah",
    "Cintia",
    "Dalva",
    "Emanuela",
    "Fabiola",
    "Gisele",
    "Ilana",
    "Janaina",
    "Katia",
    "Leila",
    "Marcia",
    "Neusa",
    "Odete",
    "Regina",
    "Silvia",
    "Telma",
    "Zilda",
    "Sol",
    "Nara",
    "Lola",
    "Mina",
    "Teca",
    "Bia",
    "Luma",
    "Nalu",
    "Rita",
    "Duda",
    "Mara",
    "Lina",
    "Tina",
    "Nika",
    "Leda",
    "Mira",
    "Nanda",
    "Sonia",
    "Nelia",
    "Luce",
    "Luna",
    "Maya",
    "Nina",
    "Clara",
    "Aurora",
    "Lara",
    "Malu",
    "Cora",
    "Eva",
    "Iris",
    "Maite",
    "Lia",
    "Mel",
    "Violeta",
    "Amora",
    "Cloe",
    "Dora",
    "Elena",
    "Flora",
    "Gaia",
    "Hanna",
    "Kiara",
    "Lua",
    "Mila",
    "Noa",
    "Pilar",
    "Rosa",
    "Stella",
    "Zoe",
    "Ayla",
    "Amanda",
    "Bianca",
    "Carolina",
    "Daniela",
    "Eduarda",
    "Fernanda",
    "Giovana",
    "Helena",
    "Isadora",
    "Juliana",
    "Karina",
    "Leticia",
    "Mariana",
    "Natalia",
    "Olivia",
    "Priscila",
    "Renata",
    "Sabrina",
    "Tatiana",
    "Vanessa",
    "Aline",
    "Bruna",
    "Cecilia",
    "Debora",
    "Elaine",
    "Flavia",
    "Gabriela",
    "Heloisa",
    "Iasmin",
    "Jessica",
    "Kelly",
    "Larissa",
    "Manuela",
    "Naiara",
    "Patricia",
    "Raissa",
    "Simone",
    "Talita",
    "Viviane",
    "Yasmin",
    "Agatha",
    "Barbara",
    "Clarissa",
    "Diana",
    "Estela",
    "Fabiana",
    "Geovana",
    "Ingrid",
    "Joana",
    "Lorena",
    "Monica",
    "Paula",
    "Rebeca",
    "Sofia",
    "Valeria",
    "Alice",
    "Bela",
    "Catarina",
    "Dandara",
    "Ester",
    "Fatima",
    "Gloria",
    "Irene",
    "Livia",
    "Mirela",
    "Nicole",
    "Rafaela",
    "Samara",
    "Taina",
    "Vitoria",
    "Alana",
    "Beatriz",
    "Cristina",
    "Daiane",
    "Elisa",
    "Francisca",
    "Grazi",
    "Ivana",
    "Laisa",
    "Marta",
    "Noemi",
    "Rute",
    "Sara",
    "Tereza",
    "Vera",
]

DEFAULT_PERSON_NAMES: list[str] = []
PERSON_NAMES = list(DEFAULT_PERSON_NAMES)

BANNED_NAME_FRAGMENTS = {
    "rafael",
    "lucas",
    "mateus",
    "bruno",
    "amanda",
    "bianca",
    "carolina",
    "luna",
    "maya",
    "nina",
    "sol",
    "cintia",
    "valentina",
    "antonella",
    "dominique",
    "alessandra",
    "franciele",
    "maristela",
    "rosangela",
    "veronica",
    "luciana",
    "adriana",
    "camila",
    "deborah",
    "beatrice",
    "celeste",
    "esther",
    "felicia",
    "greta",
    "isabelly",
    "jasmin",
    "louise",
    "miranda",
    "naomi",
    "paola",
    "ravenna",
    "serena",
    "thais",
    "ursula",
    "wendy",
    "yasmina",
    "zara",
    "anastacia",
    "belinda",
    "carlota",
    "dafne",
    "emilly",
    "frida",
    "georgina",
    "hortencia",
    "ivete",
    "josefina",
    "lavinia",
    "madalena",
    "olga",
    "penelope",
    "quiteria",
    "ramona",
    "selma",
    "tarsila",
    "vania",
    "zuleica",
    "clarice",
    "dorothea",
    "elvira",
    "filomena",
    "geraldine",
    "hilda",
    "iracema",
    "janete",
    "kassia",
    "leonora",
    "marina",
    "nadine",
    "ofelia",
    "pietra",
    "roberta",
    "sueli",
    "tamara",
    "vilma",
    "yolanda",
    "zenaide",
    "aurelia",
    "bernadete",
    "carmela",
    "deise",
    "eloisa",
    "fabiane",
    "graziele",
    "heidi",
    "iolanda",
    "joice",
    "katiane",
    "luciene",
    "marli",
    "neide",
    "orlanda",
    "prudencia",
    "raisa",
    "solange",
    "tania",
    "valquiria",
    "adelaide",
    "brigitte",
    "cassia",
    "darlene",
    "edna",
    "francine",
    "gilda",
    "henriqueta",
    "jussara",
    "karla",
    "lucinda",
    "marlene",
    "nilda",
    "otavia",
    "pamela",
    "rosana",
    "silvana",
    "teresa",
    "wanessa",
    "zoraide",
    "ariella",
    "betania",
    "cecile",
    "denise",
    "eugenia",
    "florenca",
    "genilda",
    "heloane",
    "isis",
    "jacira",
    "kellyane",
    "lidiane",
    "nubia",
    "odilia",
    "petula",
    "salete",
    "ticiane",
    "vanda",
    "yvette",
    "zelma",
}


class UiElementNotFound(RuntimeError):
    """Raised when a template is not found on screen before timeout."""


class AutomationStopped(RuntimeError):
    """Raised when the UI panel requests automation stop."""


@dataclass(frozen=True)
class NetworkScenario:
    scenario_name: str
    proxy_host: str
    proxy_port: int
    proxy_user: str | None = None
    proxy_pass: str | None = None
    proxy_scheme: str = "http"

    @property
    def proxy_url(self) -> str:
        # Multi-Account Containers represents SOCKS5 as "socks".
        scheme = "socks" if self.proxy_scheme == "socks5" else self.proxy_scheme
        if self.proxy_user or self.proxy_pass:
            user = self.proxy_user or ""
            password = self.proxy_pass or ""
            return f"{scheme}://{user}:{password}@{self.proxy_host}:{self.proxy_port}"
        return f"{scheme}://{self.proxy_host}:{self.proxy_port}"


@dataclass(frozen=True)
class Match:
    x: int
    y: int
    width: int
    height: int
    confidence: float

    @property
    def center(self) -> tuple[int, int]:
        return self.x + self.width // 2, self.y + self.height // 2


class VisualAutomator:
    def __init__(
        self,
        templates_dir: Path,
        *,
        confidence: float,
        action_pause: float,
        dry_run: bool = False,
        control_hook: Callable[[], None] | None = None,
    ) -> None:
        self.templates_dir = templates_dir
        self.confidence = confidence
        self.action_pause = action_pause
        self.dry_run = dry_run
        self.control_hook = control_hook
        self._template_cache: dict[str, list[tuple[float, np.ndarray]]] = {}
        self._click_debug_sequence = 0
        # As funcoes abaixo ja aplicam action_pause. Mantenha apenas uma pausa
        # interna curta no PyAutoGUI para nao pagar a mesma espera duas vezes.
        pyautogui.PAUSE = min(0.06, max(0.01, action_pause / 5))
        screen_width, screen_height = pyautogui.size()
        print(
            f"[ambiente] Tela detectada: {screen_width}x{screen_height}. "
            f"Templates: {templates_dir}. Escalas OpenCV: "
            + ", ".join(f"{scale:.2f}" for scale in TEMPLATE_MATCH_SCALES)
        )

    def click_image(
        self,
        template_name: str,
        description: str,
        *,
        timeout: float = 15,
        prefer: str = "best",
        x_offset: int = 0,
        y_offset: int = 0,
    ) -> Match:
        self._checkpoint()
        match = self.wait_for_image(template_name, description, timeout=timeout, prefer=prefer)
        x, y = match.center
        x += x_offset
        y += y_offset
        print(f"[ui] Clique em {description}: ({x}, {y}) conf={match.confidence:.3f}")
        self._checkpoint()
        if not self.dry_run:
            self.save_click_debug_screenshot(description, x, y, match=match)
            highlight_rect(match.x, match.y, match.width, match.height, duration=0.65)
            pyautogui.moveTo(x, y, duration=0.4, tween=pyautogui.easeOutQuad)
            pyautogui.click()
        time.sleep(self.action_pause)
        return match

    def click_match(
        self,
        match: Match,
        description: str,
        *,
        x_offset: int = 0,
        y_offset: int = 0,
    ) -> None:
        self._checkpoint()
        x, y = match.center
        x += x_offset
        y += y_offset
        print(f"[ui] Clique em {description}: ({x}, {y}) conf={match.confidence:.3f}")
        if not self.dry_run:
            self.save_click_debug_screenshot(description, x, y, match=match)
            highlight_rect(match.x, match.y, match.width, match.height, duration=0.20)
            pyautogui.moveTo(x, y, duration=0.15, tween=pyautogui.easeOutQuad)
            pyautogui.click()
        time.sleep(self.action_pause)

    def click_optional(
        self,
        template_name: str,
        description: str,
        *,
        timeout: float = 3,
        prefer: str = "best",
        x_offset: int = 0,
        y_offset: int = 0,
    ) -> bool:
        try:
            self.click_image(
                template_name,
                description,
                timeout=timeout,
                prefer=prefer,
                x_offset=x_offset,
                y_offset=y_offset,
            )
            return True
        except (FileNotFoundError, UiElementNotFound):
            return False

    def wait_for_image(
        self,
        template_name: str,
        description: str,
        *,
        timeout: float,
        prefer: str = "best",
    ) -> Match:
        deadline = time.time() + timeout
        last_confidence = 0.0
        while time.time() < deadline:
            self._checkpoint()
            matches = self.locate_all(template_name)
            if matches:
                if prefer == "bottom":
                    return max(matches, key=lambda item: (item.y, item.confidence))
                if prefer == "top":
                    return min(matches, key=lambda item: (item.y, -item.confidence))
                return max(matches, key=lambda item: item.confidence)
            last_confidence = self.last_confidence(template_name)
            time.sleep(0.2)

        screenshot_path = self.save_debug_screenshot(template_name, description, last_confidence)
        raise UiElementNotFound(
            f"Nao encontrei {description} usando {template_name}. "
            f"Melhor confianca observada: {last_confidence:.3f}. "
            f"Screenshot salvo em: {screenshot_path}"
        )

    def locate_all(
        self,
        template_name: str,
        *,
        confidence: float | None = None,
    ) -> list[Match]:
        template_path = self.templates_dir / template_name
        if not template_path.exists():
            raise FileNotFoundError(f"Template nao encontrado: {template_path}")

        screen = self._screenshot_gray()
        match_threshold = self.confidence if confidence is None else confidence
        candidates = []
        for _scale, template in self._scaled_templates(template_name):
            if template.shape[0] > screen.shape[0] or template.shape[1] > screen.shape[1]:
                continue

            result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
            ys, xs = np.where(result >= match_threshold)
            height, width = template.shape[:2]
            for x, y in zip(xs, ys):
                candidates.append(Match(int(x), int(y), int(width), int(height), float(result[y, x])))

        candidates.sort(key=lambda item: item.confidence, reverse=True)
        return self._dedupe_matches(candidates)

    def last_confidence(self, template_name: str) -> float:
        screen = self._screenshot_gray()
        best_conf = 0.0
        try:
            scaled_templates = self._scaled_templates(template_name)
        except FileNotFoundError:
            return 0.0
        for _scale, template in scaled_templates:
            if template.shape[0] > screen.shape[0] or template.shape[1] > screen.shape[1]:
                continue

            result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
            conf = float(cv2.minMaxLoc(result)[1])
            if conf > best_conf:
                best_conf = conf
        return best_conf

    def _scaled_templates(self, template_name: str) -> list[tuple[float, np.ndarray]]:
        cached = self._template_cache.get(template_name)
        if cached is not None:
            return cached

        template_path = self.templates_dir / template_name
        if not template_path.exists():
            raise FileNotFoundError(f"Template nao encontrado: {template_path}")
        original_template = cv2.imread(str(template_path), cv2.IMREAD_GRAYSCALE)
        if original_template is None:
            raise FileNotFoundError(f"Nao consegui abrir o template: {template_path}")

        scaled_templates: list[tuple[float, np.ndarray]] = []
        seen_sizes: set[tuple[int, int]] = set()
        for scale in TEMPLATE_MATCH_SCALES:
            new_w = max(1, int(round(original_template.shape[1] * scale)))
            new_h = max(1, int(round(original_template.shape[0] * scale)))
            if new_w < 8 or new_h < 8 or (new_w, new_h) in seen_sizes:
                continue
            seen_sizes.add((new_w, new_h))
            if scale == 1.0:
                scaled = original_template
            else:
                interpolation = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
                scaled = cv2.resize(original_template, (new_w, new_h), interpolation=interpolation)
            scaled_templates.append((scale, scaled))

        self._template_cache[template_name] = scaled_templates
        return scaled_templates

    def save_debug_screenshot(self, template_name: str, description: str, confidence: float) -> str:
        try:
            DEBUG_SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_template = re.sub(r"[^a-zA-Z0-9_.-]+", "_", template_name)
            path = DEBUG_SCREENSHOTS_DIR / f"{stamp}_{safe_template}_{confidence:.3f}.png"
            screenshot = pyautogui.screenshot()
            screenshot.save(path)
            print(
                f"[debug] Falha reconhecendo {description}; screenshot salvo em {path}"
            )
            return str(path)
        except Exception as exc:
            return f"nao foi possivel salvar screenshot ({exc})"

    def save_click_debug_screenshot(
        self,
        description: str,
        x: int,
        y: int,
        *,
        match: Match | None = None,
    ) -> str | None:
        if not CLICK_DEBUG_ENABLED:
            return None
        try:
            CLICK_DEBUG_SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
            self._click_debug_sequence += 1
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            safe_description = re.sub(r"[^a-zA-Z0-9_.-]+", "_", description).strip("_")[:70]
            path = CLICK_DEBUG_SCREENSHOTS_DIR / (
                f"{self._click_debug_sequence:04d}_{stamp}_{safe_description}.png"
            )
            image = pyautogui.screenshot().convert("RGB")
            draw = ImageDraw.Draw(image)
            if match is not None:
                draw.rectangle(
                    [match.x, match.y, match.x + match.width, match.y + match.height],
                    outline=(0, 255, 255),
                    width=4,
                )
                draw.text(
                    (match.x, max(0, match.y - 18)),
                    f"match {match.confidence:.3f}",
                    fill=(0, 255, 255),
                )
            draw.line((x - 28, y, x + 28, y), fill=(255, 0, 0), width=5)
            draw.line((x, y - 28, x, y + 28), fill=(255, 0, 0), width=5)
            draw.ellipse((x - 9, y - 9, x + 9, y + 9), outline=(255, 255, 0), width=4)
            label = f"{self._click_debug_sequence:04d} {description} ({x},{y})"
            label_x = min(max(6, x + 12), max(6, image.width - 520))
            label_y = min(max(6, y + 12), max(6, image.height - 36))
            draw.rectangle(
                [label_x - 4, label_y - 4, label_x + 510, label_y + 24],
                fill=(0, 0, 0),
                outline=(255, 0, 0),
            )
            draw.text((label_x, label_y), label, fill=(255, 255, 255))
            image.save(path)
            print(f"[debug] Clique marcado em: {path}")
            return str(path)
        except Exception as exc:
            print(f"[debug] Nao consegui salvar o print do clique: {exc}")
            return None

    def paste_text(self, value: str, *, select_existing: bool = True) -> None:
        print(f"[ui] Digitando: {value}")
        self._checkpoint()
        if self.dry_run:
            return
        if select_existing:
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.1)
        pyperclip.copy(value)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(self.action_pause)

    def type_text(
        self,
        value: str,
        *,
        select_existing: bool = True,
        interval: float = WEB_FORM_TYPING_INTERVAL_SECONDS,
    ) -> None:
        print(f"[ui] Digitando com efeito: {value}")
        self._checkpoint()
        if self.dry_run:
            return
        if select_existing:
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.1)
        pyautogui.write(value, interval=interval)
        time.sleep(self.action_pause)

    def press(self, key: str) -> None:
        print(f"[ui] Tecla: {key}")
        self._checkpoint()
        if not self.dry_run:
            pyautogui.press(key)
        time.sleep(self.action_pause)

    def hotkey(self, *keys: str) -> None:
        print(f"[ui] Atalho: {'+'.join(keys)}")
        self._checkpoint()
        if not self.dry_run:
            pyautogui.hotkey(*keys)
        time.sleep(self.action_pause)

    def scroll(self, clicks: int, *, fast: bool = False) -> None:
        print(f"[ui] Scroll: {clicks}")
        self._checkpoint()
        if not self.dry_run:
            old_pause = pyautogui.PAUSE
            try:
                if fast:
                    pyautogui.PAUSE = 0.0
                pyautogui.scroll(clicks)
            finally:
                pyautogui.PAUSE = old_pause
        time.sleep(0.06 if fast else min(self.action_pause, 0.25))

    def move_point(self, x: int, y: int, description: str) -> None:
        print(f"[ui] Mouse em {description}: ({x}, {y})")
        self._checkpoint()
        if not self.dry_run:
            pyautogui.moveTo(x, y, duration=0.4, tween=pyautogui.easeOutQuad)
        time.sleep(self.action_pause)

    def drag_point(self, from_x: int, from_y: int, to_x: int, to_y: int, description: str) -> None:
        print(f"[ui] Arrastar {description}: ({from_x}, {from_y}) -> ({to_x}, {to_y})")
        self._checkpoint()
        if not self.dry_run:
            pyautogui.moveTo(from_x, from_y, duration=0.4, tween=pyautogui.easeOutQuad)
            pyautogui.dragTo(to_x, to_y, duration=0.6, button="left")
        time.sleep(self.action_pause)

    def click_point(self, x: int, y: int, description: str) -> None:
        print(f"[ui] Clique em {description}: ({x}, {y})")
        self._checkpoint()
        if not self.dry_run:
            self.save_click_debug_screenshot(description, x, y)
            highlight_rect(x - 18, y - 18, 36, 36, duration=0.65)
            pyautogui.moveTo(x, y, duration=0.4, tween=pyautogui.easeOutQuad)
            pyautogui.click()
        time.sleep(self.action_pause)

    def _checkpoint(self) -> None:
        if self.control_hook:
            self.control_hook()

    def _screenshot_gray(self) -> np.ndarray:
        return cv2.cvtColor(self._screenshot_bgr(), cv2.COLOR_BGR2GRAY)

    def _screenshot_bgr(self) -> np.ndarray:
        screenshot = pyautogui.screenshot()
        rgb = np.array(screenshot)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    @staticmethod
    def _dedupe_matches(candidates: Iterable[Match]) -> list[Match]:
        unique: list[Match] = []
        for candidate in candidates:
            center_x, center_y = candidate.center
            too_close = False
            for accepted in unique:
                accepted_x, accepted_y = accepted.center
                if abs(center_x - accepted_x) < candidate.width and abs(center_y - accepted_y) < candidate.height:
                    too_close = True
                    break
            if not too_close:
                unique.append(candidate)
        return unique


def container_list_scroll_area(
    automator: VisualAutomator,
    *,
    reference: Match | None = None,
    reference_mode: str = "below",
) -> tuple[int, int, int, int, int]:
    """Return safe coordinates for scrolling inside the MAC container list."""
    width, height = pyautogui.size()
    row_matches: list[Match] = []
    for template_name in ("container_row_menu_button.png", "container_row_arrow.png"):
        try:
            row_matches.extend(automator.locate_all(template_name))
        except (FileNotFoundError, UiElementNotFound):
            continue

    visible_rows = [
        match
        for match in row_matches
        if 110 <= match.center[1] <= height - 60
    ]
    if visible_rows:
        visible_rows.sort(key=lambda item: item.center[1])
        right_x = max(match.center[0] for match in visible_rows)
        top_y = visible_rows[0].center[1]
        bottom_y = visible_rows[-1].center[1]
        scroll_x = max(60, min(width - 60, right_x - 250))
        scroll_y = max(130, min(height - 90, bottom_y))
        scrollbar_x = max(60, min(width - 12, right_x + 24))
        drag_from_y = max(120, top_y - 45)
        drag_to_y = min(height - 80, bottom_y + 90)
        if drag_to_y <= drag_from_y + 40:
            drag_to_y = min(height - 80, drag_from_y + 220)
        return scroll_x, scroll_y, scrollbar_x, drag_from_y, drag_to_y

    if reference:
        ref_center_x, ref_center_y = reference.center
        if reference_mode == "above":
            scroll_y = max(120, ref_center_y - 190)
            drag_from_y = max(120, ref_center_y - 430)
            drag_to_y = max(120, ref_center_y - 18)
        else:
            scroll_y = min(height - 120, ref_center_y + 430)
            drag_from_y = max(120, scroll_y - 260)
            drag_to_y = min(height - 80, scroll_y + 330)
        scroll_x = max(60, min(width - 60, ref_center_x))
        scrollbar_x = max(60, min(width - 12, reference.x + reference.width + 8))
        return scroll_x, scroll_y, scrollbar_x, drag_from_y, drag_to_y

    current_x, current_y = pyautogui.position()
    scroll_x = max(60, min(width - 60, int(current_x)))
    scroll_y = max(130, min(height - 90, int(current_y) + 160))
    scrollbar_x = max(60, min(width - 12, scroll_x + 245))
    return scroll_x, scroll_y, scrollbar_x, max(120, scroll_y - 260), min(height - 80, scroll_y + 330)


def main() -> int:
    args = parse_args()

    try:
        scenarios = load_scenarios(Path(args.config))
    except Exception as exc:
        print(f"[erro] Falha ao ler configuracao: {exc}", file=sys.stderr)
        return 2

    if not scenarios:
        print("[erro] Nenhum cenario encontrado no JSON.", file=sys.stderr)
        return 2

    templates_dir = Path(args.templates).resolve()
    automator = VisualAutomator(
        templates_dir,
        confidence=args.confidence,
        action_pause=args.pause,
        dry_run=args.dry_run,
    )

    print(f"[info] {len(scenarios)} cenario(s) carregado(s).")
    print(f"[info] Templates: {templates_dir}")

    if args.dry_run:
        validate_template_files(templates_dir)
        for scenario in scenarios:
            print(f"[dry-run] {scenario.scenario_name}: {scenario.proxy_url}")
        print("[dry-run] JSON e templates obrigatorios validados. Nenhum clique foi executado.")
        return 0

    try:
        start_firefox(args.firefox, args.profile, args.startup_wait, args.dry_run)
        if not args.skip_startup_panels:
            dismiss_startup_panels(automator)
        for index, scenario in enumerate(scenarios, start=1):
            print(f"\n[cenario {index}/{len(scenarios)}] {scenario.scenario_name}")
            configure_scenario(automator, scenario, args, scenario_index=index)
            if args.validate_after_setup:
                validate_latest_created_scenario(automator, scenario, args)
    except KeyboardInterrupt:
        print("\n[interrompido] Automacao interrompida pelo usuario.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[erro] Automacao interrompida: {exc}", file=sys.stderr)
        return 1
    finally:
        if not args.dry_run:
            pyperclip.copy("")

    print("\n[ok] Configuracao visual concluida.")
    print("Valide manualmente cada container abrindo https://ipinfo.io nele e conferindo o IP/rota esperados.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PoC visual para configurar proxies por container no Firefox Multi-Account Containers."
    )
    parser.add_argument("--config", default="network_scenarios.json", help="Arquivo JSON de cenarios.")
    parser.add_argument(
        "--templates",
        default=str(DEFAULT_TEMPLATES_DIR),
        help="Pasta com imagens PNG de referencia da UI.",
    )
    parser.add_argument(
        "--firefox",
        default=r"C:\Program Files\Mozilla Firefox\firefox.exe",
        help="Caminho do firefox.exe.",
    )
    parser.add_argument(
        "--profile",
        help="Perfil Firefox opcional. Use um perfil de laboratorio, nao o perfil pessoal.",
    )
    parser.add_argument("--confidence", type=float, default=0.86, help="Confianca minima do template matching.")
    parser.add_argument("--pause", type=float, default=0.25, help="Pausa entre acoes de UI, em segundos.")
    parser.add_argument("--startup-wait", type=float, default=4.0, help="Espera inicial apos abrir o Firefox.")
    parser.add_argument("--panel-wait", type=float, default=0.65, help="Espera curta apos abrir paineis da extensao.")
    parser.add_argument(
        "--validate-after-setup",
        action="store_true",
        help="Depois de criar/configurar cada container, abre o container recem-criado e confere o IP.",
    )
    parser.add_argument(
        "--ip-check-url",
        default="https://api.ipify.org",
        help="URL de validacao de IP. Use uma pagina que retorne o IP em texto simples.",
    )
    parser.add_argument(
        "--skip-startup-panels",
        action="store_true",
        help="Nao tenta clicar em Original profile / Not now quando paineis iniciais aparecem.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Valida imagens e fluxo sem clicar/digitar.")
    return parser.parse_args()


def load_scenarios(config_path: Path) -> list[NetworkScenario]:
    with config_path.expanduser().resolve().open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    return parse_scenarios_data(data)


def parse_scenarios_data(data: object) -> list[NetworkScenario]:
    if not isinstance(data, list):
        raise ValueError("network_scenarios.json precisa ser uma lista.")

    scenarios: list[NetworkScenario] = []
    for position, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Cenario #{position} precisa ser objeto JSON.")

        scenario_name = str(item.get("scenario_name") or "").strip()
        proxy_host = str(item.get("proxy_host") or "").strip()
        proxy_port = item.get("proxy_port")
        proxy_scheme = str(item.get("proxy_scheme") or "http").strip().lower()

        if not scenario_name:
            raise ValueError(f"Cenario #{position} sem scenario_name.")
        if not proxy_host:
            raise ValueError(f"Cenario {scenario_name} sem proxy_host.")
        if proxy_scheme not in SUPPORTED_SCHEMES:
            raise ValueError(
                f"Cenario {scenario_name} usa proxy_scheme invalido: {proxy_scheme}. "
                f"Use um de: {', '.join(sorted(SUPPORTED_SCHEMES))}."
            )
        try:
            proxy_port_int = int(proxy_port)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Cenario {scenario_name} tem proxy_port invalida: {proxy_port}") from exc
        if not 1 <= proxy_port_int <= 65535:
            raise ValueError(f"Cenario {scenario_name} tem porta fora do intervalo: {proxy_port_int}")

        scenarios.append(
            NetworkScenario(
                scenario_name=scenario_name,
                proxy_host=proxy_host,
                proxy_port=proxy_port_int,
                proxy_user=item.get("proxy_user"),
                proxy_pass=item.get("proxy_pass"),
                proxy_scheme=proxy_scheme,
            )
        )
    return scenarios


def parse_raw_proxy_lines(
    text: str,
    *,
    default_scheme: str = "http",
    name_prefix: str = "Conta",
    memory_path: Path | None = None,
    start_line: int = 1,
) -> list[NetworkScenario]:
    scheme = default_scheme.lower().strip()
    if scheme not in SUPPORTED_SCHEMES:
        raise ValueError(f"proxy_scheme padrao invalido: {default_scheme}")

    memory = load_name_memory(memory_path) if memory_path else None
    assignments = memory.setdefault("assignments", {}) if memory is not None else {}
    used_names = {
        value.get("scenario_name")
        for value in assignments.values()
        if isinstance(value, dict) and name_is_allowed(value.get("scenario_name"))
    }
    if memory is not None:
        used_names.update(
            str(name).strip()
            for name in memory.get("retired_names", [])
            if name_is_allowed(name)
        )

    scenarios: list[NetworkScenario] = []
    for position, raw_line in enumerate(text.splitlines(), start=1):
        if position < start_line:
            continue
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        parsed = parse_proxy_line(line, default_scheme=scheme)
        if memory is not None:
            fingerprint = proxy_fingerprint(parsed)
            assignment = assignments.get(fingerprint)
            if isinstance(assignment, dict) and assignment.get("discarded"):
                discarded_name = assignment.get("scenario_name") or f"linha {position}"
                print(
                    "[memoria] Pulando proxy descartado anteriormente: "
                    f"{discarded_name} ({parsed['host']}:{parsed['port']})."
                )
                continue
            if assignment and assignment.get("scenario_name"):
                scenario_name = str(assignment["scenario_name"])
            else:
                scenario_name = next_person_name(used_names)
                used_names.add(scenario_name)
                assignments[fingerprint] = {
                    "scenario_name": scenario_name,
                    "proxy_scheme": parsed["scheme"],
                    "proxy_host": parsed["host"],
                    "proxy_port": parsed["port"],
                    "proxy_user": parsed.get("user"),
                    "last_seen": time.strftime("%Y-%m-%dT%H:%M:%S"),
                }
        else:
            scenario_name = f"{name_prefix} {len(scenarios) + 1:02d}"

        scenarios.append(
            NetworkScenario(
                scenario_name=scenario_name,
                proxy_scheme=parsed["scheme"],
                proxy_host=parsed["host"],
                proxy_port=parsed["port"],
                proxy_user=parsed.get("user"),
                proxy_pass=parsed.get("password"),
            )
        )

    if not scenarios:
        raise ValueError("Nenhuma proxy encontrada na lista crua.")
    if memory_path and memory is not None:
        save_name_memory(memory_path, memory)
    return scenarios


def load_name_memory(memory_path: Path | None) -> dict[str, object]:
    if not memory_path:
        return {"version": 1, "assignments": {}}

    path = Path(memory_path).expanduser().resolve()
    if not path.exists():
        return {"version": 1, "assignments": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup = path.with_suffix(path.suffix + ".broken")
        path.replace(backup)
        return {"version": 1, "assignments": {}}
    if not isinstance(data, dict):
        return {"version": 1, "assignments": {}}
    if not isinstance(data.get("assignments"), dict):
        data["assignments"] = {}
    data["version"] = 1
    normalize_name_memory(data)
    return data


def save_name_memory(memory_path: Path, memory: dict[str, object]) -> None:
    path = Path(memory_path).expanduser().resolve()
    path.write_text(json.dumps(memory, indent=2, ensure_ascii=False), encoding="utf-8")


def name_is_allowed(name: object) -> bool:
    normalized = str(name or "").strip().casefold()
    return bool(normalized) and not any(fragment in normalized for fragment in BANNED_NAME_FRAGMENTS)


def normalize_person_names(names: object) -> list[str]:
    if isinstance(names, str):
        raw_names = names.splitlines()
    elif isinstance(names, list):
        raw_names = names
    else:
        raw_names = []

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_name in raw_names:
        name = re.sub(r"\s+", " ", str(raw_name or "")).strip()
        key = name.casefold()
        if not name or key in seen:
            continue
        if not name_is_allowed(name):
            continue
        normalized.append(name)
        seen.add(key)
    return normalized


def set_person_names(names: object) -> list[str]:
    custom_names = normalize_person_names(names)
    PERSON_NAMES[:] = custom_names
    return list(PERSON_NAMES)


def assert_person_name_is_active(name: str) -> None:
    normalized_active = {person.casefold() for person in PERSON_NAMES}
    if not normalized_active:
        raise ValueError("Adicione e salve nomes na aba Nomes antes de iniciar.")
    if name.strip().casefold() not in normalized_active:
        raise ValueError(
            f"O nome {name!r} nao esta na lista salva da aba Nomes. "
            "Salve a lista de nomes antes de iniciar."
        )


def apply_person_names_to_scenarios(scenarios: list[NetworkScenario]) -> list[NetworkScenario]:
    if not PERSON_NAMES:
        raise ValueError("Adicione nomes na aba Nomes antes de validar ou iniciar.")
    if len(PERSON_NAMES) < len(scenarios):
        raise ValueError(
            f"A lista tem {len(PERSON_NAMES)} nome(s), mas existem {len(scenarios)} proxy(s). "
            "Adicione mais nomes na aba Nomes."
        )
    used_names: set[str] = set()
    renamed: list[NetworkScenario] = []
    for scenario in scenarios:
        scenario_name = next_person_name(used_names)
        used_names.add(scenario_name)
        renamed.append(replace(scenario, scenario_name=scenario_name))
    return renamed


def normalize_name_memory(memory: dict[str, object]) -> None:
    assignments = memory.get("assignments")
    if not isinstance(assignments, dict):
        memory["assignments"] = {}
        return

    seen: set[str] = set()
    needs_rebuild = memory.get("name_set_version") != NAME_SET_VERSION
    for assignment in assignments.values():
        if not isinstance(assignment, dict):
            continue
        scenario_name = str(assignment.get("scenario_name") or "").strip()
        if not name_is_allowed(scenario_name) or scenario_name in seen:
            needs_rebuild = True
            break
        seen.add(scenario_name)

    if not needs_rebuild:
        return

    used_names: set[str] = {
        str(name).strip()
        for name in memory.get("retired_names", [])
        if name_is_allowed(name)
    }
    for assignment in assignments.values():
        if not isinstance(assignment, dict):
            continue
        scenario_name = next_person_name(used_names)
        assignment["scenario_name"] = scenario_name
        used_names.add(scenario_name)
        assignment["renamed_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")

    memory["last_created"] = None
    memory["name_set_version"] = NAME_SET_VERSION
    memory["name_phase"] = "norwegian_men_v1"
    memory["names_normalized_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")


def scenario_to_parsed_proxy(scenario: NetworkScenario) -> dict[str, object]:
    return {
        "scheme": scenario.proxy_scheme,
        "host": scenario.proxy_host,
        "port": scenario.proxy_port,
        "user": scenario.proxy_user,
        "password": scenario.proxy_pass,
    }


def register_last_created_scenario(
    scenario: NetworkScenario,
    *,
    memory_path: Path = DEFAULT_MEMORY_PATH,
) -> None:
    memory = load_name_memory(memory_path)
    assignments = memory.setdefault("assignments", {})
    fingerprint = proxy_fingerprint(scenario_to_parsed_proxy(scenario))
    assignments[fingerprint] = {
        "scenario_name": scenario.scenario_name,
        "proxy_scheme": scenario.proxy_scheme,
        "proxy_host": scenario.proxy_host,
        "proxy_port": scenario.proxy_port,
        "proxy_user": scenario.proxy_user,
        "last_seen": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "created": True,
    }
    memory["last_created"] = {
        "scenario_name": scenario.scenario_name,
        "proxy_host": scenario.proxy_host,
        "proxy_port": scenario.proxy_port,
        "proxy_scheme": scenario.proxy_scheme,
        "registered_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    save_name_memory(memory_path, memory)
    print(
        "[memoria] Registrei "
        f"{scenario.proxy_host}:{scenario.proxy_port} como {scenario.scenario_name}"
    )


def discard_scenario_from_future_runs(
    scenario: NetworkScenario,
    *,
    reason: str,
    memory_path: Path = DEFAULT_MEMORY_PATH,
) -> None:
    memory = load_name_memory(memory_path)
    assignments = memory.setdefault("assignments", {})
    retired_names = memory.setdefault("retired_names", [])
    if not isinstance(retired_names, list):
        retired_names = []
        memory["retired_names"] = retired_names

    fingerprint = proxy_fingerprint(scenario_to_parsed_proxy(scenario))
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
    if name_is_allowed(scenario.scenario_name) and scenario.scenario_name not in retired_names:
        retired_names.append(scenario.scenario_name)
    last_created = memory.get("last_created")
    if isinstance(last_created, dict) and last_created.get("scenario_name") == scenario.scenario_name:
        memory["last_created"] = None
    save_name_memory(memory_path, memory)
    print(
        "[memoria] Descartei para proximas execucoes: "
        f"{scenario.scenario_name} / {scenario.proxy_host}:{scenario.proxy_port}. Motivo: {reason}"
    )


def proxy_fingerprint(parsed: dict[str, object]) -> str:
    raw = "|".join(
        [
            str(parsed.get("scheme") or ""),
            str(parsed.get("host") or ""),
            str(parsed.get("port") or ""),
            str(parsed.get("user") or ""),
            str(parsed.get("password") or ""),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def next_person_name(used_names: set[str]) -> str:
    for candidate in PERSON_NAMES:
        if name_is_allowed(candidate) and candidate not in used_names:
            return candidate
    raise ValueError("Acabaram os nomes disponiveis na aba Nomes.")


def parse_proxy_line(line: str, *, default_scheme: str = "http") -> dict[str, object]:
    raw = line.strip()
    if not raw:
        raise ValueError("Linha de proxy vazia.")

    if "://" in raw:
        parsed = urlparse(raw)
        scheme = parsed.scheme.lower()
        if scheme not in SUPPORTED_SCHEMES:
            raise ValueError(f"Tipo de proxy invalido em {line}: {scheme}")
        if not parsed.hostname or not parsed.port:
            raise ValueError(f"Proxy invalida: {line}")
        return {
            "scheme": scheme,
            "host": parsed.hostname,
            "port": int(parsed.port),
            "user": unquote(parsed.username) if parsed.username else None,
            "password": unquote(parsed.password) if parsed.password else None,
        }

    if "@" in raw:
        credentials, endpoint = raw.rsplit("@", 1)
        user, password = credentials.split(":", 1) if ":" in credentials else (credentials, "")
        host, port = endpoint.rsplit(":", 1)
        return {
            "scheme": default_scheme,
            "host": host.strip(),
            "port": int(port),
            "user": user,
            "password": password,
        }

    parts = raw.split(":")
    if len(parts) == 2:
        host, port = parts
        return {
            "scheme": default_scheme,
            "host": host.strip(),
            "port": int(port),
            "user": None,
            "password": None,
        }
    if len(parts) >= 4:
        host, port, user = parts[0], parts[1], parts[2]
        password = ":".join(parts[3:])
        return {
            "scheme": default_scheme,
            "host": host.strip(),
            "port": int(port),
            "user": user,
            "password": password,
        }

    raise ValueError(f"Formato de proxy nao reconhecido: {line}")


def scenarios_to_json_data(scenarios: list[NetworkScenario]) -> list[dict[str, object]]:
    data: list[dict[str, object]] = []
    for scenario in scenarios:
        item: dict[str, object] = {
            "scenario_name": scenario.scenario_name,
            "proxy_scheme": scenario.proxy_scheme,
            "proxy_host": scenario.proxy_host,
            "proxy_port": scenario.proxy_port,
        }
        if scenario.proxy_user:
            item["proxy_user"] = scenario.proxy_user
        if scenario.proxy_pass:
            item["proxy_pass"] = scenario.proxy_pass
        data.append(item)
    return data


def validate_template_files(templates_dir: Path) -> None:
    required = [
        "extension_icon.png",
        "manage_containers_button.png",
        "new_container_button.png",
        "container_ok_button.png",
        "advanced_proxy_settings_button.png",
        "proxy_auth_cancel_button.png",
    ]
    missing = [name for name in required if not (templates_dir / name).exists()]
    has_container_locator = (
        (templates_dir / "container_row_menu_button.png").exists()
        or (templates_dir / "container_row_arrow.png").exists()
    )

    if missing:
        raise FileNotFoundError("Templates obrigatorios ausentes: " + ", ".join(missing))
    if not has_container_locator:
        raise FileNotFoundError(
            "Adicione container_row_menu_button.png ou container_row_arrow.png em mac_ui_templates."
        )


def visible_windows_for_executables(executable_names: set[str]) -> list[int]:
    if sys.platform != "win32":
        return []

    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    process_query_limited_information = 0x1000
    normalized_names = {name.casefold() for name in executable_names}
    handles: list[int] = []

    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    def process_name(hwnd: int) -> str:
        process_id = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
        process_handle = kernel32.OpenProcess(
            process_query_limited_information,
            False,
            process_id.value,
        )
        if not process_handle:
            return ""
        try:
            buffer = ctypes.create_unicode_buffer(32768)
            size = wintypes.DWORD(len(buffer))
            if not kernel32.QueryFullProcessImageNameW(
                process_handle,
                0,
                buffer,
                ctypes.byref(size),
            ):
                return ""
            return Path(buffer.value).name.casefold()
        finally:
            kernel32.CloseHandle(process_handle)

    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    @callback_type
    def collect(hwnd: int, _lparam: int) -> bool:
        if not user32.IsWindowVisible(hwnd) or user32.GetWindowTextLengthW(hwnd) <= 0:
            return True
        if process_name(hwnd) in normalized_names:
            handles.append(int(hwnd))
        return True

    user32.EnumWindows(collect, 0)
    return handles


def minimize_dashboard_browser_windows() -> int:
    if sys.platform != "win32":
        return 0
    import ctypes

    browser_names = {
        "chrome.exe",
        "msedge.exe",
        "brave.exe",
        "opera.exe",
        "vivaldi.exe",
    }
    handles = visible_windows_for_executables(browser_names)
    for handle in handles:
        ctypes.windll.user32.ShowWindow(handle, 6)  # SW_MINIMIZE
    return len(handles)


def maximize_firefox_window(previous_handles: set[int]) -> bool:
    if sys.platform != "win32":
        return False
    import ctypes

    firefox_handles = visible_windows_for_executables({"firefox.exe"})
    if not firefox_handles:
        return False
    new_handles = [handle for handle in firefox_handles if handle not in previous_handles]
    target = (new_handles or firefox_handles)[-1]
    user32 = ctypes.windll.user32
    user32.ShowWindow(target, 3)  # SW_MAXIMIZE
    user32.SetForegroundWindow(target)
    return True


def start_firefox(firefox_path: str, profile: str | None, startup_wait: float, dry_run: bool) -> None:
    command = [firefox_path, "-new-window", "about:blank"]
    if profile:
        command = [firefox_path, "-no-remote", "-profile", str(Path(profile).expanduser().resolve()), "about:blank"]

    print(f"[firefox] Iniciando: {' '.join(command)}")
    previous_firefox_windows: set[int] = set()
    if not dry_run:
        previous_firefox_windows = set(visible_windows_for_executables({"firefox.exe"}))
        minimized_count = minimize_dashboard_browser_windows()
        print(f"[janelas] {minimized_count} navegador(es) Chromium minimizado(s).")
        subprocess.Popen(command)
    time.sleep(startup_wait)
    if not dry_run:
        if maximize_firefox_window(previous_firefox_windows):
            print("[janelas] Firefox maximizado e colocado em primeiro plano.")
        else:
            print("[janelas] Nao encontrei uma janela visivel do Firefox para maximizar.")


def dismiss_startup_panels(automator: VisualAutomator) -> None:
    print("[firefox] Verificando paineis iniciais.")

    if automator.click_optional(
        "choose_profile_checkbox.png",
        "checkbox Choose a profile when Firefox opens",
        timeout=3,
    ):
        time.sleep(0.4)
        automator.click_optional("original_profile_card.png", "card Original profile", timeout=5)
        time.sleep(3.0)

    if automator.click_optional(
        "default_browser_checkbox.png",
        "checkbox Don't show this message again",
        timeout=3,
    ):
        time.sleep(0.3)
        automator.click_optional("not_now_button.png", "botao Not now", timeout=5)
        time.sleep(1.0)
    else:
        automator.click_optional("not_now_button.png", "botao Not now", timeout=2)


def configure_scenario(
    automator: VisualAutomator,
    scenario: NetworkScenario,
    args: argparse.Namespace,
    *,
    scenario_index: int = 1,
) -> None:
    try:
        maximize_firefox_window(set())
        open_extension_popup(automator, args.panel_wait)
        create_container(automator, scenario, scenario_index=scenario_index)
        panel_anchor = open_new_container_settings(automator, scenario)
        configure_proxy_for_open_container(automator, scenario, panel_anchor)
        register_last_created_scenario(scenario)
        close_extension_popup(automator)
    except UiElementNotFound:
        raise
    except Exception as exc:
        raise RuntimeError(f"Falha no cenario {scenario.scenario_name}: {exc}") from exc


def open_extension_popup(automator: VisualAutomator, panel_wait: float) -> None:
    automator.click_image("extension_icon.png", "icone da extensao Multi-Account Containers", timeout=20)
    time.sleep(panel_wait)


def locate_blue_action_button_near_container_form(
    automator: VisualAutomator,
    anchor: Match,
) -> Match | None:
    screen = automator._screenshot_bgr()
    screen_height, screen_width = screen.shape[:2]
    left = max(0, anchor.x - 40)
    right = min(screen_width, anchor.x + anchor.width + 40)
    top = min(screen_height - 1, anchor.y + 260)
    bottom = min(screen_height, anchor.y + 640)
    if right <= left or bottom <= top:
        return None

    crop = screen[top:bottom, left:right]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    blue_mask = cv2.inRange(
        hsv,
        np.array([92, 80, 80], dtype=np.uint8),
        np.array([124, 255, 255], dtype=np.uint8),
    )
    blue_mask = cv2.morphologyEx(
        blue_mask,
        cv2.MORPH_CLOSE,
        np.ones((7, 15), dtype=np.uint8),
    )
    contours, _ = cv2.findContours(
        blue_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    candidates: list[Match] = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if width < 110 or height < 28:
            continue
        area = width * height
        coverage = cv2.countNonZero(blue_mask[y : y + height, x : x + width]) / max(area, 1)
        if coverage < 0.55:
            continue
        candidates.append(Match(left + x, top + y, width, height, float(coverage)))

    if not candidates:
        return None
    # O botao OK/Done azul fica SEMPRE a direita do Cancel. Escolhemos o candidato com maior X.
    return max(candidates, key=lambda item: item.x)


def click_container_ok_precisely(automator: VisualAutomator, anchor: Match) -> None:
    screen_width, screen_height = pyautogui.size()
    form_left = max(0, anchor.x - 40)
    form_right = min(screen_width, anchor.x + anchor.width + 40)
    form_top = max(0, anchor.y + 250)
    form_bottom = min(screen_height, anchor.y + 650)
    threshold = max(CONTAINER_OK_MIN_CONFIDENCE, automator.confidence)

    ok_matches = [
        match
        for match in automator.locate_all("container_ok_button.png", confidence=threshold)
        if form_left <= match.center[0] <= form_right
        and form_top <= match.center[1] <= form_bottom
        and match.width >= 110
        and match.height >= 25
    ]
    if ok_matches:
        # Pega o match mais a DIREITA (OK fica a direita de Cancel)
        ok_match = max(ok_matches, key=lambda item: item.x)
        print(
            "[ui] OK do container escolhido a direita na area segura "
            f"({ok_match.center[0]},{ok_match.center[1]})."
        )
        automator.click_match(ok_match, "botao OK do container")
        return

    blue_button = locate_blue_action_button_near_container_form(automator, anchor)
    if blue_button is not None:
        print("[ui] Template do OK nao apareceu com seguranca; usando botao azul mais a direita na area do formulario.")
        automator.click_match(blue_button, "botao OK azul do container")
        return

    fallback_x = anchor.x + min(280, max(200, anchor.width - 60))
    fallback_y = max(form_top + 100, form_bottom - 60)
    print(f"[ui] Fallback seguro do OK a direita: ({fallback_x}, {fallback_y})")
    automator.click_point(fallback_x, fallback_y, "botao OK do container por fallback a direita")


def create_container(
    automator: VisualAutomator,
    scenario: NetworkScenario,
    *,
    scenario_index: int,
) -> None:
    assert_person_name_is_active(scenario.scenario_name)
    automator.click_image("manage_containers_button.png", "botao Manage Containers", timeout=15)
    new_button = automator.click_image("new_container_button.png", "botao New Container", timeout=15)
    time.sleep(0.45)

    # O painel de edicao abre na mesma area onde estava o botao New Container.
    # Primeiro tentamos localizar o input por template. Isso e mais robusto do
    # que coordenada fixa, porque a altura do popup muda conforme o Firefox.
    anchor_x = new_button.x
    anchor_y = new_button.y

    if automator.click_optional(
        "container_name_label.png",
        "rotulo Name do novo container",
        timeout=5,
        x_offset=210,
        y_offset=45,
    ):
        pass
    elif not automator.click_optional("container_name_input.png", "campo Name do novo container", timeout=3):
        name_x = anchor_x + 260
        name_y = anchor_y + 83
        automator.click_point(name_x, name_y, "campo Name do novo container por fallback")
    time.sleep(0.10)
    print(f"[ui] Nomeando container como: {scenario.scenario_name}")
    automator.paste_text(scenario.scenario_name)

    color_points = [
        (anchor_x + 84, anchor_y + 224),
        (anchor_x + 144, anchor_y + 224),
        (anchor_x + 204, anchor_y + 224),
        (anchor_x + 264, anchor_y + 224),
        (anchor_x + 324, anchor_y + 224),
        (anchor_x + 384, anchor_y + 224),
        (anchor_x + 444, anchor_y + 224),
        (anchor_x + 504, anchor_y + 224),
    ]
    icon_points = [
        (anchor_x + 84, anchor_y + 320),
        (anchor_x + 144, anchor_y + 320),
        (anchor_x + 204, anchor_y + 320),
        (anchor_x + 264, anchor_y + 320),
        (anchor_x + 324, anchor_y + 320),
        (anchor_x + 384, anchor_y + 320),
        (anchor_x + 444, anchor_y + 320),
        (anchor_x + 504, anchor_y + 320),
        (anchor_x + 84, anchor_y + 368),
        (anchor_x + 144, anchor_y + 368),
        (anchor_x + 204, anchor_y + 368),
        (anchor_x + 264, anchor_y + 368),
        (anchor_x + 324, anchor_y + 368),
    ]

    color_x, color_y = color_points[(scenario_index - 1) % len(color_points)]
    icon_x, icon_y = icon_points[(scenario_index - 1) % len(icon_points)]
    automator.click_point(color_x, color_y, "cor do container")
    automator.click_point(icon_x, icon_y, "icone do container")

    click_container_ok_precisely(automator, new_button)
    time.sleep(0.60)


def open_new_container_settings(automator: VisualAutomator, scenario: NetworkScenario) -> Match:
    print(f"[ui] Abrindo configuracoes do container recem-criado: {scenario.scenario_name}")

    new_button = automator.wait_for_image(
        "new_container_button.png",
        "botao New Container como referencia da lista gerenciada",
        timeout=6,
        prefer="top",
    )
    click_manage_container_by_live_name(
        automator,
        new_button,
        scenario.scenario_name,
    )
    time.sleep(0.35)
    opened_name = read_open_container_name(automator, new_button)
    print(
        f"[seguranca] Campo Name aberto: {opened_name!r}; "
        f"esperado: {scenario.scenario_name!r}."
    )
    if opened_name != scenario.scenario_name:
        automator.click_point(
            new_button.x + 36,
            max(45, new_button.y - 40),
            "voltar sem configurar proxy no container incorreto",
        )
        raise UiElementNotFound(
            f"A busca abriu {opened_name!r}, mas o esperado era "
            f"{scenario.scenario_name!r}; nenhum proxy foi aplicado."
        )
    print(
        f"[seguranca] Container reconhecido por OpenCV antes do proxy: "
        f"{scenario.scenario_name}. Indo direto para Advanced proxy settings."
    )
    return new_button


def read_open_container_name(
    automator: VisualAutomator,
    panel_anchor: Match,
) -> str:
    screen_width, screen_height = pyautogui.size()
    panel_left = max(0, panel_anchor.x)
    panel_right = min(screen_width, panel_anchor.x + panel_anchor.width)
    labels = [
        match
        for match in automator.locate_all("container_name_label.png")
        if panel_left <= match.center[0] <= panel_right
        and 45 <= match.center[1] <= min(screen_height // 2, 420)
    ]
    if labels:
        label = min(labels, key=lambda item: item.center[1])
        field_x = min(panel_right - 35, label.center[0] + 210)
        field_y = label.center[1] + 45
        automator.click_point(field_x, field_y, "campo Name para confirmacao exata")
    else:
        field_x = min(panel_right - 35, panel_anchor.x + 260)
        field_y = max(90, panel_anchor.y + 40)
        automator.click_point(field_x, field_y, "campo Name por fallback de confirmacao")

    pyperclip.copy("")
    automator.hotkey("ctrl", "a")
    automator.hotkey("ctrl", "c")
    return pyperclip.paste().strip()


def configure_proxy_for_open_container(
    automator: VisualAutomator,
    scenario: NetworkScenario,
    panel_anchor: Match,
) -> None:
    click_advanced_proxy_settings(automator, panel_anchor)
    time.sleep(0.60)

    # Se a permissao opcional ainda nao foi concedida, a extensao pode mostrar
    # um overlay de enable e o Firefox pode abrir uma confirmacao de permissao.
    if automator.click_optional("enable_proxy_permission_button.png", "botao Enable da permissao proxy", timeout=2):
        time.sleep(1.0)
        automator.click_optional("permission_allow_button.png", "confirmacao de permissao do Firefox", timeout=5)
        time.sleep(1.0)

    if automator.click_optional("advanced_proxy_input.png", "campo de proxy avancado", timeout=2):
        pass
    else:
        print("[ui] Template advanced_proxy_input.png ausente; usando fallback por teclado.")
        automator.press("tab")
        automator.press("tab")

    automator.paste_text(scenario.proxy_url)
    if not automator.click_optional("apply_to_container_button.png", "botao Apply to Container", timeout=2):
        print("[ui] Template apply_to_container_button.png ausente; usando fallback por teclado.")
        automator.press("tab")
        automator.press("tab")
        automator.press("enter")
    time.sleep(0.60)


def click_advanced_proxy_settings(
    automator: VisualAutomator,
    panel_anchor: Match,
) -> None:
    screen_width, screen_height = pyautogui.size()
    panel_left = max(0, panel_anchor.x)
    panel_right = min(screen_width, panel_anchor.x + panel_anchor.width)
    region_left = panel_left + 12
    region_right = panel_right - 12
    region_top = 70
    region_bottom = screen_height - 48
    region_width = region_right - region_left
    region_height = region_bottom - region_top
    if region_width < 200 or region_height < 180:
        raise UiElementNotFound("Area do painel pequena demais para procurar Advanced proxy settings.")

    scroll_x = panel_anchor.center[0]
    scroll_y = max(region_top + 100, min(region_bottom - 100, screen_height // 2))
    automator.move_point(scroll_x, scroll_y, "painel correto das configuracoes do container")
    text_templates = render_live_name_templates("Advanced proxy settings")
    stable_frames = 0
    stop_number = 0
    best_text_confidence = 0.0

    while True:
        stop_number += 1
        button_matches = [
            match
            for match in automator.locate_all("advanced_proxy_settings_button.png")
            if panel_left <= match.center[0] <= panel_right
            and region_top <= match.center[1] <= region_bottom
        ]
        if button_matches:
            button = max(button_matches, key=lambda item: item.confidence)
            automator.click_point(
                button.center[0],
                button.center[1],
                "Advanced proxy settings reconhecido pelo botao inteiro",
            )
            return

        gray_region = capture_gray_region(
            region_left,
            region_top,
            region_width,
            region_height,
        )
        text_match = locate_live_name_in_gray(
            gray_region,
            text_templates,
            origin_x=region_left,
            origin_y=region_top,
        )
        best_text_confidence = max(best_text_confidence, text_match.confidence)
        print(
            f"[proxy] Parada OpenCV {stop_number} procurando Advanced proxy settings: "
            f"texto={text_match.confidence:.3f}"
        )
        if text_match.confidence >= ADVANCED_TEXT_MATCH_THRESHOLD:
            automator.click_point(
                text_match.center[0],
                text_match.center[1],
                "texto Advanced proxy settings reconhecido pelo OpenCV",
            )
            return

        before = gray_region
        print("[proxy] Scroll rapido com sobreposicao dentro das configuracoes.")
        automator.scroll(ADVANCED_SCROLL_CLICKS, fast=True)
        time.sleep(0.12)
        after = capture_gray_region(
            region_left,
            region_top,
            region_width,
            region_height,
        )
        difference = float(np.mean(cv2.absdiff(before, after)))
        stable_frames = stable_frames + 1 if difference <= 0.85 else 0
        if stable_frames >= 3:
            break

    print("[proxy] Fim das configuracoes detectado; fazendo conferencia final do rodape.")
    automator.scroll(4, fast=True)
    time.sleep(0.14)
    automator.scroll(-16, fast=True)
    time.sleep(0.18)
    button_matches = [
        match
        for match in automator.locate_all("advanced_proxy_settings_button.png")
        if panel_left <= match.center[0] <= panel_right
        and region_top <= match.center[1] <= region_bottom
    ]
    if button_matches:
        button = max(button_matches, key=lambda item: item.confidence)
        automator.click_point(
            button.center[0],
            button.center[1],
            "Advanced proxy settings na conferencia final",
        )
        return

    gray_region = capture_gray_region(region_left, region_top, region_width, region_height)
    text_match = locate_live_name_in_gray(
        gray_region,
        text_templates,
        origin_x=region_left,
        origin_y=region_top,
    )
    best_text_confidence = max(best_text_confidence, text_match.confidence)
    if text_match.confidence >= ADVANCED_TEXT_MATCH_THRESHOLD:
        automator.click_point(
            text_match.center[0],
            text_match.center[1],
            "texto Advanced proxy settings na conferencia final",
        )
        return

    raise UiElementNotFound(
        "Advanced proxy settings nao apareceu ate o fim real do painel. "
        f"Melhor confianca do texto: {best_text_confidence:.3f}."
    )


def validate_configured_scenarios(
    automator: VisualAutomator,
    scenarios: list[NetworkScenario],
    args: argparse.Namespace,
) -> None:
    print("\n[validacao] Iniciando validacao de IP por container.")
    failures: list[str] = []
    for index, scenario in enumerate(scenarios, start=1):
        print(f"\n[validacao] {index}/{len(scenarios)} - {scenario.scenario_name}")
        try:
            open_container_tab_for_validation(automator, scenario, args.panel_wait)
            observed_ip = open_ip_check_and_copy(automator, args.ip_check_url)
            expected_ip = scenario.proxy_host.strip()
            print(f"[validacao] IP observado: {observed_ip}; esperado: {expected_ip}")
            if observed_ip != expected_ip:
                failures.append(
                    f"{scenario.scenario_name}: esperado {expected_ip}, observado {observed_ip}"
                )
                automator.hotkey("ctrl", "w")
                break
            automator.hotkey("ctrl", "w")
        except Exception as exc:
            failures.append(f"{scenario.scenario_name}: {exc}")
            try:
                automator.hotkey("ctrl", "w")
            except Exception:
                pass
            break

    if failures:
        raise RuntimeError("Validacao falhou: " + " | ".join(failures))

    print("[validacao] Todos os containers validados com sucesso.")


def validate_latest_created_scenario(
    automator: VisualAutomator,
    scenario: NetworkScenario,
    args: argparse.Namespace,
) -> None:
    print(f"\n[validacao] Validando ultimo container criado: {scenario.scenario_name}")
    print("[validacao] Se aparecer captcha, pause no painel, resolva manualmente e clique em Continuar.")
    tab_opened = False
    try:
        open_container_tab_for_validation(automator, scenario, args.panel_wait)
        tab_opened = True
        observed_ip = open_ip_check_and_copy(automator, args.ip_check_url)
        expected_ip = scenario.proxy_host.strip()
        print(f"[validacao] IP observado: {observed_ip}; esperado: {expected_ip}")
        if observed_ip != expected_ip:
            raise RuntimeError(f"esperado {expected_ip}, observado {observed_ip}")

        target_url = normalize_target_url(getattr(args, "target_url", ""))
        if target_url:
            navigate_to_target_site(automator, target_url)
            dismiss_test_site_consent_if_present(automator)
            fill_test_site_form(automator, scenario)
    except Exception:
        try:
            if tab_opened:
                automator.hotkey("ctrl", "w")
            else:
                automator.press("esc")
        except Exception:
            pass
        raise

    automator.hotkey("ctrl", "w")
    print(f"[validacao] OK: {scenario.scenario_name}")


def open_test_site_directly(
    automator: VisualAutomator,
    scenario: NetworkScenario,
    args: argparse.Namespace,
) -> None:
    target_url = normalize_target_url(getattr(args, "target_url", ""))
    if not target_url:
        return
    print(f"\n[cadastro] Abrindo site de teste diretamente no container: {scenario.scenario_name}")
    tab_opened = False
    try:
        open_container_tab_for_validation(automator, scenario, args.panel_wait)
        tab_opened = True
        navigate_to_target_site(automator, target_url, skip_ip_message=True)
        print("[cadastro] Aguardando 10 segundos para o site carregar completamente via proxy...")
        time.sleep(10.0)
        dismiss_test_site_consent_if_present(automator)
        fill_test_site_form(automator, scenario)
    except Exception:
        try:
            if tab_opened:
                automator.hotkey("ctrl", "w")
            else:
                automator.press("esc")
        except Exception:
            pass
        raise

    automator.hotkey("ctrl", "w")
    print(f"[cadastro] OK: {scenario.scenario_name}")


def open_container_tab_for_validation(
    automator: VisualAutomator,
    scenario: NetworkScenario,
    panel_wait: float,
) -> None:
    attempt = 0
    while True:
        attempt += 1
        print(
            f"[validacao] Tentativa segura {attempt} para abrir "
            f"{scenario.scenario_name}."
        )
        open_extension_popup(automator, panel_wait)
        time.sleep(0.25)

        manage_button = automator.wait_for_image(
            "manage_containers_button.png",
            "rodape Manage Containers para limitar a leitura ao vivo",
            timeout=10,
            prefer="bottom",
        )
        try:
            click_container_by_live_name(
                automator,
                manage_button,
                scenario.scenario_name,
            )
        except UiElementNotFound as exc:
            print(f"[validacao] Popup perdeu o estado: {exc}; reabrindo.")
            automator.press("esc")
            time.sleep(0.20)
            continue

        time.sleep(0.55)
        matches, confidence = active_container_matches_expected(
            automator,
            scenario.scenario_name,
        )
        if matches:
            print(
                f"[seguranca] Container ativo confirmado: {scenario.scenario_name} "
                f"(confianca={confidence:.3f})."
            )
            return

        print(
            f"[seguranca] Aba aberta nao corresponde a {scenario.scenario_name} "
            f"(confianca={confidence:.3f}); fechando e tentando novamente."
        )
        automator.hotkey("ctrl", "w")
        time.sleep(0.30)


def capture_gray_region(left: int, top: int, width: int, height: int) -> np.ndarray:
    screenshot = pyautogui.screenshot(region=(left, top, width, height))
    return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2GRAY)


def active_container_matches_expected(
    automator: VisualAutomator,
    expected_name: str,
) -> tuple[bool, float]:
    screen_width, screen_height = pyautogui.size()
    region_left = int(screen_width * 0.48)
    region_top = 35
    region_right = max(region_left + 180, screen_width - 120)
    region_bottom = min(screen_height, 150)
    templates = render_live_name_templates(expected_name)
    deadline = time.time() + 2.2
    best_confidence = -1.0

    while time.time() < deadline:
        automator._checkpoint()
        gray_region = capture_gray_region(
            region_left,
            region_top,
            region_right - region_left,
            region_bottom - region_top,
        )
        match = locate_live_name_in_gray(
            gray_region,
            templates,
            origin_x=region_left,
            origin_y=region_top,
        )
        best_confidence = max(best_confidence, match.confidence)
        if match.confidence >= ACTIVE_CONTAINER_MATCH_THRESHOLD:
            return True, best_confidence
        time.sleep(0.14)

    return False, best_confidence


def render_live_name_templates(expected_name: str) -> list[tuple[np.ndarray, int | None]]:
    font_paths = [Path("C:/Windows/Fonts/segoeui.ttf")]
    available_fonts = [font_path for font_path in font_paths if font_path.exists()]
    if not available_fonts:
        raise RuntimeError("Nao encontrei a fonte Segoe UI do Windows para ler os nomes ao vivo.")

    templates: list[tuple[np.ndarray, int | None]] = []
    for font_path in available_fonts:
        for font_size in range(16, 28):
            font = ImageFont.truetype(str(font_path), font_size)
            left, top, right, bottom = font.getbbox(expected_name)
            image = Image.new("L", (right - left + 8, bottom - top + 8), 255)
            ImageDraw.Draw(image).text(
                (4 - left, 4 - top),
                expected_name,
                font=font,
                fill=0,
            )
            gray_template = np.array(image)
            templates.append((gray_template, None))
            for threshold in (235, 245):
                binary_template = cv2.threshold(
                    gray_template,
                    threshold,
                    255,
                    cv2.THRESH_BINARY,
                )[1]
                templates.append((binary_template, threshold))
    return templates


def locate_live_name_in_gray(
    gray_region: np.ndarray,
    templates: list[tuple[np.ndarray, int | None]],
    *,
    origin_x: int,
    origin_y: int,
) -> Match:
    processed_regions: dict[int | None, np.ndarray] = {None: gray_region}
    best_match = Match(origin_x, origin_y, 1, 1, -1.0)

    for template, threshold in templates:
        template_height, template_width = template.shape[:2]
        if template_height > gray_region.shape[0] or template_width > gray_region.shape[1]:
            continue
        if threshold not in processed_regions:
            processed_regions[threshold] = cv2.threshold(
                gray_region,
                threshold,
                255,
                cv2.THRESH_BINARY,
            )[1]
        result = cv2.matchTemplate(
            processed_regions[threshold],
            template,
            cv2.TM_CCOEFF_NORMED,
        )
        _, confidence, _, location = cv2.minMaxLoc(result)
        if confidence > best_match.confidence:
            best_match = Match(
                origin_x + int(location[0]),
                origin_y + int(location[1]),
                template_width,
                template_height,
                float(confidence),
            )
    return best_match


def live_name_has_clear_boundaries(
    gray_region: np.ndarray,
    name_match: Match,
    *,
    origin_x: int,
    origin_y: int,
) -> tuple[bool, float, float]:
    local_x = name_match.x - origin_x
    local_y = name_match.y - origin_y
    x0 = max(0, local_x)
    x1 = min(gray_region.shape[1], local_x + name_match.width)
    y0 = max(0, local_y + 3)
    y1 = min(gray_region.shape[0], local_y + name_match.height - 3)
    if x1 <= x0 or y1 <= y0:
        return False, 1.0, 1.0

    left_strip = gray_region[y0:y1, max(0, x0 - 10):x0]
    right_strip = gray_region[y0:y1, x1:min(gray_region.shape[1], x1 + 12)]
    left_ink = float(np.mean(left_strip < 190)) if left_strip.size else 0.0
    right_ink = float(np.mean(right_strip < 190)) if right_strip.size else 0.0
    clear = (
        left_ink <= LIVE_NAME_BOUNDARY_THRESHOLD
        and right_ink <= LIVE_NAME_BOUNDARY_THRESHOLD
    )
    return clear, left_ink, right_ink


def live_name_pixel_f1(
    gray_region: np.ndarray,
    name_match: Match,
    templates: list[tuple[np.ndarray, int | None]],
    *,
    origin_x: int,
    origin_y: int,
) -> float:
    local_x = name_match.x - origin_x
    local_y = name_match.y - origin_y
    crop = gray_region[
        local_y:local_y + name_match.height,
        local_x:local_x + name_match.width,
    ]
    if crop.shape != (name_match.height, name_match.width):
        return 0.0

    matching_templates = [
        template
        for template, threshold in templates
        if threshold is None and template.shape == crop.shape
    ]
    if not matching_templates:
        return 0.0

    actual_ink = crop < 200
    kernel = np.ones((3, 3), dtype=np.uint8)
    dilated_actual = cv2.dilate(actual_ink.astype(np.uint8), kernel) > 0
    best_f1 = 0.0

    for template in matching_templates:
        template_ink = template < 200
        dilated_template = cv2.dilate(template_ink.astype(np.uint8), kernel) > 0
        precision = float(
            np.sum(actual_ink & dilated_template) / max(1, np.sum(actual_ink))
        )
        recall = float(
            np.sum(template_ink & dilated_actual) / max(1, np.sum(template_ink))
        )
        f1 = 2.0 * precision * recall / max(0.0001, precision + recall)
        best_f1 = max(best_f1, f1)

    return best_f1


def live_name_list_bounds(
    automator: VisualAutomator,
    manage_button: Match,
) -> tuple[int, int, int, int]:
    screen_width, screen_height = pyautogui.size()
    popup_left = max(0, manage_button.x)
    popup_right = min(screen_width, manage_button.x + manage_button.width)
    region_top = max(90, manage_button.y - 545)
    search_matches = [
        match
        for match in automator.locate_all("search_container_input.png")
        if popup_left <= match.center[0] <= popup_right
        and 60 <= match.center[1] < manage_button.y - 40
    ]
    if search_matches:
        search_match = min(search_matches, key=lambda item: item.center[1])
        region_top = max(region_top, search_match.y + search_match.height + 4)

    region_bottom = min(screen_height - 1, manage_button.y - 12)
    text_left = popup_left + 25
    text_right = popup_right - 75
    if text_right - text_left < 120 or region_bottom - region_top < 80:
        raise UiElementNotFound("Area da lista pequena demais para ler nomes ao vivo.")
    return text_left, region_top, text_right, region_bottom


def aligned_row_arrow(
    automator: VisualAutomator,
    manage_button: Match,
    name_match: Match,
) -> Match | None:
    popup_right = manage_button.x + manage_button.width
    arrows = [
        match
        for match in automator.locate_all("container_row_arrow.png")
        if popup_right - 115 <= match.center[0] <= popup_right
        and abs(match.center[1] - name_match.center[1]) <= 20
        and match.center[1] < manage_button.y - 8
    ]
    return max(arrows, key=lambda item: item.confidence) if arrows else None


def manage_name_list_bounds(new_button: Match) -> tuple[int, int, int, int]:
    screen_width, screen_height = pyautogui.size()
    popup_left = max(0, new_button.x)
    popup_right = min(screen_width, new_button.x + new_button.width)
    text_left = popup_left + 25
    text_right = popup_right - 75
    region_top = new_button.y + new_button.height + 4
    region_bottom = screen_height - 42
    if text_right - text_left < 120 or region_bottom - region_top < 80:
        raise UiElementNotFound("Area do Manage Containers pequena demais para leitura ao vivo.")
    return text_left, region_top, text_right, region_bottom


def aligned_manage_row_menu(
    automator: VisualAutomator,
    new_button: Match,
    name_match: Match,
) -> Match | None:
    popup_right = new_button.x + new_button.width
    menus = [
        match
        for match in automator.locate_all("container_row_menu_button.png")
        if popup_right - 115 <= match.center[0] <= popup_right
        and abs(match.center[1] - name_match.center[1]) <= 20
        and match.center[1] > new_button.y + new_button.height
    ]
    return max(menus, key=lambda item: item.confidence) if menus else None


def visible_container_row_arrows(
    automator: VisualAutomator,
    manage_button: Match,
    *,
    top: int,
    bottom: int,
) -> list[Match]:
    popup_right = manage_button.x + manage_button.width
    arrows = [
        match
        for match in automator.locate_all("container_row_arrow.png")
        if popup_right - 115 <= match.center[0] <= popup_right
        and top + 8 <= match.center[1] <= bottom - 8
    ]
    return sorted(arrows, key=lambda item: item.center[1])


def visible_manage_row_menus(
    automator: VisualAutomator,
    new_button: Match,
    *,
    top: int,
    bottom: int,
) -> list[Match]:
    popup_right = new_button.x + new_button.width
    menus = [
        match
        for match in automator.locate_all("container_row_menu_button.png")
        if popup_right - 115 <= match.center[0] <= popup_right
        and top + 8 <= match.center[1] <= bottom - 8
    ]
    return sorted(menus, key=lambda item: item.center[1])


def locate_live_name_on_manage_rows(
    gray_region: np.ndarray,
    templates: list[tuple[np.ndarray, int | None]],
    row_menus: list[Match],
    *,
    origin_x: int,
    origin_y: int,
) -> tuple[Match, Match | None, bool, float, float]:
    best_match = Match(origin_x, origin_y, 1, 1, -1.0)
    best_menu: Match | None = None
    best_boundaries = False
    best_left_ink = 1.0
    best_right_ink = 1.0

    for menu in row_menus:
        local_center_y = menu.center[1] - origin_y
        row_top = max(0, local_center_y - 27)
        row_bottom = min(gray_region.shape[0], local_center_y + 27)
        if row_bottom - row_top < 24:
            continue
        row_gray = gray_region[row_top:row_bottom, :]
        candidate = locate_live_name_in_gray(
            row_gray,
            templates,
            origin_x=origin_x,
            origin_y=origin_y + row_top,
        )
        boundaries_ok, left_ink, right_ink = live_name_has_clear_boundaries(
            row_gray,
            candidate,
            origin_x=origin_x,
            origin_y=origin_y + row_top,
        )
        
        # Penalizamos severamente a confianca se as bordas nao estiverem limpas,
        # para que uma correspondencia exata (mesmo com confianca base um pouco menor)
        # ganhe de uma correspondencia de substring (que tera bordas sujas).
        effective_confidence = candidate.confidence if boundaries_ok else candidate.confidence - 0.20

        if effective_confidence > best_match.confidence:
            best_match = replace(candidate, confidence=effective_confidence)
            best_menu = menu
            best_boundaries = boundaries_ok
            best_left_ink = left_ink
            best_right_ink = right_ink

    return (
        best_match,
        best_menu,
        best_boundaries,
        best_left_ink,
        best_right_ink,
    )


def click_manage_container_by_live_name(
    automator: VisualAutomator,
    new_button: Match,
    expected_name: str,
) -> None:
    templates = render_live_name_templates(expected_name)
    left, top, right, bottom = manage_name_list_bounds(new_button)
    width = right - left
    height = bottom - top
    scroll_x = left + min(210, max(80, width // 2))
    scroll_y = max(top + 45, bottom - 90)
    stable_frames = 0
    automator.move_point(scroll_x, scroll_y, "Manage Containers durante leitura por OpenCV")
    print("[proxy] Salto direto para o fim, onde fica o container recem-criado.")
    automator.scroll(LIST_BOTTOM_JUMP_CLICKS, fast=True)
    time.sleep(0.18)
    stop_number = 0
    best_confidence = -1.0

    while True:
        stop_number += 1
        gray_region = capture_gray_region(left, top, width, height)
        row_menus = visible_manage_row_menus(
            automator,
            new_button,
            top=top,
            bottom=bottom,
        )
        name_match, menu, boundaries_ok, left_ink, right_ink = locate_live_name_on_manage_rows(
            gray_region,
            templates,
            row_menus,
            origin_x=left,
            origin_y=top,
        )
        best_confidence = max(best_confidence, name_match.confidence)
        print(
            f"[proxy] Parada OpenCV {stop_number} para {expected_name}: "
            f"linhas={len(row_menus)}, confianca={name_match.confidence:.3f}"
        )

        if (
            menu is not None
            and name_match.confidence >= LIVE_NAME_MATCH_THRESHOLD
            and boundaries_ok
        ):
            print(
                f"[proxy] Nome exato encontrado no Manage Containers: {expected_name}; "
                f"linha y={menu.center[1]}, confianca={name_match.confidence:.3f}."
            )
            automator.click_point(
                name_match.center[0],
                menu.center[1],
                f"container reconhecido por OpenCV para configurar proxy: {expected_name}",
            )
            return
        elif name_match.confidence >= LIVE_NAME_MATCH_THRESHOLD:
            print(
                f"[seguranca] Possivel nome rejeitado por letras nas bordas: "
                f"esquerda={left_ink:.3f}, direita={right_ink:.3f}."
            )

        before = capture_gray_region(left, top, width, height)
        print("[proxy] Scroll rapido com sobreposicao para procurar mais abaixo.")
        automator.scroll(FAST_LIST_SCROLL_CLICKS, fast=True)
        time.sleep(0.12)
        after = capture_gray_region(left, top, width, height)
        difference = float(np.mean(cv2.absdiff(before, after)))
        stable_frames = stable_frames + 1 if difference <= 0.85 else 0
        if stable_frames >= 2:
            break

    print("[proxy] Fim da lista detectado; revelando novamente as ultimas linhas.")
    automator.scroll(4, fast=True)
    time.sleep(0.15)
    automator.scroll(-48, fast=True)
    time.sleep(0.18)

    gray_region = capture_gray_region(left, top, width, height)
    row_menus = visible_manage_row_menus(
        automator,
        new_button,
        top=top,
        bottom=bottom,
    )
    name_match, menu, boundaries_ok, _, _ = locate_live_name_on_manage_rows(
        gray_region,
        templates,
        row_menus,
        origin_x=left,
        origin_y=top,
    )
    best_confidence = max(best_confidence, name_match.confidence)
    if (
        menu is not None
        and name_match.confidence >= LIVE_NAME_MATCH_THRESHOLD
        and boundaries_ok
    ):
        automator.click_point(
            name_match.center[0],
            menu.center[1],
            f"ultima linha reconhecida por OpenCV: {expected_name}",
        )
        return

    if row_menus:
        last_menu = row_menus[-1]
        print(
            f"[proxy] OCR ficou abaixo do limite no fim (melhor={best_confidence:.3f}); "
            "abrindo a ultima linha para confirmar pelo campo Name."
        )
        automator.click_point(
            left + min(150, max(90, width // 3)),
            last_menu.center[1],
            f"ultima linha para confirmacao segura: {expected_name}",
        )
        return

    raise UiElementNotFound(
        f"Nao encontrei visualmente {expected_name} no Manage Containers; "
        f"melhor confianca={best_confidence:.3f}; o proxy nao foi aplicado."
    )


def container_popup_is_open(
    automator: VisualAutomator,
    manage_button: Match,
) -> bool:
    matches = automator.locate_all("manage_containers_button.png")
    return any(
        abs(match.center[0] - manage_button.center[0]) <= 35
        and abs(match.center[1] - manage_button.center[1]) <= 35
        for match in matches
    )


def click_container_by_live_name(
    automator: VisualAutomator,
    manage_button: Match,
    expected_name: str,
) -> None:
    templates = render_live_name_templates(expected_name)
    left, top, right, bottom = live_name_list_bounds(automator, manage_button)
    width = right - left
    height = bottom - top
    scroll_x = left + min(210, max(80, width // 2))
    scroll_y = max(top + 45, bottom - 90)
    automator.move_point(scroll_x, scroll_y, "lista para leitura direta por OpenCV")
    if not container_popup_is_open(automator, manage_button):
        raise UiElementNotFound("O popup fechou antes da leitura dos nomes.")

    # Pesquisa direta desabilitada, usando apenas a leitura direta pelo OpenCV.

    print("[validacao] Indo direto ao fim da lista para ler os containers mais recentes.")
    automator.scroll(LIST_BOTTOM_JUMP_CLICKS, fast=True)
    time.sleep(0.05)
    direction = 1
    stable_frames = 0
    stop_number = 0
    direction_changes = 0
    best_confidence = -1.0

    while True:
        if not container_popup_is_open(automator, manage_button):
            raise UiElementNotFound("O popup fechou; a pagina nao sera rolada.")

        stop_number += 1
        gray_region = capture_gray_region(left, top, width, height)
        row_arrows = visible_container_row_arrows(
            automator,
            manage_button,
            top=top,
            bottom=bottom,
        )
        name_match, arrow, boundaries_ok, left_ink, right_ink = locate_live_name_on_manage_rows(
            gray_region,
            templates,
            row_arrows,
            origin_x=left,
            origin_y=top,
        )
        pixel_f1 = live_name_pixel_f1(
            gray_region,
            name_match,
            templates,
            origin_x=left,
            origin_y=top,
        )
        best_confidence = max(best_confidence, name_match.confidence)
        print(
            f"[validacao] Leitura OpenCV {stop_number} para {expected_name}: "
            f"linhas={len(row_arrows)}, confianca={name_match.confidence:.3f}, "
            f"letras={pixel_f1:.3f}, "
            f"direcao={'subindo' if direction > 0 else 'descendo'}."
        )

        if (
            arrow is not None
            and name_match.confidence >= VALIDATION_NAME_MATCH_THRESHOLD
            and boundaries_ok
            and pixel_f1 >= VALIDATION_PIXEL_F1_THRESHOLD
        ):
            automator.click_point(
                name_match.center[0],
                arrow.center[1],
                f"container lido diretamente pelo OpenCV: {expected_name}",
            )
            return
        if name_match.confidence >= VALIDATION_NAME_MATCH_THRESHOLD:
            print(
                f"[seguranca] Texto parecido rejeitado: bordas="
                f"{left_ink:.3f}/{right_ink:.3f}, letras={pixel_f1:.3f}."
            )

        before = gray_region
        if not container_popup_is_open(automator, manage_button):
            raise UiElementNotFound("O popup fechou antes do scroll; pagina protegida.")
        automator.scroll(direction * VALIDATION_SCROLL_CLICKS, fast=True)
        time.sleep(0.05)
        after = capture_gray_region(left, top, width, height)
        difference = float(np.mean(cv2.absdiff(before, after)))
        stable_frames = stable_frames + 1 if difference <= 0.85 else 0
        if stable_frames >= 2:
            direction *= -1
            direction_changes += 1
            stable_frames = 0
            print(
                f"[validacao] Limite da lista atingido; invertendo o scroll "
                f"({direction_changes}). Melhor confianca={best_confidence:.3f}."
            )
            if direction_changes >= 2:
                break

    raise UiElementNotFound(
        f"Nao encontrei visualmente {expected_name} na lista de containers; "
        f"melhor confianca={best_confidence:.3f}. Verifique se o container existe."
    )

def click_proxy_auth_cancel_if_visible(automator: VisualAutomator) -> bool:
    screen_width, screen_height = pyautogui.size()
    matches = [
        match
        for match in automator.locate_all("proxy_auth_cancel_button.png")
        if screen_width * 0.20 <= match.center[0] <= screen_width * 0.80
        and screen_height * 0.25 <= match.center[1] <= screen_height * 0.85
    ]
    if not matches:
        return False

    cancel = max(matches, key=lambda item: item.confidence)
    automator.click_point(
        cancel.center[0],
        cancel.center[1],
        "Cancel do pedido de usuario e senha do proxy",
    )
    print(f"[validacao] Dialogo de autenticacao do proxy cancelado (conf={cancel.confidence:.3f}).")
    time.sleep(0.15)
    return True


def navigate_to_ip_domain(automator: VisualAutomator, url: str) -> None:
    domain = urlparse(url).netloc or url
    print(f"[validacao] Colocando o dominio na barra: {domain}")
    automator.hotkey("ctrl", "l")
    automator.paste_text(url, select_existing=True)
    automator.press("enter")


def normalize_target_url(value: object) -> str:
    target_url = str(value or "").strip()
    if not target_url:
        return ""
    parsed = urlparse(target_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(
            "URL do site de teste invalida. Use um endereco completo iniciado por http:// ou https://."
        )
    return target_url


def navigate_to_target_site(
    automator: VisualAutomator,
    target_url: str,
    *,
    skip_ip_message: bool = False,
) -> None:
    target_url = normalize_target_url(target_url)
    if skip_ip_message:
        print(f"[navegacao] Abrindo o site de teste direto: {target_url}")
    else:
        print(f"[navegacao] IP confirmado; abrindo o site de teste: {target_url}")
    automator.hotkey("ctrl", "l")
    automator.paste_text(target_url, select_existing=True)
    automator.press("enter")
    time.sleep(0.80)
    print("[navegacao] Site de teste aberto no container validado.")


def dismiss_test_site_consent_if_present(
    automator: VisualAutomator,
    *,
    timeout: float = 6.0,
) -> bool:
    started_at = time.time()
    deadline = time.time() + timeout
    while time.time() < deadline:
        automator._checkpoint()
        consent_matches = automator.locate_all(
            WEB_CONSENT_BUTTON_TEMPLATE,
            confidence=WEB_CONSENT_MATCH_THRESHOLD,
        )
        if consent_matches:
            button = max(consent_matches, key=lambda match: match.confidence)
            automator.click_point(
                *button.center,
                "Entendi, obrigado reconhecido por OpenCV",
            )
            time.sleep(0.45)
            print("[consentimento] Mensagem aceita; seguindo para os campos.")
            return True

        # O formulario pode aparecer antes da animacao do consentimento. Aguarde
        # uma pequena janela antes de concluir que o aviso nao sera exibido.
        if (
            time.time() - started_at >= WEB_CONSENT_APPEARANCE_GRACE_SECONDS
            and len(automator.locate_all(WEB_FORM_INPUT_TEMPLATE)) >= 2
        ):
            print("[consentimento] Mensagem nao exibida; formulario ja esta visivel.")
            return False
        time.sleep(0.20)

    print("[consentimento] Botao opcional nao apareceu; continuando a busca dos campos.")
    return False


def stable_four_digit_number(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return int.from_bytes(digest[:2], "big") % 9000 + 1000


def form_person_name_for_attempt(container_name: str, retry_number: int = 0) -> str:
    original_name = container_name.strip()
    if not original_name:
        raise ValueError(
            f"Nao foi possivel gerar nome a partir do container {container_name!r}."
        )
    if retry_number <= 0:
        return original_name

    try:
        original_index = PERSON_NAMES.index(original_name)
    except ValueError:
        original_index = (
            stable_four_digit_number(original_name.casefold()) % len(PERSON_NAMES)
        ) - 1
    return PERSON_NAMES[(original_index + retry_number) % len(PERSON_NAMES)]


def form_username_for_attempt(container_name: str, retry_number: int = 0) -> str:
    raw_name = form_person_name_for_attempt(container_name, retry_number)
    if "@" in raw_name:
        raw_name = raw_name.split("@")[0]
    clean_username = re.sub(r"[^a-zA-Z0-9]", "", raw_name)
    if not clean_username:
        clean_username = "Player"
    unique_number = secrets.randbelow(90000) + 10000
    return f"{clean_username[:12]}{unique_number}"


def form_email_for_container(container_name: str, retry_number: int = 0) -> str:
    person_name = form_person_name_for_attempt(container_name, retry_number)
    if "@" in person_name:
        person_name = person_name.split("@")[0]
    local_part = re.sub(r"[^a-z0-9]", "", person_name.lower())
    if not local_part:
        local_part = "player"
    email_number = secrets.randbelow(90000) + 10000
    return f"{local_part}{email_number}@gmail.com"


def form_password_for_attempt(container_name: str, retry_number: int = 0) -> str:
    if retry_number <= 0:
        return WEB_FORM_PASSWORD
    character_groups = (
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "0123456789",
        "abcdefghijklmnopqrstuvwxyz",
        "0123456789",
        "abcdefghijklmnopqrstuvwxyz",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    )
    return "".join(
        secrets.choice(character_groups[index % len(character_groups)])
        for index in range(20)
    )


def record_form_error(
    scenario_name: str,
    *,
    attempt_number: int,
    username: str,
    email: str,
    password: str,
    log_path: Path = DEFAULT_FORM_ERROR_LOG_PATH,
) -> tuple[int, int]:
    fieldnames = (
        "timestamp",
        "total_error_count",
        "scenario_error_count",
        "scenario_name",
        "attempt_number",
        "username",
        "email",
        "password",
    )
    existing_rows: list[dict[str, str]] = []
    if log_path.exists() and log_path.stat().st_size:
        with log_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
            existing_rows = list(csv.DictReader(csv_file))

    total_error_count = len(existing_rows) + 1
    scenario_error_count = (
        sum(row.get("scenario_name") == scenario_name for row in existing_rows) + 1
    )
    row = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "total_error_count": total_error_count,
        "scenario_error_count": scenario_error_count,
        "scenario_name": scenario_name,
        "attempt_number": attempt_number,
        "username": username,
        "email": email,
        "password": password,
    }
    log_path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not log_path.exists() or not log_path.stat().st_size
    with log_path.open("a", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerow(row)

    return total_error_count, scenario_error_count


def record_form_success(
    scenario: NetworkScenario,
    *,
    attempt_number: int,
    username: str,
    email: str,
    password: str,
    log_path: Path = DEFAULT_FORM_SUCCESS_LOG_PATH,
) -> tuple[int, int]:
    fieldnames = (
        "timestamp",
        "total_success_count",
        "scenario_success_count",
        "scenario_name",
        "attempt_number",
        "username",
        "email",
        "password",
        "proxy_scheme",
        "proxy_host",
        "proxy_port",
    )
    existing_rows: list[dict[str, str]] = []
    if log_path.exists() and log_path.stat().st_size:
        with log_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
            existing_rows = list(csv.DictReader(csv_file))

    total_success_count = len(existing_rows) + 1
    scenario_success_count = (
        sum(
            row.get("scenario_name") == scenario.scenario_name
            for row in existing_rows
        )
        + 1
    )
    row = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "total_success_count": total_success_count,
        "scenario_success_count": scenario_success_count,
        "scenario_name": scenario.scenario_name,
        "attempt_number": attempt_number,
        "username": username,
        "email": email,
        "password": password,
        "proxy_scheme": scenario.proxy_scheme,
        "proxy_host": scenario.proxy_host,
        "proxy_port": scenario.proxy_port,
    }
    log_path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not log_path.exists() or not log_path.stat().st_size
    with log_path.open("a", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerow(row)

    return total_success_count, scenario_success_count


def locate_template_in_screenshot(
    automator: VisualAutomator,
    screen_gray: np.ndarray,
    template_name: str,
) -> list[Match]:
    screen_height, screen_width = screen_gray.shape[:2]
    candidates: list[Match] = []
    for _scale, template in automator._scaled_templates(template_name):
        template_height, template_width = template.shape[:2]
        if template_height > screen_height or template_width > screen_width:
            continue

        result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED)
        ys, xs = np.where(result >= automator.confidence)
        candidates.extend(
            Match(
                int(x),
                int(y),
                int(template_width),
                int(template_height),
                float(result[y, x]),
            )
            for x, y in zip(xs, ys)
        )
    candidates.sort(key=lambda item: item.confidence, reverse=True)
    return automator._dedupe_matches(candidates)


def locate_form_error_by_color(screen_bgr: np.ndarray) -> Match | None:
    blue, green, red = cv2.split(screen_bgr)
    blue16 = blue.astype(np.int16)
    green16 = green.astype(np.int16)
    red16 = red.astype(np.int16)
    red_mask = (
        (red16 >= 90)
        & (red16 >= green16 * 1.35)
        & (red16 >= blue16 * 1.15)
    ).astype(np.uint8) * 255
    red_mask = cv2.morphologyEx(
        red_mask,
        cv2.MORPH_CLOSE,
        np.ones((5, 9), dtype=np.uint8),
    )

    screen_height, _ = screen_bgr.shape[:2]
    contours, _ = cv2.findContours(
        red_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    candidates: list[Match] = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if width < 220 or height < 30 or height > 140:
            continue
        if width / max(height, 1) < 4.0 or y > screen_height * 0.55:
            continue
        coverage = cv2.countNonZero(red_mask[y : y + height, x : x + width]) / (
            width * height
        )
        if coverage < 0.65:
            continue
        candidates.append(Match(x, y, width, height, float(coverage)))

    if not candidates:
        return None
    return max(candidates, key=lambda match: (match.confidence, match.width * match.height))


def form_error_text_confidence(
    automator: VisualAutomator,
    screen_gray: np.ndarray,
    error_region: Match,
    template_name: str = WEB_FORM_ERROR_TEXT_TEMPLATE,
) -> float:
    template_path = automator.templates_dir / template_name
    template = cv2.imread(str(template_path), cv2.IMREAD_GRAYSCALE)
    if template is None:
        raise FileNotFoundError(f"Template nao encontrado: {template_path}")

    region = screen_gray[
        error_region.y : error_region.y + error_region.height,
        error_region.x : error_region.x + error_region.width,
    ]
    best_confidence = 0.0
    seen_sizes: set[tuple[int, int]] = set()
    for scale in TEMPLATE_MATCH_SCALES:
        width = max(1, int(round(template.shape[1] * scale)))
        height = max(1, int(round(template.shape[0] * scale)))
        if (width, height) in seen_sizes:
            continue
        seen_sizes.add((width, height))
        interpolation = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
        scaled = cv2.resize(template, (width, height), interpolation=interpolation)
        if scaled.shape[0] > region.shape[0] or scaled.shape[1] > region.shape[1]:
            continue
        result = cv2.matchTemplate(region, scaled, cv2.TM_CCOEFF_NORMED)
        best_confidence = max(best_confidence, float(cv2.minMaxLoc(result)[1]))
    return best_confidence


def wait_for_test_form_result(
    automator: VisualAutomator,
    *,
    timeout: float = 180.0,
) -> tuple[str, Match]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        automator._checkpoint()
        screen_bgr = automator._screenshot_bgr()
        screen_gray = cv2.cvtColor(screen_bgr, cv2.COLOR_BGR2GRAY)

        color_error = locate_form_error_by_color(screen_bgr)
        if color_error is not None:
            text_confidence = max(
                form_error_text_confidence(
                    automator,
                    screen_gray,
                    color_error,
                    template_name,
                )
                for template_name in (
                    WEB_FORM_ERROR_TEXT_TEMPLATE,
                    WEB_FORM_NICKNAME_ERROR_TEXT_TEMPLATE,
                )
            )
            if text_confidence >= WEB_FORM_ERROR_TEXT_MATCH_THRESHOLD:
                return "error", Match(
                    color_error.x,
                    color_error.y,
                    color_error.width,
                    color_error.height,
                    text_confidence,
                )

        error_matches = locate_template_in_screenshot(
            automator,
            screen_gray,
            WEB_FORM_ERROR_TEMPLATE,
        )
        if error_matches:
            return "error", max(error_matches, key=lambda match: match.confidence)

        ready_matches = locate_template_in_screenshot(
            automator,
            screen_gray,
            WEB_FORM_READY_TEMPLATE,
        )
        if ready_matches:
            return "success", max(ready_matches, key=lambda match: match.confidence)
        time.sleep(0.10)

    error_confidence = automator.last_confidence(WEB_FORM_ERROR_TEMPLATE)
    ready_confidence = automator.last_confidence(WEB_FORM_READY_TEMPLATE)
    raise UiElementNotFound(
        "Nao encontrei nem a mensagem de erro nem a confirmacao Fundar cidade "
        f"em {timeout:.0f}s. Confiancas: erro={error_confidence:.3f}, "
        f"sucesso={ready_confidence:.3f}."
    )


def wait_for_registration_form_fields(
    automator: VisualAutomator,
    *,
    timeout: float = 30.0,
) -> list[Match]:
    print("[formulario] OpenCV aguardando o carregamento completo dos 3 campos de cadastro...")
    deadline = time.time() + timeout
    last_count = 0
    distinct_fields: list[Match] = []
    while time.time() < deadline:
        automator._checkpoint()
        matches = automator.locate_all(WEB_FORM_INPUT_TEMPLATE)
        screen_width, screen_height = pyautogui.size()
        content_matches = [
            match
            for match in matches
            if 200 <= match.center[1] <= screen_height - 40
            and screen_width * 0.15 <= match.center[0] <= screen_width * 0.85
        ]
        content_matches.sort(key=lambda match: match.center[1])

        distinct_fields = []
        for field in content_matches:
            if distinct_fields and abs(field.center[1] - distinct_fields[-1].center[1]) < 22:
                if field.confidence > distinct_fields[-1].confidence:
                    distinct_fields[-1] = field
                continue
            distinct_fields.append(field)

        last_count = len(distinct_fields)
        if last_count >= 3:
            print(f"[formulario] OpenCV confirmou {last_count} campos de cadastro carregados na pagina.")
            return distinct_fields[:3]
        time.sleep(0.30)

    if distinct_fields:
        print(f"[formulario] Timeout; prosseguindo com {len(distinct_fields)} campo(s) detectado(s).")
        return distinct_fields

    raise UiElementNotFound(
        f"Nao consegui detectar os campos do formulario de cadastro em {timeout:.0f}s. "
        "Verifique se a pagina carregou."
    )


def locate_registration_fields_by_color(screen_bgr: np.ndarray) -> list[Match]:
    screen_height, screen_width = screen_bgr.shape[:2]
    hsv = cv2.cvtColor(screen_bgr, cv2.COLOR_BGR2HSV)
    for saturation_max, value_min in ((50, 210), (65, 200), (80, 190)):
        light_mask = (
            (hsv[:, :, 1] <= saturation_max)
            & (hsv[:, :, 2] >= value_min)
        ).astype(np.uint8)
        light_mask[: max(0, int(screen_height * 0.16)), :] = 0
        light_mask[int(screen_height * 0.97) :, :] = 0
        light_mask[:, : max(0, int(screen_width * 0.03))] = 0
        light_mask[:, int(screen_width * 0.97) :] = 0

        row_counts = light_mask.sum(axis=1)
        row_threshold = max(180, int(screen_width * 0.30))
        rows = np.where(row_counts >= row_threshold)[0]
        if len(rows) == 0:
            continue

        bands: list[tuple[int, int]] = []
        start = previous = int(rows[0])
        for raw_row in rows[1:]:
            row = int(raw_row)
            if row > previous + 2:
                bands.append((start, previous))
                start = row
            previous = row
        bands.append((start, previous))

        fields: list[Match] = []
        for top, bottom in bands:
            height = bottom - top + 1
            if height < 24 or height > 85:
                continue
            band = light_mask[top : bottom + 1, :]
            col_counts = band.sum(axis=0)
            cols = np.where(col_counts >= max(10, int(height * 0.40)))[0]
            if len(cols) == 0:
                continue
            left = int(cols[0])
            right = int(cols[-1])
            width = right - left + 1
            if width < max(220, int(screen_width * 0.28)):
                continue
            if width / max(height, 1) < 4.0:
                continue
            coverage = float(light_mask[top : bottom + 1, left : right + 1].mean())
            fields.append(Match(left, top, width, height, coverage))

        fields.sort(key=lambda match: match.center[1])
        distinct_fields: list[Match] = []
        for field in fields:
            if distinct_fields and abs(field.center[1] - distinct_fields[-1].center[1]) < 45:
                if field.width * field.height > distinct_fields[-1].width * distinct_fields[-1].height:
                    distinct_fields[-1] = field
                continue
            distinct_fields.append(field)
        if len(distinct_fields) >= 3:
            return distinct_fields
    return []


def registration_field_click_point(field: Match) -> tuple[int, int]:
    return field.x + field.width + 60, field.center[1]


def fill_test_site_form(
    automator: VisualAutomator,
    scenario: NetworkScenario,
) -> None:
    retry_number = 0
    while True:
        username = form_username_for_attempt(scenario.scenario_name, retry_number)
        email = form_email_for_container(scenario.scenario_name, retry_number)
        password = form_password_for_attempt(scenario.scenario_name, retry_number)
        values = (
            (username, "nome do jogador"),
            (email, "email"),
            (password, "senha"),
        )

        distinct_fields = wait_for_registration_form_fields(automator, timeout=30.0)

        if not distinct_fields:
            raise UiElementNotFound("Nenhum campo de cadastro foi detectado para preencher.")

        for index, (value, description) in enumerate(values):
            print(f"[formulario] Preenchendo {description} com efeito de escrita: {value}")
            if index < len(distinct_fields):
                target_field = distinct_fields[index]
                click_x, click_y = registration_field_click_point(target_field)
                automator.click_point(click_x, click_y, f"campo {description} reconhecido por OpenCV")
            else:
                automator.press("tab")

            time.sleep(0.15)
            for _ in range(35):
                automator.press("backspace")
            time.sleep(0.10)

            # Nao use Ctrl+A aqui. Se o foco escapar do input, o navegador seleciona
            # a pagina inteira e bagunca o cadastro. Backspace + escrita direta era
            # o comportamento estavel das versoes anteriores.
            automator.type_text(value, select_existing=False, interval=WEB_FORM_TYPING_INTERVAL_SECONDS)
            time.sleep(0.25)

        print(
            f"[formulario] Tentativa {retry_number + 1} preenchida para "
            f"{scenario.scenario_name}; enviando automaticamente com Enter."
        )
        automator.press("enter")
        result, result_match = wait_for_test_form_result(automator)
        if result == "success":
            total_successes, scenario_successes = record_form_success(
                scenario,
                attempt_number=retry_number + 1,
                username=username,
                email=email,
                password=password,
            )
            print(
                f"[formulario] Pagina confirmada para {scenario.scenario_name}; "
                "Fundar cidade encontrado com confianca "
                f"{result_match.confidence:.3f}. Sucesso {scenario_successes} "
                f"deste cenario e {total_successes} no total salvo em "
                f"{DEFAULT_FORM_SUCCESS_LOG_PATH}."
            )
            return

        total_count, scenario_count = record_form_error(
            scenario.scenario_name,
            attempt_number=retry_number + 1,
            username=username,
            email=email,
            password=password,
        )
        print(
            f"[formulario] OpenCV detectou Erro com confianca "
            f"{result_match.confidence:.3f}. Ocorrencia {scenario_count} deste "
            f"cadastro e {total_count} no total registrada em "
            f"{DEFAULT_FORM_ERROR_LOG_PATH}."
        )
        if retry_number >= WEB_FORM_MAX_ERROR_RETRIES:
            raise RuntimeError(
                f"O site recusou {WEB_FORM_MAX_ERROR_RETRIES + 1} tentativas "
                f"para {scenario.scenario_name}. Consulte "
                f"{DEFAULT_FORM_ERROR_LOG_PATH}."
            )

        print(
            f"[formulario] Erro confirmado; aguardando "
            f"{WEB_FORM_ERROR_REFRESH_DELAY_SECONDS:.0f}s antes do F5."
        )
        refresh_at = time.time() + WEB_FORM_ERROR_REFRESH_DELAY_SECONDS
        while time.time() < refresh_at:
            automator._checkpoint()
            time.sleep(min(0.10, max(0.0, refresh_at - time.time())))

        retry_number += 1
        print(
            "[formulario] Atualizando a pagina para tentar novamente com "
            "usuario sem espacos, outro Gmail e outra senha."
        )
        automator.press("f5")
        time.sleep(0.80)
        dismiss_test_site_consent_if_present(automator)


def open_ip_check_and_copy(automator: VisualAutomator, url: str) -> str:
    if click_proxy_auth_cancel_if_visible(automator):
        print("[validacao] Cancel clicado antes de abrir o validador de IP.")
    navigate_to_ip_domain(automator, url)
    width, height = pyautogui.size()
    deadline = time.time() + IP_CHECK_COPY_TIMEOUT_SECONDS
    last_copied = ""
    attempt = 0
    time.sleep(IP_CHECK_MIN_WAIT_SECONDS)

    while time.time() < deadline:
        attempt += 1
        if click_proxy_auth_cancel_if_visible(automator):
            print("[validacao] O dialogo reapareceu; colocando o dominio novamente.")
            navigate_to_ip_domain(automator, url)
            time.sleep(IP_CHECK_MIN_WAIT_SECONDS)
            continue
        automator.click_point(width // 2, height // 2, "conteudo da pagina de IP")
        pyperclip.copy("")
        automator.hotkey("ctrl", "a")
        automator.hotkey("ctrl", "c")
        time.sleep(0.18)
        last_copied = pyperclip.paste().strip()
        observed_ip = extract_ip_from_loaded_ip_page(last_copied)
        if observed_ip:
            print(f"[validacao] IP lido na tentativa {attempt}.")
            return observed_ip
        if attempt % 5 == 0:
            print("[validacao] Aguardando a pagina de IP terminar de carregar.")
        time.sleep(0.35)

    raise RuntimeError(
        f"Nao consegui copiar um IP limpo da pagina em {IP_CHECK_COPY_TIMEOUT_SECONDS:.0f} segundos. "
        f"Texto copiado: {last_copied[:120]}"
    )


def extract_ip_from_loaded_ip_page(text: str) -> str | None:
    compact = " ".join(str(text or "").strip().split())
    if not compact:
        return None
    plain_ip = re.fullmatch(r"([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-fA-F0-9:]{8,})", compact)
    if plain_ip:
        return plain_ip.group(1)
    if len(compact) <= 80:
        return extract_ip(compact)
    return None


def extract_ip(text: str) -> str | None:
    match = re.search(r"([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-fA-F0-9:]{8,})", text)
    return match.group(1) if match else None


def close_extension_popup(automator: VisualAutomator) -> None:
    # Esc fecha o popup da extensao na maioria das telas. Se estiver em subpainel,
    # um segundo Esc e inofensivo.
    automator.press("esc")
    automator.press("esc")


if __name__ == "__main__":
    raise SystemExit(main())
