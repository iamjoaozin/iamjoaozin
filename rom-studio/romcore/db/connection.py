import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

class DatabaseConnection:
    """Manages the connection to the SQLite database with a context manager."""
    def __init__(self, db_path: Path | str):
        self.db_path = str(db_path)
        self._init_db()
        
    def _init_db(self):
        """Creates required core tables if they do not exist."""
        with self.get_connection() as conn:
            # Example initialization for signatures and projects
            conn.execute('''
                CREATE TABLE IF NOT EXISTS signatures (
                    id TEXT PRIMARY KEY,
                    game_hash TEXT NOT NULL,
                    data TEXT NOT NULL
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL,
                    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager providing a safe SQLite connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
