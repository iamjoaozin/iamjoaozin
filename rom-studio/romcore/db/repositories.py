import json
from abc import ABC, abstractmethod
from typing import TypeVar, Generic, Optional, Dict, Any
from .connection import DatabaseConnection

T = TypeVar('T')

class IRepository(ABC, Generic[T]):
    """Abstract generic repository pattern for database access."""
    
    @abstractmethod
    def get(self, id: str) -> Optional[T]:
        pass
        
    @abstractmethod
    def save(self, entity: T):
        pass
        
    @abstractmethod
    def delete(self, id: str):
        pass
        
class SignatureRepository(IRepository[Dict[str, Any]]):
    """Repository handling game signatures and algorithms from the knowledge base."""
    def __init__(self, db: DatabaseConnection):
        self.db = db
        
    def get(self, id: str) -> Optional[Dict[str, Any]]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM signatures WHERE id = ?", (id,)).fetchone()
            if row:
                return {
                    "id": row["id"],
                    "game_hash": row["game_hash"],
                    "data": json.loads(row["data"])
                }
            return None
            
    def save(self, entity: Dict[str, Any]):
        with self.db.get_connection() as conn:
            data_json = json.dumps(entity.get("data", {}))
            conn.execute(
                "INSERT OR REPLACE INTO signatures (id, game_hash, data) VALUES (?, ?, ?)",
                (entity["id"], entity.get("game_hash", ""), data_json)
            )
            
    def delete(self, id: str):
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM signatures WHERE id = ?", (id,))
