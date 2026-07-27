import pytest
import numpy as np
from romcore.analyzer.scanner import PatternScanner
from romcore.models.rom_map import RomMap, Region, RegionType
from romcore.models.rom import RomData, RomInfo, RomType
from unittest.mock import patch, MagicMock

def test_pattern_scanner_graphics():
    rom_map = RomMap()
    
    # Create a region that has characteristics of planar graphics
    # Interleaved zeroes, entropy around 5.5
    region_gfx = Region("gfx_1", 0, 4096, 0, RegionType.DATA, entropy=6.0)
    rom_map.add_region(region_gfx)
    
    # Build dummy data
    data = np.random.randint(1, 256, 4096, dtype=np.uint8)
    # Inject 20% zeros
    zero_indices = np.random.choice(4096, int(4096 * 0.2), replace=False)
    data[zero_indices] = 0
    
    rom = MagicMock(spec=RomData)
    rom.mmap = data.tobytes()
    
    scanner = PatternScanner(rom, rom_map)
    scanner.scan()
    
    assert rom_map.get_region("gfx_1").region_type == RegionType.GRAPHICS

def test_pattern_scanner_pointers():
    rom_map = RomMap()
    
    # Low entropy region
    region_ptr = Region("ptr_1", 0, 1024, 0, RegionType.DATA, entropy=4.0)
    rom_map.add_region(region_ptr)
    
    # Build dummy data of SNES pointers (0x8000 - 0xFFFF)
    # 512 pointers = 1024 bytes
    pointers = np.random.randint(0x8000, 0xFFFF, 512, dtype=np.uint16)
    data = pointers.tobytes()
    
    rom = MagicMock(spec=RomData)
    rom.mmap = data
    
    scanner = PatternScanner(rom, rom_map)
    scanner.scan()
    
    assert rom_map.get_region("ptr_1").region_type == RegionType.POINTERS
