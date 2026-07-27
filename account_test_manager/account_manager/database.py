import csv
from contextlib import contextmanager
import sqlite3
from pathlib import Path
from typing import Iterable

from .config import DB_PATH


class Database:
    def __init__(self, path: Path = DB_PATH):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def connection(self):
        conn = self.connect()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init_db(self) -> None:
        with self.connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS proxies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    raw TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    password TEXT NOT NULL,
                    proxy TEXT,
                    container_name TEXT NOT NULL,
                    profile_path TEXT,
                    proxy_applied INTEGER NOT NULL DEFAULT 0,
                    proxy_status TEXT,
                    browser_ip TEXT,
                    ip_check_status TEXT,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(account_id) REFERENCES accounts(id)
                );

                CREATE TABLE IF NOT EXISTS target_registrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    proxy TEXT,
                    user_agent TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            self._ensure_account_columns(conn)

    def _ensure_account_columns(self, conn: sqlite3.Connection) -> None:
        existing = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(accounts)").fetchall()
        }
        migrations = {
            "profile_path": "ALTER TABLE accounts ADD COLUMN profile_path TEXT",
            "proxy_applied": "ALTER TABLE accounts ADD COLUMN proxy_applied INTEGER NOT NULL DEFAULT 0",
            "proxy_status": "ALTER TABLE accounts ADD COLUMN proxy_status TEXT",
            "browser_ip": "ALTER TABLE accounts ADD COLUMN browser_ip TEXT",
            "ip_check_status": "ALTER TABLE accounts ADD COLUMN ip_check_status TEXT",
        }
        for column, sql in migrations.items():
            if column not in existing:
                conn.execute(sql)

    def import_proxies(self, lines: Iterable[str]) -> int:
        cleaned = []
        for line in lines:
            raw = line.strip()
            if raw and not raw.startswith("#"):
                cleaned.append(raw)

        inserted = 0
        with self.connection() as conn:
            for raw in cleaned:
                cur = conn.execute("INSERT OR IGNORE INTO proxies(raw) VALUES (?)", (raw,))
                inserted += cur.rowcount
        if inserted:
            self.log(None, "INFO", f"{inserted} proxy(s) importado(s).")
        return inserted

    def count_proxies(self) -> int:
        with self.connection() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM proxies").fetchone()[0])

    def list_proxies(self, limit: int) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return list(conn.execute("SELECT * FROM proxies ORDER BY id LIMIT ?", (limit,)))

    def create_account(
        self,
        email: str,
        password: str,
        proxy: str | None,
        container_name: str,
        profile_path: str | None = None,
        proxy_applied: bool = False,
        proxy_status: str | None = None,
    ) -> int:
        with self.connection() as conn:
            cur = conn.execute(
                """
                INSERT INTO accounts(
                    email,
                    password,
                    proxy,
                    container_name,
                    profile_path,
                    proxy_applied,
                    proxy_status,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')
                """,
                (email, password, proxy, container_name, profile_path, int(proxy_applied), proxy_status),
            )
            account_id = int(cur.lastrowid)
        self.log(account_id, "INFO", f"Conta enfileirada: {email}")
        return account_id

    def update_account_environment(
        self,
        account_id: int,
        profile_path: str,
        proxy_applied: bool,
        proxy_status: str,
    ) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                UPDATE accounts
                   SET profile_path = ?,
                       proxy_applied = ?,
                       proxy_status = ?,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?
                """,
                (profile_path, int(proxy_applied), proxy_status, account_id),
            )

    def update_account_browser_check(
        self,
        account_id: int,
        browser_ip: str | None,
        ip_check_status: str,
    ) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                UPDATE accounts
                   SET browser_ip = ?,
                       ip_check_status = ?,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?
                """,
                (browser_ip, ip_check_status, account_id),
            )

    def update_account_status(
        self,
        account_id: int,
        status: str,
        error_message: str | None = None,
    ) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                UPDATE accounts
                   SET status = ?,
                       error_message = ?,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?
                """,
                (status, error_message, account_id),
            )

    def log(self, account_id: int | None, level: str, message: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO logs(account_id, level, message) VALUES (?, ?, ?)",
                (account_id, level, message),
            )

    def insert_target_registration(
        self,
        email: str,
        password: str,
        proxy: str | None,
        user_agent: str | None,
    ) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO target_registrations(email, password, proxy, user_agent)
                VALUES (?, ?, ?, ?)
                """,
                (email, password, proxy, user_agent),
            )

    def get_accounts(self, limit: int = 200) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return list(
                conn.execute(
                    """
                    SELECT *
                      FROM accounts
                     ORDER BY id DESC
                     LIMIT ?
                    """,
                    (limit,),
                )
            )

    def get_recent_logs(self, limit: int = 200) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return list(
                conn.execute(
                    """
                    SELECT *
                      FROM logs
                     ORDER BY id DESC
                     LIMIT ?
                    """,
                    (limit,),
                )
            )

    def clear_logs(self) -> None:
        with self.connection() as conn:
            conn.execute("DELETE FROM logs")

    def export_accounts_csv(self, output_path: str | Path) -> None:
        rows = self.get_accounts(limit=100000)
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "id",
                    "email",
                    "password",
                    "proxy",
                    "container_name",
                    "profile_path",
                    "proxy_applied",
                    "proxy_status",
                    "browser_ip",
                    "ip_check_status",
                    "status",
                    "error_message",
                    "created_at",
                    "updated_at",
                ]
            )
            for row in rows:
                writer.writerow(
                    [
                        row["id"],
                        row["email"],
                        row["password"],
                        row["proxy"] or "",
                        row["container_name"],
                        row["profile_path"] or "",
                        "sim" if row["proxy_applied"] else "nao",
                        row["proxy_status"] or "",
                        row["browser_ip"] or "",
                        row["ip_check_status"] or "",
                        row["status"],
                        row["error_message"] or "",
                        row["created_at"],
                        row["updated_at"],
                    ]
                )
