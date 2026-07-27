import numpy as np
from ..models.rom_map import RomMap, Region, RegionType
from ..models.rom import RomData, RomType

class RomAnalyzer:
    """Analyzes a ROM statically to generate the initial RomMap."""
    
    def __init__(self, rom: RomData, chunk_size: int = 4096):
        self.rom = rom
        self.chunk_size = chunk_size
        self.rom_map = RomMap()
        
    def analyze(self) -> RomMap:
        """Runs all heuristics to map the ROM."""
        if not self.rom.mmap:
            raise RuntimeError("ROM must be loaded before analysis.")
            
        # We start analysis after the SMC header if it exists
        start_offset = self.rom.info.header_offset
        size = self.rom.info.size_bytes
        
        data = np.frombuffer(self.rom.mmap, dtype=np.uint8)
        
        for offset in range(start_offset, size, self.chunk_size):
            end_offset = min(offset + self.chunk_size, size)
            chunk = data[offset:end_offset]
            
            entropy = self._calculate_entropy(chunk)
            region_type = self._classify_chunk(chunk, entropy)
            
            region = Region(
                id=f"region_{offset:06X}",
                start=offset,
                end=end_offset,
                bank=self._offset_to_bank(offset),
                region_type=region_type,
                entropy=entropy
            )
            self.rom_map.add_region(region)
            
        return self.rom_map
        
    def _calculate_entropy(self, chunk: np.ndarray) -> float:
        """Calculates Shannon Entropy of a byte chunk (0.0 to 8.0)."""
        if len(chunk) == 0:
            return 0.0
        
        # Fast histogram calculation
        counts = np.bincount(chunk, minlength=256)
        probs = counts[counts > 0] / len(chunk)
        entropy = -np.sum(probs * np.log2(probs))
        return float(entropy)
        
    def _classify_chunk(self, chunk: np.ndarray, entropy: float) -> RegionType:
        """Classifies a chunk based on basic entropy and content heuristics."""
        if len(chunk) == 0:
            return RegionType.UNKNOWN
            
        first_byte = chunk[0]
        if (first_byte == 0x00 or first_byte == 0xFF) and np.all(chunk == first_byte):
            # We use UNKNOWN for empty space as per user preference (or we could add EMPTY)
            return RegionType.UNKNOWN 
            
        # High entropy suggests compressed data or encrypted/packed graphics
        if entropy > 7.5:
            return RegionType.COMPRESSED
            
        # Mid-high entropy could be graphics or uncompressed data
        if entropy > 6.0:
            return RegionType.DATA
            
        # Low entropy suggests simple tables, padding, or ASCII text
        if entropy < 3.0:
            return RegionType.DATA
            
        # Fallback to CODE. We will refine this with 65816 static analysis later.
        return RegionType.CODE
        
    def _offset_to_bank(self, offset: int) -> int:
        """Returns the SNES bank number for a given physical ROM offset."""
        phys_offset = offset - self.rom.info.header_offset
        if self.rom.info.rom_type == RomType.SNES_LOROM:
            return phys_offset // 0x8000
        elif self.rom.info.rom_type == RomType.SNES_HIROM or self.rom.info.rom_type == RomType.SNES_EXHIROM:
            return phys_offset // 0x10000
        return phys_offset // 0x8000 # fallback
