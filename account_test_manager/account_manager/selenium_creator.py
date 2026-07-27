from pathlib import Path
import re
import shutil
import time
from dataclasses import dataclass

from .config import IP_CHECK_URLS
from .proxy_utils import parse_proxy


@dataclass(frozen=True)
class CreationResult:
    browser_ip: str | None
    ip_check_status: str


class SeleniumAccountCreator:
    def __init__(
        self,
        target_base_url: str,
        profiles_dir: Path,
        headless: bool = False,
        configure_proxy: bool = False,
        extension_xpi_path: str | Path | None = None,
        step_delay_seconds: float = 0,
        base_profile_dir: str | Path | None = None,
        verify_browser_ip: bool = True,
    ):
        self.target_base_url = target_base_url.rstrip("/")
        self.profiles_dir = Path(profiles_dir)
        self.headless = headless
        self.configure_proxy = configure_proxy
        self.extension_xpi_path = Path(extension_xpi_path) if extension_xpi_path else None
        self.step_delay_seconds = max(0.0, float(step_delay_seconds))
        self.base_profile_dir = Path(base_profile_dir) if base_profile_dir else None
        self.verify_browser_ip = verify_browser_ip

    def create_account(
        self,
        account_id: int,
        email: str,
        password: str,
        proxy_raw: str | None,
        container_name: str,
    ) -> CreationResult:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.firefox.options import Options
        from selenium.webdriver.firefox.webdriver import WebDriver as FirefoxWebDriver
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.support.ui import WebDriverWait

        profile_dir = self.profile_dir(account_id, container_name)
        self.prepare_profile(profile_dir)

        options = Options()
        if self.headless:
            options.add_argument("-headless")
        options.add_argument("-profile")
        options.add_argument(str(profile_dir))
        options.set_preference("browser.tabs.warnOnClose", False)
        options.set_preference("network.proxy.no_proxies_on", "localhost, 127.0.0.1")

        proxy_applied, _proxy_status = self.proxy_plan(proxy_raw)
        if proxy_applied and proxy_raw:
            self._apply_proxy_preferences(options, proxy_raw)

        driver = FirefoxWebDriver(options=options)
        browser_ip = None
        ip_check_status = "verificacao de IP desativada"
        try:
            if self.extension_xpi_path and self.extension_xpi_path.exists():
                driver.install_addon(str(self.extension_xpi_path), temporary=True)

            wait = WebDriverWait(driver, 15)
            if self.verify_browser_ip:
                browser_ip, ip_check_status = self.check_browser_ip(driver, wait, proxy_raw)
                self._delay()

            driver.get(f"{self.target_base_url}/register")
            wait.until(EC.presence_of_element_located((By.ID, "email")))
            self._delay()

            email_input = driver.find_element(By.ID, "email")
            password_input = driver.find_element(By.ID, "password")
            proxy_input = driver.find_element(By.ID, "proxy")

            email_input.clear()
            email_input.send_keys(email)
            self._delay()
            password_input.clear()
            password_input.send_keys(password)
            driver.execute_script("arguments[0].value = arguments[1];", proxy_input, proxy_raw or "")
            self._delay()

            driver.find_element(By.ID, "submit").click()
            result = wait.until(EC.presence_of_element_located((By.ID, "result")))
            self._delay()
            if "Conta criada:" not in result.text:
                raise RuntimeError(result.text or "Cadastro local nao confirmou a criacao.")
            return CreationResult(browser_ip=browser_ip, ip_check_status=ip_check_status)
        finally:
            driver.quit()

    def profile_dir(self, account_id: int, container_name: str) -> Path:
        safe_container = re.sub(r"[^a-zA-Z0-9_.-]+", "_", container_name).strip("_")
        return self.profiles_dir / f"{account_id:04d}_{safe_container}"

    def prepare_profile(self, profile_dir: Path) -> None:
        if profile_dir.exists():
            return

        profile_dir.parent.mkdir(parents=True, exist_ok=True)
        if not self.base_profile_dir:
            profile_dir.mkdir(parents=True, exist_ok=True)
            return

        base = self.base_profile_dir.resolve()
        destination = profile_dir.resolve()
        if not base.exists() or not base.is_dir():
            raise RuntimeError(f"Perfil base nao encontrado: {self.base_profile_dir}")
        if base == destination or base in destination.parents:
            raise RuntimeError("Perfil base invalido: nao use uma pasta dentro dos perfis gerados.")

        shutil.copytree(base, destination, ignore=self._profile_copy_ignore)

    def base_profile_status(self) -> str:
        if not self.base_profile_dir:
            return "perfil Selenium novo"
        return f"perfil base copiado: {self.base_profile_dir}"

    def proxy_plan(self, proxy_raw: str | None) -> tuple[bool, str]:
        if not proxy_raw:
            return False, "sem proxy"

        if not self.configure_proxy:
            return False, "proxy associada; aplicacao no Firefox desativada"

        try:
            parsed = parse_proxy(proxy_raw)
        except Exception as exc:
            return False, f"proxy invalida: {exc}"

        if not parsed:
            return False, "sem proxy"

        if parsed.has_auth:
            return False, "proxy com usuario/senha associada; autenticacao exige extensao ou perfil preparado"

        return True, "aplicada nas preferencias do Firefox"

    def check_browser_ip(self, driver, wait, proxy_raw: str | None) -> tuple[str | None, str]:
        last_error = None
        for url in IP_CHECK_URLS:
            try:
                driver.get(url)
                body = wait.until(lambda active_driver: active_driver.find_element("tag name", "body"))
                text = body.text.strip()
                match = re.search(r"([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-fA-F0-9:]{8,})", text)
                if not match:
                    last_error = f"IP nao encontrado em {url}"
                    continue

                browser_ip = match.group(1)
                return browser_ip, self._ip_status(browser_ip, proxy_raw)
            except Exception as exc:
                last_error = str(exc)

        return None, f"falha ao verificar IP do navegador: {last_error or 'sem resposta'}"

    def _ip_status(self, browser_ip: str, proxy_raw: str | None) -> str:
        if not proxy_raw:
            return f"IP detectado sem proxy configurada: {browser_ip}"

        proxy_applied, proxy_status = self.proxy_plan(proxy_raw)
        try:
            parsed = parse_proxy(proxy_raw)
        except Exception:
            return f"IP detectado ({browser_ip}); {proxy_status}"

        if parsed and parsed.host == browser_ip:
            return "IP do navegador bate com o host da proxy"

        if proxy_applied:
            return f"IP detectado ({browser_ip}); proxy aplicada, mas IP difere do host {parsed.host}"

        return f"IP detectado ({browser_ip}); {proxy_status}"

    def _profile_copy_ignore(self, directory: str, names: list[str]) -> set[str]:
        ignored = {
            "parent.lock",
            "lock",
            ".parentlock",
            "cache2",
            "startupCache",
            "shader-cache",
            "crashes",
            "minidumps",
            "datareporting",
        }
        return {name for name in names if name in ignored}

    def _delay(self) -> None:
        if self.step_delay_seconds:
            time.sleep(self.step_delay_seconds)

    def _apply_proxy_preferences(self, options, proxy_raw: str) -> None:
        parsed = parse_proxy(proxy_raw)
        if not parsed:
            return

        if parsed.has_auth:
            # Firefox proxy auth requires an extension or manual prompt handling.
            # For the local test we keep auth proxies recorded in SQLite instead.
            return

        options.set_preference("network.proxy.type", 1)
        options.set_preference("network.proxy.http", parsed.host)
        options.set_preference("network.proxy.http_port", parsed.port)
        options.set_preference("network.proxy.ssl", parsed.host)
        options.set_preference("network.proxy.ssl_port", parsed.port)
