from dataclasses import dataclass, field
from enum import Enum
import mmap
import pathlib
from typing import Optional

class RomType(Enum):
    SNES_LOROM = "LoROM"
    SNES_HIROM = "HiROM"
    SNES_EXHIROM = "ExHiROM"
    UNKNOWN = "Unknown"

@dataclass
class RomInfo:
    """Metadata and header information about the ROM."""
    title: str = ""
    rom_type: RomType = RomType.UNKNOWN
    is_fastrom: bool = False
    has_copier_header: bool = False
    header_offset: int = 0
    checksum: int = 0
    calculated_checksum: int = 0
    size_bytes: int = 0
    sram_size: int = 0
    banks: int = 0

class RomData:
    """Represents a loaded ROM, providing memory-mapped access for performance."""
    
    def __init__(self, path: pathlib.Path | str):
        self.path = pathlib.Path(path)
        self.file = None
        self.mmap: Optional[mmap.mmap] = None
        self.info = RomInfo()
        
    def load(self):
        """Loads the ROM into a memory-mapped file structure."""
        self.file = open(self.path, "rb")
        # map the entire file
        self.mmap = mmap.mmap(self.file.fileno(), 0, access=mmap.ACCESS_READ)
        self.info.size_bytes = self.mmap.size()
        
    def close(self):
        """Releases the memory map and file handle."""
        if self.mmap:
            self.mmap.close()
            self.mmap = None
        if self.file:
            self.file.close()
            self.file = None

    def read_bytes(self, offset: int, size: int) -> bytes:
        """Reads a specific chunk from the mapped ROM."""
        if not self.mmap:
            raise RuntimeError("ROM not loaded")
        if offset < 0 or offset + size > self.info.size_bytes:
            raise ValueError(f"Read out of bounds. Offset: {offset}, Size: {size}")
        return self.mmap[offset:offset+size]
