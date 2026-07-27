import threading
import time
from collections.abc import Callable

from .config import MAX_LIMIT, PROFILES_DIR
from .database import Database
from .email_utils import random_gmail
from .selenium_creator import SeleniumAccountCreator


StatusCallback = Callable[[], None]


class AccountWorker(threading.Thread):
    def __init__(
        self,
        database: Database,
        target_base_url: str,
        limit: int,
        password: str,
        headless: bool,
        configure_proxy: bool,
        extension_xpi_path: str | None,
        step_delay_seconds: float,
        base_profile_dir: str | None,
        verify_browser_ip: bool,
        on_change: StatusCallback | None = None,
    ):
        super().__init__(daemon=True)
        self.database = database
        self.target_base_url = target_base_url
        self.limit = max(1, min(int(limit), MAX_LIMIT))
        self.password = password
        self.headless = headless
        self.configure_proxy = configure_proxy
        self.extension_xpi_path = extension_xpi_path
        self.step_delay_seconds = max(0.0, float(step_delay_seconds))
        self.base_profile_dir = base_profile_dir
        self.verify_browser_ip = verify_browser_ip
        self.on_change = on_change
        self._pause_event = threading.Event()
        self._stop_event = threading.Event()
        self._pause_event.set()

    def pause(self) -> None:
        self._pause_event.clear()
        self.database.log(None, "INFO", "Fila pausada. A pausa acontece entre uma conta e outra.")
        self._notify()

    def resume(self) -> None:
        self._pause_event.set()
        self.database.log(None, "INFO", "Fila retomada.")
        self._notify()

    def stop(self) -> None:
        self._stop_event.set()
        self._pause_event.set()
        self.database.log(None, "INFO", "Parada solicitada.")
        self._notify()

    @property
    def paused(self) -> bool:
        return not self._pause_event.is_set()

    def run(self) -> None:
        self.database.log(None, "INFO", f"Iniciando lote de ate {self.limit} conta(s).")
        accounts = self._prepare_batch()
        creator = SeleniumAccountCreator(
            target_base_url=self.target_base_url,
            profiles_dir=PROFILES_DIR,
            headless=self.headless,
            configure_proxy=self.configure_proxy,
            extension_xpi_path=self.extension_xpi_path,
            step_delay_seconds=self.step_delay_seconds,
            base_profile_dir=self.base_profile_dir,
            verify_browser_ip=self.verify_browser_ip,
        )

        for account in accounts:
            if self._stop_event.is_set():
                break

            while not self._pause_event.is_set() and not self._stop_event.is_set():
                time.sleep(0.25)

            if self._stop_event.is_set():
                break

            account_id = account["id"]
            email = account["email"]
            proxy = account["proxy"]
            container_name = account["container_name"]
            profile_path = str(creator.profile_dir(account_id, container_name))
            proxy_applied, proxy_status = creator.proxy_plan(proxy)
            self.database.update_account_environment(account_id, profile_path, proxy_applied, proxy_status)

            self.database.update_account_status(account_id, "criando")
            self.database.log(account_id, "INFO", f"Novo perfil/container: {profile_path}")
            self.database.log(account_id, "INFO", creator.base_profile_status())
            self.database.log(account_id, "INFO", f"Proxy da conta: {proxy or 'sem proxy'}")
            self.database.log(account_id, "INFO", f"Proxy Firefox: {proxy_status}")
            self.database.log(account_id, "INFO", f"Abrindo Firefox para {email}.")
            self._notify()

            try:
                result = creator.create_account(
                    account_id=account_id,
                    email=email,
                    password=self.password,
                    proxy_raw=proxy,
                    container_name=container_name,
                )
            except Exception as exc:
                self.database.update_account_status(account_id, "erro", str(exc))
                self.database.log(account_id, "ERROR", f"Falha ao criar {email}: {exc}")
                self._notify()
                continue

            self.database.update_account_browser_check(account_id, result.browser_ip, result.ip_check_status)
            self.database.log(account_id, "INFO", f"IP navegador: {result.browser_ip or '-'}")
            self.database.log(account_id, "INFO", f"Status IP: {result.ip_check_status}")
            self.database.update_account_status(account_id, "concluida")
            self.database.log(account_id, "INFO", f"Conta criada com sucesso: {email}")
            self._notify()
            if self.step_delay_seconds:
                time.sleep(self.step_delay_seconds)

        self.database.log(None, "INFO", "Lote finalizado.")
        self._notify()

    def _prepare_batch(self) -> list[dict[str, str | int | None]]:
        proxies = self.database.list_proxies(self.limit)
        prepared = []
        for index in range(self.limit):
            proxy = proxies[index]["raw"] if index < len(proxies) else None
            container_name = f"container-teste-{index + 1:02d}"
            email = random_gmail()
            account_id = self.database.create_account(email, self.password, proxy, container_name)
            prepared.append(
                {
                    "id": account_id,
                    "email": email,
                    "proxy": proxy,
                    "container_name": container_name,
                }
            )
        self._notify()
        return prepared

    def _notify(self) -> None:
        if self.on_change:
            self.on_change()
