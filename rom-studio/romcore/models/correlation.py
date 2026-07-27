from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ConfidenceScore:
    dma_match: int = 0
    wram_match: int = 0
    rom_match: int = 0
    tile_consistency: int = 0

    @property
    def total(self) -> int:
        return min(100, self.dma_match + self.wram_match + self.rom_match + self.tile_consistency)

@dataclass
class GraphicCorrelationResult:
    # Origin Info
    screen_x: int = -1
    screen_y: int = -1
    sprite_id: int = -1
    tile_id: int = -1
    
    # SNES Memory Addresses
    vram_addr: int = -1
    wram_addr: int = -1
    rom_offset: int = -1
    
    # DMA Info (dict containing source, dest, length, etc.)
    dma_entry: Optional[dict] = None
    
    # Analysis results
    compression_state: str = "Unknown"
    status: str = "Unknown"
    reason: str = "Not analyzed"
    
    confidence: ConfidenceScore = field(default_factory=ConfidenceScore)
