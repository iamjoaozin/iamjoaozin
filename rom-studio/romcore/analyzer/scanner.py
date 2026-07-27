import numpy as np
from ..models.rom_map import RomMap, Region, RegionType
from ..models.rom import RomData

class PatternScanner:
    """Heuristic scanner to detect patterns without decompression."""
    
    def __init__(self, rom: RomData, rom_map: RomMap):
        self.rom = rom
        self.rom_map = rom_map
        
    def scan(self):
        """Scans the ROM and updates the RomMap based on patterns."""
        if not self.rom.mmap: return
        data = np.frombuffer(self.rom.mmap, dtype=np.uint8)
        
        for region in list(self.rom_map.regions.values()):
            if region.region_type in (RegionType.DATA, RegionType.CODE, RegionType.UNKNOWN):
                if region.end > len(data): continue
                chunk = data[region.start:region.end]
                if len(chunk) == 0: continue
                
                # Check for possible pointers (lots of 16-bit values clustered)
                if region.entropy < 5.0:
                    if self._check_pointer_pattern(chunk):
                        region.region_type = RegionType.POINTERS
                        continue
                        
                # Check for possible graphics
                if region.entropy >= 5.0 and region.entropy <= 7.0:
                    if self._check_graphics_pattern(chunk):
                        region.region_type = RegionType.GRAPHICS
                        continue
                        
    def _check_graphics_pattern(self, chunk: np.ndarray) -> bool:
        """Heuristic: Check for interleaved zeroes or specific planar density."""
        zeros = np.sum(chunk == 0)
        ratio = float(zeros) / len(chunk)
        if 0.1 < ratio < 0.4:
            return True
        return False
        
    def _check_pointer_pattern(self, chunk: np.ndarray) -> bool:
        """Heuristic: Check if data looks like a table of 16-bit pointers to the same bank."""
        if len(chunk) < 16: return False
        
        # Treat chunk as 16-bit little-endian
        try:
            if len(chunk) % 2 != 0:
                chunk = chunk[:-1]
            words = chunk.view(np.uint16)
            
            # SNES LoROM pointers usually fall between 0x8000 and 0xFFFF
            valid_ptrs = np.sum((words >= 0x8000) & (words <= 0xFFFF))
            if float(valid_ptrs) / len(words) > 0.8:
                return True
        except ValueError:
            pass
            
        return False
