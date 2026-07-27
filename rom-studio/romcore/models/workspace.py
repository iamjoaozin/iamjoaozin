from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional
from .rom import RomData
from .rom_map import RomMap

@dataclass
class Workspace:
    """Represents a Ghidra-like project session, containing the ROM, its map, and related data."""
    project_path: Path
    rom: Optional[RomData] = None
    rom_map: RomMap = field(default_factory=RomMap)
    dumps: Dict[str, Path] = field(default_factory=dict)
    settings: Dict[str, Any] = field(default_factory=dict)
    history: List[str] = field(default_factory=list)
    
    def load(self):
        """Loads workspace state from SQLite DB (handled by Repository layer)."""
        pass
        
    def save(self):
        """Saves workspace state to SQLite DB."""
        pass
